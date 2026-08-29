import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

interface OpenApiDocument {
  openapi: string;
  paths: Record<string, Record<string, OpenApiOperation>>;
  components?: {
    responses?: Record<string, unknown>;
    schemas?: Record<string, unknown>;
  };
}

interface OpenApiOperation {
  requestBody?: unknown;
  responses?: Record<string, unknown>;
}

describe("B1 OpenAPI contract", () => {
  it("keeps versioned critical endpoints and the shared error schema", async () => {
    const contractPath = fileURLToPath(
      new URL("../../../docs/openapi/b1.yaml", import.meta.url),
    );
    const document = parse(await readFile(contractPath, "utf8")) as OpenApiDocument;

    expect(document.openapi).toBe("3.1.0");
    expect(Object.keys(document.paths)).toEqual(
      expect.arrayContaining([
        "/auth/register",
        "/venues",
        "/availability",
        "/bookings",
        "/payment-attempts",
        "/events",
      ]),
    );
    expect(document.components?.schemas?.ApiError).toBeDefined();
    expect(document.components?.responses?.PayloadTooLarge).toBeDefined();

    const jsonBodyOperations = Object.values(document.paths).flatMap((path) =>
      Object.values(path).filter((operation) => operation.requestBody !== undefined),
    );

    expect(jsonBodyOperations.length).toBeGreaterThan(0);
    expect(
      jsonBodyOperations.every(
        (operation) => operation.responses?.["413"] !== undefined,
      ),
    ).toBe(true);
  });
});
