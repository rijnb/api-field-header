/**
 * Generic utility to filter JSON objects based on field inclusion and exclusion
 * lists, as specified in the API response field selection mechanism.
 *
 * The filter supports:
 * - Field inclusion via dot-notation (e.g. "a.b,a.c").
 * - Field exclusion via dot-notation, which overrides inclusion.
 * - Explicit fields that are only returned when explicitly listed.
 * - Wildcard "*" in the inclusion list to include all non-explicit fields.
 *
 * See docs/plans/design.md for the full specification.
 */

type JsonValue = string | number | boolean | null | JsonObject | JsonArray
type JsonObject = { [key: string]: JsonValue }
type JsonArray = JsonValue[]

/**
 * Parse a comma-separated dot-notation field list string into an array of
 * field paths. Whitespace around commas and dots is trimmed.
 * Returns an empty array for empty/blank input.
 */
function parseFieldList(input: string): string[][] {
  const trimmed = input.trim()
  if (trimmed.length === 0) return []
  return trimmed.split(",").map((entry) =>
    entry
      .trim()
      .split(".")
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0),
  )
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
 */
function isPathExplicitlyListed(
  paths: string[][],
  target: string[],
): boolean {
  return paths.some(
    (p) =>
      p.length === target.length && p.every((seg, i) => seg === target[i]),
  )
}

/**
 * Check whether a path (or any of its descendants) is covered by a set of
 * paths. This is true if any listed path starts with the target path.
 */
function isPathOrDescendantListed(
  paths: string[][],
  target: string[],
): boolean {
  return paths.some(
    (p) =>
      p.length >= target.length &&
      target.every((seg, i) => seg === p[i]),
  )
}

/**
 * Check whether a path is covered by an ancestor in the set of paths.
 * This means some listed path is a proper prefix of the target path.
 */
function isAncestorListed(paths: string[][], target: string[]): boolean {
  return paths.some(
    (p) =>
      p.length < target.length && p.every((seg, i) => seg === target[i]),
  )
}

/**
 * Options for FieldFilter.
 */
export interface FieldFilterOptions {
  /**
   * Comma-separated dot-notation string for fields to include (or "*").
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
   * inclusion list — not implicitly via a parent or "*".
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
 * 3. "*" returns all top-level fields and sub-trees, excluding EXPLICIT fields.
 *
 * Exclusion:
 * - Any field in the exclusion list (and its sub-tree) is removed from the
 *   result, regardless of the inclusion list. Exclusion overrides everything.
 */
export class FieldFilter {
  private readonly includeAll: boolean
  private readonly includePaths: string[][]
  private readonly excludePaths: string[][]
  private readonly explicitPaths: string[][]
  private readonly excludeTree: FieldNode

  constructor(options: FieldFilterOptions = {}) {
    const includeRaw = (options.include ?? "").trim()

    this.includeAll = includeRaw === "*"
    this.includePaths = this.includeAll ? [] : parseFieldList(includeRaw)
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

      const childExcludeNode = excludeNode[key] ?? {}
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
    // Excluded if this key is in the exclude tree and it's a leaf
    // (no more children means "exclude this and everything below").
    return key in excludeNode && Object.keys(excludeNode[key]!).length === 0;

  }

  /**
   * Check if a field path should be included based on inclusion rules.
   */
  private isIncluded(path: string[]): boolean {
    // If no inclusion list is specified (empty, no "*"), include everything
    // that is not explicit.
    if (!this.includeAll && this.includePaths.length === 0) {
      return !this.isExplicitField(path) && !this.hasUnincludedExplicitAncestor(path)
    }

    // Check if this is an EXPLICIT field.
    const isExplicit = this.isExplicitField(path)

    // Rule 3: "*" includes all non-EXPLICIT fields.
    if (this.includeAll) {
      if (isExplicit) {
        return false
      }
      return !this.hasUnincludedExplicitAncestor(path)
    }

    // EXPLICIT fields require exact mention in the inclusion list.
    // Similarly, non-explicit fields behind an unincluded EXPLICIT ancestor
    // are "gated" — an ancestor above the gate cannot grant implicit access.
    // In both cases, the field itself or a descendant must be in the include list.
    if (isExplicit || this.hasUnincludedExplicitAncestor(path)) {
      return isPathOrDescendantListed(this.includePaths, path)
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
