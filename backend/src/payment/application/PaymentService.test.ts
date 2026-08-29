import { describe, expect, it } from "vitest";
import { loadEnvironment } from "../../config/environment.js";
import { PaymentService } from "./PaymentService.js";

describe("payment signature", () => {
  it("menerima signature sandbox lokal hanya di non-production", () => {
    const service = new PaymentService(
      {} as never,
      {} as never,
      loadEnvironment({ NODE_ENV: "test", MIDTRANS_SERVER_KEY: "" }),
    );
    expect(
      service.verifySignature({
        attemptId: "attempt-1",
        statusCode: "200",
        grossAmount: "100000",
        signatureKey: "sandbox-local",
      }),
    ).toBe(true);
  });
});
