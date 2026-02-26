/**
 * Generic utility to filter JSON objects based on field inclusion and exclusion
 * lists, as specified in the API response field selection mechanism.
 *
 * The filter supports:
 * - Field inclusion via dot-notation (e.g. "a.b, a.c") or parenthesized
 *   set notation (e.g. "a(b, c)"), or a mix of both.
 * - Field exclusion via the same notation, which overrides inclusion.
 * - Explicit fields that are only returned when explicitly listed.
 * - Wildcard "*" inside parentheses to select all fields at that level,
 *   e.g. "a(x(*))" selects everything under a.x.
 *
 * Note: "*" is NOT allowed as a top-level selector. You must specify at
 * least one top-level field explicitly.
 *
 * Grammar (semi-formal):
 *
 *   field-list           ::= field (',' field)*
 *   field                ::= name ('.' field | field-set)?
 *   field-set            ::= '(' field-set-list ')'
 *   field-set-list       ::= '*' (',' field)* | field (',' field)*
 *
 * See docs/plans/design.md for the full specification.
 */

type JsonValue = string | number | boolean | null | JsonObject | JsonArray
type JsonObject = { [key: string]: JsonValue }
type JsonArray = JsonValue[]

/**
 * Parse a field list string into an array of field paths.
 *
 * Supports both dot-notation ("a.b, a.c") and parenthesized set notation
 * ("a(b, c)"), as well as any mix of both. Whitespace is ignored around
 * separators and parentheses. A "*" inside parentheses selects all children
 * at that level.
 *
 * Returns an empty array for empty/blank input.
 */
export function parseFieldList(input: string): string[][] {
  const trimmed = input.trim()
  if (trimmed.length === 0) return []

  const parser = new FieldListParser(trimmed)
  return parser.parse()
}

/**
 * Recursive-descent parser for the field list grammar:
 *
 *   field-list     ::= field (',' field)*
 *   field          ::= name (('.' field) | field-set)?
 *   field-set      ::= '(' field-set-list ')'
 *   field-set-list ::= '*' | field (',' field)*
 */
class FieldListParser {
  private pos = 0
  private readonly src: string

  constructor(src: string) {
    this.src = src
  }

  parse(): string[][] {
    const results = this.parseFieldList()
    this.skipWhitespace()
    if (this.pos < this.src.length) {
      throw new Error(
        `Unexpected character '${this.src[this.pos]}' at position ${this.pos}`,
      )
    }
    return results
  }

  /** field-list ::= field (',' field)* */
  private parseFieldList(): string[][] {
    const paths: string[][] = []
    this.collectField([], paths)
    while (this.peek() === ",") {
      this.consume() // skip ','
      this.collectField([], paths)
    }
    return paths
  }

  /**
   * Parse a single field production and collect every resulting path
   * (there may be multiple when a field-set is used).
   */
  private collectField(prefix: string[], out: string[][]): void {
    const name = this.parseName()

    // "*" is only allowed inside parentheses (handled by parseFieldSetList).
    // At the top level (empty prefix), it is not a valid field name.
    if (name === "*" && prefix.length === 0) {
      throw new Error(
        `'*' is not allowed as a top-level selector (position ${this.pos - 1}). Use specific field names or parenthesized wildcards like A(*).`,
      )
    }

    const currentPath = [...prefix, name]

    const next = this.peek()
    if (next === ".") {
      this.consume() // skip '.'
      this.collectField(currentPath, out)
    } else if (next === "(") {
      this.consume() // skip '('
      this.parseFieldSetList(currentPath, out)
      this.expect(")")
    } else {
      out.push(currentPath)
    }
  }

