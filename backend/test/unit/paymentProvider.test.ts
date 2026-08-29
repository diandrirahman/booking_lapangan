import { describe, expect, it, vi } from "vitest";
import {
  LocalPaymentSimulator,
  MidtransSandboxProvider,
} from "../../src/payment/application/PaymentProvider.js";

const paymentInput = {
  attemptId: "PAY-abcdefghijklmnop",
  bookingId: "LG-abcdefghijklmnop",
  amount: 160_000,
  expiresAt: new Date(Date.now() + 10 * 60_000),
};

describe("payment providers", () => {
  it("membuat Snap transaction dengan order reference publik", async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          token: "sandbox-token",
          redirect_url: "https://app.sandbox.midtrans.com/snap/v4/redirection/token",
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      ),
    );
    const provider = new MidtransSandboxProvider(
      "sandbox-server-key",
      fetchImplementation,
    );

    const result = await provider.createPayment(paymentInput);

    expect(result.providerReference).toBe("sandbox-token");
    expect(result.redirectUrl).toContain("app.sandbox.midtrans.com");
    expect(fetchImplementation).toHaveBeenCalledOnce();
    const [, request] = fetchImplementation.mock.calls[0]!;
    expect(JSON.parse(request?.body as string)).toMatchObject({
      transaction_details: {
        order_id: paymentInput.attemptId,
        gross_amount: paymentInput.amount,
      },
    });
  });

  it("menjaga simulator lokal bebas network untuk development dan test", async () => {
    const provider = new LocalPaymentSimulator("http://localhost:5173");
    await expect(provider.createPayment(paymentInput)).resolves.toEqual({
      providerReference: `sandbox-${paymentInput.attemptId}`,
      redirectUrl: `http://localhost:5173/payments/${paymentInput.attemptId}?sandbox=true`,
    });
  });
});
