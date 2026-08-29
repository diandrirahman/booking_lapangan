import type { Environment } from "../../config/environment.js";

export interface CreateProviderPaymentInput {
  attemptId: string;
  bookingId: string;
  amount: number;
  expiresAt: Date;
}

export interface ProviderPaymentResult {
  providerReference: string;
  redirectUrl: string;
}

export interface PaymentProvider {
  createPayment(input: CreateProviderPaymentInput): Promise<ProviderPaymentResult>;
}

interface MidtransSnapResponse {
  token: string;
  redirect_url: string;
}

export class MidtransSandboxProvider implements PaymentProvider {
  constructor(
    private readonly serverKey: string,
    private readonly fetchImplementation: typeof fetch = globalThis.fetch.bind(
      globalThis,
    ),
  ) {}

  async createPayment(
    input: CreateProviderPaymentInput,
  ): Promise<ProviderPaymentResult> {
    const response = await this.fetchImplementation(
      "https://app.sandbox.midtrans.com/snap/v1/transactions",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${Buffer.from(`${this.serverKey}:`).toString("base64")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transaction_details: {
            order_id: input.attemptId,
            gross_amount: input.amount,
          },
          expiry: createExpiry(input.expiresAt),
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );

    if (!response.ok) {
      throw new Error(`Midtrans Sandbox merespons HTTP ${response.status}.`);
    }
    const payload = (await response.json()) as Partial<MidtransSnapResponse>;
    if (!payload.token || !payload.redirect_url) {
      throw new Error("Respons Midtrans Sandbox tidak memuat token dan redirect URL.");
    }
    return {
      providerReference: payload.token,
      redirectUrl: payload.redirect_url,
    };
  }
}

export class LocalPaymentSimulator implements PaymentProvider {
  constructor(private readonly frontendOrigin: string) {}

  createPayment(input: CreateProviderPaymentInput): Promise<ProviderPaymentResult> {
    return Promise.resolve({
      providerReference: `sandbox-${input.attemptId}`,
      redirectUrl: `${this.frontendOrigin}/payments/${input.attemptId}?sandbox=true`,
    });
  }
}

// Kept as a compatibility alias for focused tests that intentionally avoid network I/O.
export class SandboxMidtransProvider extends LocalPaymentSimulator {}

export function createPaymentProvider(environment: Environment): PaymentProvider {
  if (environment.MIDTRANS_SERVER_KEY) {
    return new MidtransSandboxProvider(environment.MIDTRANS_SERVER_KEY);
  }
  return new LocalPaymentSimulator(environment.APP_ORIGIN);
}

function createExpiry(expiresAt: Date): {
  start_time: string;
  unit: "minute";
  duration: number;
} {
  const now = new Date();
  const duration = Math.max(
    1,
    Math.min(1_440, Math.ceil((expiresAt.getTime() - now.getTime()) / 60_000)),
  );
  return {
    start_time: formatMidtransDate(now),
    unit: "minute",
    duration,
  };
}

function formatMidtransDate(date: Date): string {
  return date
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d{3}Z$/, " +0000");
}