  /** field-set-list ::= '*' (',' field-list)? | field (',' field)* */
  private parseFieldSetList(prefix: string[], out: string[][]): void {
    this.skipWhitespace()
    if (this.peek() === "*") {
      this.consume() // skip '*'
      out.push([...prefix, "*"])
      // Allow additional fields after "*", e.g. "A(*, B.X)"
      while (this.peek() === ",") {
        this.consume() // skip ','
        this.collectField(prefix, out)
      }
      return
    }
    this.collectField(prefix, out)
    while (this.peek() === ",") {
      this.consume() // skip ','
      this.collectField(prefix, out)
    }
  }

  // ── Lexer helpers ──

  private skipWhitespace(): void {
    while (this.pos < this.src.length && /\s/.test(this.src[this.pos]!)) {
      this.pos++
    }
  }

  /** Peek at the next non-whitespace character (or undefined at end). */
  private peek(): string | undefined {
    this.skipWhitespace()
    return this.pos < this.src.length ? this.src[this.pos] : undefined
  }

  /** Consume the current character (after skipping whitespace). */
  private consume(): void {
    this.skipWhitespace()
    this.pos++
  }

  /** Consume and assert the expected character. */
  private expect(ch: string): void {
    this.skipWhitespace()
    if (this.pos >= this.src.length || this.src[this.pos] !== ch) {
      throw new Error(
        `Expected '${ch}' at position ${this.pos}, got '${this.src[this.pos] ?? "EOF"}'`,
      )
    }
    this.pos++
  }

  /**
   * Parse a field name: one or more characters that are not
   * whitespace, comma, dot, or parentheses.
   */
  private parseName(): string {
    this.skipWhitespace()
    const start = this.pos
    while (
      this.pos < this.src.length &&
      !/[\s.,()]/.test(this.src[this.pos]!)
    ) {
      this.pos++
    }
    const name = this.src.slice(start, this.pos)
    if (name.length === 0) {
      throw new Error(
        `Expected field name at position ${this.pos}, got '${this.src[this.pos] ?? "EOF"}'`,
      )
    }
    return name
  }
}

/**
 * A tree-shaped structure representing a set of field paths.
 * Each node maps a field name to its children. A node with an empty
 * children map means "include everything below this point".
 */
interface FieldNode {
  [key: string]: FieldNode
}

/**
 * Build a tree from a list of parsed field paths.
 */
function buildFieldTree(paths: string[][]): FieldNode {
  const root: FieldNode = {}
  for (const path of paths) {
    let current = root
    for (const segment of path) {
      if (!current[segment]) {
        current[segment] = {}
      }
      current = current[segment]!
    }
  }
  return root
}

/**
 * Check whether a path (as segments) is explicitly listed in a set of paths.
 * "Explicitly listed" means the exact path appears, not just a parent of it.
 *
 * Paths ending in "*" are wildcards and do NOT count as explicitly listing
 * any concrete field — they behave like the top-level "*" (all non-explicit).
 */
function isPathExplicitlyListed(
  paths: string[][],
  target: string[],
): boolean {
  return paths.some(
    (p) =>
      p.length === target.length &&
      !p.includes("*") &&
      p.every((seg, i) => seg === target[i]),
  )
}

/**
 * Check whether a path (or any of its descendants) is covered by a set of
 * paths. This is true if any listed path starts with the target path.
 *
 * A listed path ending in "*" is treated as covering everything at and
 * below its prefix (without the "*"). So the path is considered listed
 * when target equals the prefix, is a descendant of it, or is an ancestor
 * of it (meaning the listed path is a descendant of target).
 */
function isPathOrDescendantListed(
  paths: string[][],
  target: string[],
): boolean {
  return paths.some((p) => {
    if (p.length > 0 && p[p.length - 1] === "*") {
      const prefix = p.slice(0, -1)
      // prefix covers target (target is at or below prefix)
      // OR target is above prefix (prefix is a descendant of target)
      return (
        (prefix.length <= target.length &&
          prefix.every((seg, i) => seg === target[i])) ||
        (prefix.length > target.length &&
          target.every((seg, i) => seg === prefix[i]))
      )
    }
    return (
      p.length >= target.length &&
      target.every((seg, i) => seg === p[i])
    )
  })
}

