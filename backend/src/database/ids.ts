import { createCipheriv, createDecipheriv, createHash } from "node:crypto";

const PUBLIC_ID_PATTERN = /^[A-Za-z0-9_-]{22}$/;
const PUBLIC_ID_MARKER = Buffer.from("LPGOID01", "ascii");
const DEVELOPMENT_SECRET = "local-public-id-secret-change-before-production";

/**
 * Encrypts internal numeric keys before they cross an HTTP boundary.
 * Authorization remains mandatory; opaque IDs only prevent leaking database keys.
 */
export function formatPublicId(value: number): string {
  assertDatabaseId(value);
  const block = Buffer.alloc(16);
  PUBLIC_ID_MARKER.copy(block, 0);
  block.writeBigUInt64BE(BigInt(value), 8);

  const cipher = createCipheriv("aes-256-ecb", publicIdKey(), null);
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(block), cipher.final()]).toString("base64url");
}

/** Converts an opaque API reference back to the numeric key used by MySQL. */
export function parsePublicId(value: string): number {
  if (!PUBLIC_ID_PATTERN.test(value)) {
    throw invalidPublicId();
  }

  try {
    const decipher = createDecipheriv("aes-256-ecb", publicIdKey(), null);
    decipher.setAutoPadding(false);
    const block = Buffer.concat([
      decipher.update(Buffer.from(value, "base64url")),
      decipher.final(),
    ]);
    if (!block.subarray(0, 8).equals(PUBLIC_ID_MARKER)) {
      throw invalidPublicId();
    }
    const id = Number(block.readBigUInt64BE(8));
    assertDatabaseId(id);
    return id;
  } catch {
    throw invalidPublicId();
  }
}

function publicIdKey(): Buffer {
  const secret = process.env.RESOURCE_ID_SECRET ?? DEVELOPMENT_SECRET;
  return createHash("sha256").update(secret).digest();
}

function assertDatabaseId(value: number): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`Database returned an invalid identifier: ${value}`);
  }
}

function invalidPublicId(): TypeError {
  return new TypeError("Identifier publik tidak valid.");
}
