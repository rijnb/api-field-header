import { describe, it, expect } from "vitest"
import { FieldFilter, parseFieldList } from "./FieldFilter"

/**
 * Test JSON matching the tree from the design document:
 *```
 *        A
 *        |
 *     B-----C
 *     |     |
 *   X*--Y   Z
 *   |
 * P---Q*
 *```
 * Where X and Q are EXPLICIT fields.
 */
const fullObject = {
  A: {
    B: {
      X: {
        P: "p-value",
        Q: "q-value",
      },
      Y: "y-value",
    },
    C: {
      Z: "z-value",
    },
  },
}

const explicitFields = ["A.B.X", "A.B.X.Q"]

describe("FieldFilter", () => {
  describe("design document examples", () => {
    it('include "A" returns all non-explicit fields', () => {
      const filter = new FieldFilter({
        include: "A",
        explicitFields,
      })
      expect(filter.apply(fullObject)).toEqual({
        A: {
          B: {
            Y: "y-value",
          },
          C: {
            Z: "z-value",
          },
        },
      })
    })

    it('"A, A.B.X" includes explicit field A.B.X (but not Q)', () => {
      const filter = new FieldFilter({
        include: "A, A.B.X",
        explicitFields,
      })
      expect(filter.apply(fullObject)).toEqual({
        A: {
          B: {
            X: {
              P: "p-value",
            },
            Y: "y-value",
          },
          C: {
            Z: "z-value",
          },
        },
      })
    })

    it('"A, A.B.X.Q" includes explicit field A.B.X.Q', () => {
      const filter = new FieldFilter({
        include: "A, A.B.X.Q",
        explicitFields,
      })
      expect(filter.apply(fullObject)).toEqual({
        A: {
          B: {
            X: {
              Q: "q-value",
            },
            Y: "y-value",
          },
          C: {
            Z: "z-value",
          },
        },
      })
    })
  })

  describe("design document exclusion examples", () => {
    it("include A, exclude A.C removes C subtree", () => {
      const filter = new FieldFilter({
        include: "A",
        exclude: "A.C",
        explicitFields,
      })
      expect(filter.apply(fullObject)).toEqual({
        A: {
          B: {
            Y: "y-value",
          },
        },
      })
    })

    it("include A and A.B.X, exclude A.B.X.P removes P", () => {
      const filter = new FieldFilter({
        include: "A, A.B.X",
        exclude: "A.B.X.P",
        explicitFields,
      })
      expect(filter.apply(fullObject)).toEqual({
        A: {
          B: {
            Y: "y-value",
          },
          C: {
            Z: "z-value",
          },
        },
      })
    })
  })

  describe("no inclusion list (empty)", () => {
    it("returns all non-explicit fields when include is empty", () => {
      const filter = new FieldFilter({
        include: "",
        explicitFields,
      })
      expect(filter.apply(fullObject)).toEqual({
        A: {
          B: {
            Y: "y-value",
          },
          C: {
            Z: "z-value",
          },
        },
      })
    })

    it("returns all non-explicit fields when include is undefined", () => {
      const filter = new FieldFilter({
        explicitFields,
      })
      expect(filter.apply(fullObject)).toEqual({
        A: {
          B: {
            Y: "y-value",
          },
          C: {
            Z: "z-value",
          },
        },
      })
    })
  })

  describe("no explicit fields", () => {
    it("include A returns entire object when no explicit fields defined", () => {
      const filter = new FieldFilter({
        include: "A",
      })
      expect(filter.apply(fullObject)).toEqual(fullObject)
    })

  })

  describe("exclusion overrides inclusion", () => {
    it("excluding a field that was explicitly included removes it", () => {
      const filter = new FieldFilter({
        include: "A, A.B.X",
        exclude: "A.B.X",
        explicitFields,
      })
      expect(filter.apply(fullObject)).toEqual({
        A: {
          B: {
            Y: "y-value",
          },
          C: {
            Z: "z-value",
          },
        },
      })
    })

    it("excluding a parent excludes all children even if included", () => {
      const filter = new FieldFilter({
        include: "A, A.B.X",
        exclude: "A.B",
        explicitFields,
      })
      expect(filter.apply(fullObject)).toEqual({
        A: {
          C: {
            Z: "z-value",
          },
        },
      })
    })
  })

  describe("arrays", () => {
    it("filters objects inside arrays", () => {
      const input = [
        { name: "Alice", age: 30, secret: "x" },
        { name: "Bob", age: 25, secret: "y" },
      ]
      const filter = new FieldFilter({
        include: "name, age",
      })
      expect(filter.apply(input)).toEqual([
        { name: "Alice", age: 30 },
        { name: "Bob", age: 25 },
      ])
    })

    it("applies exclusion to array items", () => {
      const input = [
        { name: "Alice", age: 30 },
        { name: "Bob", age: 25 },
      ]
      const filter = new FieldFilter({
        exclude: "age",
      })
      expect(filter.apply(input)).toEqual([
        { name: "Alice" },
        { name: "Bob" },
      ])
    })
  })

  describe("flat objects", () => {
    it("includes specific fields from a flat object", () => {
      const input = { a: 1, b: 2, c: 3, d: 4 }
      const filter = new FieldFilter({
        include: "a, c",
      })
      expect(filter.apply(input)).toEqual({ a: 1, c: 3 })
    })

    it("excludes specific fields from a flat object", () => {
      const input = { a: 1, b: 2, c: 3, d: 4 }
      const filter = new FieldFilter({
        exclude: "b, d",
      })
      expect(filter.apply(input)).toEqual({ a: 1, c: 3 })
    })
  })

  describe("deeply nested objects", () => {
    it("includes a deeply nested path", () => {
      const input = {
        level1: {
          level2: {
            level3: {
              target: "found",
              other: "skip",
            },
            sibling: "skip",
          },
          another: "skip",
        },
      }
      const filter = new FieldFilter({
        include: "level1.level2.level3.target",
      })
      expect(filter.apply(input)).toEqual({
        level1: {
          level2: {
            level3: {
              target: "found",
            },
          },
        },
      })
    })
  })

  describe("edge cases", () => {
    it("returns undefined for an entirely excluded object", () => {
      const filter = new FieldFilter({
        exclude: "A",
      })
      expect(filter.apply(fullObject)).toBeUndefined()
    })

    it("handles null values", () => {
      const input = { a: null, b: "value" }
      const filter = new FieldFilter({
        include: "a, b",
      })
      expect(filter.apply(input)).toEqual({ a: null, b: "value" })
    })

    it("handles primitive at top level (passthrough)", () => {
      const filter = new FieldFilter({ include: "a" })
      expect(filter.apply(42 as never)).toBe(42)
      expect(filter.apply("hello" as never)).toBe("hello")
      expect(filter.apply(true as never)).toBe(true)
      expect(filter.apply(null as never)).toBe(null)
    })

    it("handles empty object", () => {
      const filter = new FieldFilter({ include: "a" })
      expect(filter.apply({})).toBeUndefined()
    })

    it("handles whitespace in field lists", () => {
      const input = { a: 1, b: 2, c: 3 }
      const filter = new FieldFilter({
        include: "  a ,  c  ",
      })
      expect(filter.apply(input)).toEqual({ a: 1, c: 3 })
    })
  })

  describe("parseFieldList", () => {
    it("parses simple dot-notation", () => {
      expect(parseFieldList("a.b, a.c")).toEqual([
        ["a", "b"],
        ["a", "c"],
      ])
    })

    it("parses parenthesized set notation", () => {
      expect(parseFieldList("a(b, c)")).toEqual([
        ["a", "b"],
        ["a", "c"],
      ])
    })

    it("parses nested parenthesized notation", () => {
      expect(parseFieldList("a(x(p, q))")).toEqual([
        ["a", "x", "p"],
        ["a", "x", "q"],
      ])
    })

    it("parses wildcard inside parentheses", () => {
      expect(parseFieldList("a(x(*))")).toEqual([["a", "x", "*"]])
    })

    it("parses top-level wildcard inside parentheses", () => {
      expect(parseFieldList("a(*)")).toEqual([["a", "*"]])
    })

    it("parses mixed dot-notation and parentheses", () => {
      expect(parseFieldList("a.b, a(c, d)")).toEqual([
        ["a", "b"],
        ["a", "c"],
        ["a", "d"],
      ])
    })

    it("parses dot after parenthesized group via nesting", () => {
      expect(parseFieldList("a(b.x, c)")).toEqual([
        ["a", "b", "x"],
        ["a", "c"],
      ])
    })

    it("handles whitespace around parentheses", () => {
      expect(parseFieldList("a ( b , c )")).toEqual([
        ["a", "b"],
        ["a", "c"],
      ])
    })

    it("returns empty array for empty input", () => {
      expect(parseFieldList("")).toEqual([])
      expect(parseFieldList("   ")).toEqual([])
    })

    it("rejects * as a top-level selector", () => {
      expect(() => parseFieldList("*")).toThrow("not allowed as a top-level selector")
      expect(() => parseFieldList("  *  ")).toThrow("not allowed as a top-level selector")
      expect(() => parseFieldList("A, *")).toThrow("not allowed as a top-level selector")
    })

    it("parses wildcard mixed with fields inside parentheses", () => {
      expect(parseFieldList("A(*, B.X)")).toEqual([
        ["A", "*"],
        ["A", "B", "X"],
      ])
    })

    it("parses wildcard mixed with nested parentheses", () => {
      expect(parseFieldList("A(*, B(X))")).toEqual([
        ["A", "*"],
        ["A", "B", "X"],
      ])
    })
  })

  describe("parenthesized set notation in FieldFilter", () => {
    it('"a(b, c)" is equivalent to "a.b, a.c"', () => {
      const input = { a: { b: 1, c: 2, d: 3 } }
      const dotFilter = new FieldFilter({ include: "a.b, a.c" })
      const parenFilter = new FieldFilter({ include: "a(b, c)" })
      expect(parenFilter.apply(input)).toEqual(dotFilter.apply(input))
      expect(parenFilter.apply(input)).toEqual({ a: { b: 1, c: 2 } })
    })

    it('"A(B(X, Y), C)" is equivalent to "A.B.X, A.B.Y, A.C"', () => {
      const filter = new FieldFilter({
        include: "A(B(X, Y), C)",
        explicitFields,
      })
      expect(filter.apply(fullObject)).toEqual({
        A: {
          B: {
            X: {
              P: "p-value",
            },
            Y: "y-value",
          },
          C: {
            Z: "z-value",
          },
        },
      })
    })

    it("wildcard inside parentheses selects all children", () => {
      const input = {
        a: {
          x: { p: 1, q: 2 },
          y: 3,
        },
      }
      const filter = new FieldFilter({ include: "a(x(*))" })
      expect(filter.apply(input)).toEqual({
        a: {
          x: { p: 1, q: 2 },
        },
      })
    })

    it("a(*) selects all children of a", () => {
      const input = {
        a: { b: 1, c: 2 },
        d: 3,
      }
      const filter = new FieldFilter({ include: "a(*)" })
      expect(filter.apply(input)).toEqual({
        a: { b: 1, c: 2 },
      })
    })

    it("wildcard in parentheses does not include explicit fields", () => {
      const filter = new FieldFilter({
        include: "A(B(*), C)",
        explicitFields,
      })
      expect(filter.apply(fullObject)).toEqual({
        A: {
          B: {
            Y: "y-value",
          },
          C: {
            Z: "z-value",
          },
        },
      })
    })

    it("parenthesized notation in exclusion list", () => {
      const input = { a: { b: 1, c: 2, d: 3 } }
      const filter = new FieldFilter({
        include: "a",
        exclude: "a(b, d)",
      })
      expect(filter.apply(input)).toEqual({ a: { c: 2 } })
    })

    it("nested parenthesized exclusion", () => {
      const filter = new FieldFilter({
        include: "A, A.B.X",
        exclude: "A(C)",
        explicitFields,
      })
      expect(filter.apply(fullObject)).toEqual({
        A: {
          B: {
            X: {
              P: "p-value",
            },
            Y: "y-value",
          },
        },
      })
    })

    it('"A(*, B.X)" is equivalent to "A, A.B.X"', () => {
      const filter = new FieldFilter({
        include: "A(*, B.X)",
        explicitFields,
      })
      expect(filter.apply(fullObject)).toEqual({
        A: {
          B: {
            X: {
              P: "p-value",
            },
            Y: "y-value",
          },
          C: {
            Z: "z-value",
          },
        },
      })
    })

    it('"A(*, B(X))" is equivalent to "A, A.B.X"', () => {
      const filter = new FieldFilter({
        include: "A(*, B(X))",
        explicitFields,
      })
      expect(filter.apply(fullObject)).toEqual({
        A: {
          B: {
            X: {
              P: "p-value",
            },
            Y: "y-value",
          },
          C: {
            Z: "z-value",
          },
        },
      })
    })

    it('"A(*, B(X(Q)))" is equivalent to "A, A.B.X.Q"', () => {
      const filter = new FieldFilter({
        include: "A(*, B(X(Q)))",
        explicitFields,
      })
      expect(filter.apply(fullObject)).toEqual({
        A: {
          B: {
            X: {
              Q: "q-value",
            },
            Y: "y-value",
          },
          C: {
            Z: "z-value",
          },
        },
      })
    })

    it("deeply nested parenthesized notation", () => {
      const input = {
        level1: {
          level2: {
            level3: {
              target: "found",
              other: "skip",
            },
            sibling: "skip",
          },
          another: "skip",
        },
      }
      const filter = new FieldFilter({
        include: "level1(level2(level3(target)))",
      })
      expect(filter.apply(input)).toEqual({
        level1: {
          level2: {
            level3: {
              target: "found",
            },
          },
        },
      })
    })
  })
})
