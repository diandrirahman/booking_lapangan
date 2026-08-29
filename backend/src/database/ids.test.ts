import { describe, expect, it } from "vitest";
import { formatPublicId, parsePublicId } from "./ids.js";

describe("opaque public identifiers", () => {
  it("mengenkripsi dan mengembalikan ID internal", () => {
    const publicId = formatPublicId(42);

    expect(publicId).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(publicId).not.toContain("42");
    expect(parsePublicId(publicId)).toBe(42);
  });

  it("menghasilkan referensi stabil untuk resource yang sama", () => {
    expect(formatPublicId(42)).toBe(formatPublicId(42));
    expect(formatPublicId(42)).not.toBe(formatPublicId(43));
  });

  it.each(["", "0", "-1", "01", "abc", "aaaaaaaaaaaaaaaaaaaaaa"])(
    "menolak ID tidak valid: %s",
    (value) => {
      expect(() => parsePublicId(value)).toThrow(TypeError);
    },
  );
});