/**
 * Like isPathOrDescendantListed, but ignores paths that end with "*".
 * Used when checking EXPLICIT fields, which require concrete (non-wildcard)
 * mention in the inclusion list.
 */
function isPathOrDescendantListedConcrete(
  paths: string[][],
  target: string[],
): boolean {
  return paths.some(
    (p) =>
      !p.includes("*") &&
      p.length >= target.length &&
      target.every((seg, i) => seg === p[i]),
  )
}

/**
 * Check whether a path is covered by an ancestor in the set of paths.
 * This means some listed path is a proper prefix of the target path.
 *
 * A listed path ending in "*" is an ancestor of target if the prefix
 * (without "*") is a proper prefix of target or equals target.
 */
function isAncestorListed(paths: string[][], target: string[]): boolean {
  return paths.some((p) => {
    if (p.length > 0 && p[p.length - 1] === "*") {
      const prefix = p.slice(0, -1)
      return (
        prefix.length < target.length &&
        prefix.every((seg, i) => seg === target[i])
      )
    }
    return (
      p.length < target.length && p.every((seg, i) => seg === target[i])
    )
  })
}

/**
 * Options for FieldFilter.
 */
export interface FieldFilterOptions {
  /**
   * Comma-separated dot-notation string for fields to include.
   * Corresponds to the "Attributes" HTTP header.
   */
  include?: string

  /**
   * Comma-separated dot-notation string for fields to exclude.
   * Corresponds to the "Attributes-Excluded" HTTP header.
   */
  exclude?: string

  /**
   * List of field paths (in dot-notation) that are marked as EXPLICIT.
   * These fields are only included when explicitly mentioned in the
   * inclusion list — not implicitly via a parent.
   */
  explicitFields?: string[]
}

/**
 * FieldFilter applies inclusion and exclusion rules to a JSON value.
 *
 * Rules (from the design document):
 *
 * Inclusion:
 * 1. Any field (and its sub-tree) in the inclusion list is returned.
 *    Exception: EXPLICIT fields must be explicitly listed (rule 2).
 * 2. EXPLICIT fields must be explicitly named in the inclusion list;
 *    including a parent does not implicitly include an EXPLICIT child.
 *
 * Exclusion:
 * - Any field in the exclusion list (and its sub-tree) is removed from the
 *   result, regardless of the inclusion list. Exclusion overrides everything.
 */
export class FieldFilter {
  private readonly includePaths: string[][]
  private readonly excludePaths: string[][]
  private readonly explicitPaths: string[][]
  private readonly excludeTree: FieldNode

  constructor(options: FieldFilterOptions = {}) {
    const includeRaw = (options.include ?? "").trim()

    this.includePaths = parseFieldList(includeRaw)
    this.excludePaths = parseFieldList(options.exclude ?? "")
    this.explicitPaths = (options.explicitFields ?? []).map((f) =>
      f
        .trim()
        .split(".")
        .map((s) => s.trim()),
    )
    this.excludeTree = buildFieldTree(this.excludePaths)
  }

  /**
   * Apply the filter to a JSON value (object or array).
   * Returns the filtered value, or undefined if the entire value is excluded.
   */
  apply(value: JsonValue): JsonValue | undefined {
    return this.filterValue(value, [], this.excludeTree)
  }

  private filterValue(
    value: JsonValue,
    currentPath: string[],
    excludeNode: FieldNode,
  ): JsonValue | undefined {
    if (value === null || typeof value !== "object") {
      return value
    }

    if (Array.isArray(value)) {
      return this.filterArray(value, currentPath, excludeNode)
    }

    return this.filterObject(value, currentPath, excludeNode)
  }

