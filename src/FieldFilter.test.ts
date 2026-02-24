import { describe, it, expect } from "vitest"
import { FieldFilter } from "./FieldFilter"

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

    it('"*" returns same as "A" (all non-explicit fields)', () => {
      const filter = new FieldFilter({
        include: "*",
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

    it('"*" returns entire object when no explicit fields defined', () => {
      const filter = new FieldFilter({
        include: "*",
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
})