  private filterArray(
    arr: JsonArray,
    currentPath: string[],
    excludeNode: FieldNode,
  ): JsonArray {
    const result: JsonArray = []
    for (const item of arr) {
      const filtered = this.filterValue(item, currentPath, excludeNode)
      if (filtered !== undefined) {
        result.push(filtered)
      }
    }
    return result
  }

  private filterObject(
    obj: JsonObject,
    currentPath: string[],
    excludeNode: FieldNode,
  ): JsonObject | undefined {
    const result: JsonObject = {}
    let hasKeys = false

    for (const key of Object.keys(obj)) {
      const childPath = [...currentPath, key]

      // Rule: exclusion overrides everything.
      if (this.isExcluded(excludeNode, key)) {
        continue
      }

      // Determine if this field should be included.
      if (!this.isIncluded(childPath)) {
        continue
      }

      const childExcludeNode = excludeNode[key] ?? excludeNode["*"] ?? {}
      const childValue = obj[key]!
      const filtered = this.filterValue(childValue, childPath, childExcludeNode)

      if (filtered !== undefined) {
        result[key] = filtered
        hasKeys = true
      }
    }

    return hasKeys ? result : undefined
  }

  /**
   * Check if a field path is excluded.
   */
  private isExcluded(excludeNode: FieldNode, key: string): boolean {
    // A "*" leaf in the exclude tree means "exclude everything at this level".
    if ("*" in excludeNode && Object.keys(excludeNode["*"]!).length === 0) {
      return true
    }
    // Excluded if this key is in the exclude tree and it's a leaf
    // (no more children means "exclude this and everything below").
    return key in excludeNode && Object.keys(excludeNode[key]!).length === 0
  }

  /**
   * Check if a field path should be included based on inclusion rules.
   */
  private isIncluded(path: string[]): boolean {
    // If no inclusion list is specified (empty), include everything
    // that is not explicit.
    if (this.includePaths.length === 0) {
      return !this.isExplicitField(path) && !this.hasUnincludedExplicitAncestor(path)
    }

    // Check if this is an EXPLICIT field.
    const isExplicit = this.isExplicitField(path)

    // EXPLICIT fields require exact mention in the inclusion list.
    // Similarly, non-explicit fields behind an unincluded EXPLICIT ancestor
    // are "gated" — an ancestor above the gate cannot grant implicit access.
    // In both cases, the field itself or a descendant must be listed
    // concretely (wildcard paths do not open the explicit gate).
    if (isExplicit || this.hasUnincludedExplicitAncestor(path)) {
      return isPathOrDescendantListedConcrete(this.includePaths, path)
    }

    // Non-explicit field without an explicit gate: included if it, an ancestor,
    // or a descendant is in the inclusion list.
    return (
      isAncestorListed(this.includePaths, path) ||
      isPathOrDescendantListed(this.includePaths, path)
    )
  }

  /**
   * Check if a path refers to a field marked as EXPLICIT.
   */
  private isExplicitField(path: string[]): boolean {
    return this.explicitPaths.some(
      (ep) =>
        ep.length === path.length && ep.every((seg, i) => seg === path[i]),
    )
  }

  /**
   * Check if any ancestor of the given path is an EXPLICIT field that was
   * NOT explicitly listed in the inclusion list. If so, the field is behind
   * a "gate" that hasn't been opened.
   *
   * For example, if X is EXPLICIT and the include list is "A, A.B.X.Q",
   * then X was not explicitly named (A.B.X.Q names Q, not X).
   * So the field A.B.X.P would have an unincluded explicit ancestor (X).
   */
  private hasUnincludedExplicitAncestor(path: string[]): boolean {
    // Check each proper prefix of `path` to see if it is an explicit field
    // that is not in the include list.
    for (let i = 1; i < path.length; i++) {
      const ancestorPath = path.slice(0, i)
      if (
        this.isExplicitField(ancestorPath) &&
        !isPathExplicitlyListed(this.includePaths, ancestorPath)
      ) {
        return true
      }
    }
    return false
  }
}
