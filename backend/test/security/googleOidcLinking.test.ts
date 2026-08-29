import { describe, expect, it, vi } from "vitest";
import { formatPublicId } from "../../src/database/ids.js";
import { GoogleOidcService } from "../../src/identity/auth/GoogleOidcService.js";

interface GoogleClaimsFixture {
  sub: string;
  email: string;
  email_verified: boolean;
  name: string;
  nonce: string;
}

interface GoogleResolver {
  resolveUser(
    claims: GoogleClaimsFixture,
    linkingUserId: string | null,
  ): Promise<string>;
}

function selectResult(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  };
}

const claims: GoogleClaimsFixture = {
  sub: "google-subject",
  email: "owner.google@example.test",
  email_verified: true,
  name: "Owner Google",
  nonce: "nonce",
};

describe("Google OIDC account linking", () => {
  it("menolak identitas Google yang sudah tertaut ke user lain", async () => {
    const database = {
      db: {
        select: vi.fn().mockReturnValue(selectResult([{ userId: 2 }])),
        transaction: vi.fn(),
      },
    };
    const service = new GoogleOidcService(
      database as never,
      {} as never,
      {} as never,
      {} as never,
    ) as unknown as GoogleResolver;

    await expect(service.resolveUser(claims, formatPublicId(1))).rejects.toMatchObject({
      statusCode: 409,
      code: "GOOGLE_IDENTITY_ALREADY_LINKED",
    });
    expect(database.db.transaction).not.toHaveBeenCalled();
  });

  it("menautkan identitas Google baru ke user yang sedang login", async () => {
    const insertedValues: unknown[] = [];
    const transaction = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockImplementation(async (values: unknown) => {
          insertedValues.push(values);
        }),
      }),
    };
    const database = {
      db: {
        select: vi
          .fn()
          .mockReturnValueOnce(selectResult([]))
          .mockReturnValueOnce(selectResult([])),
        transaction: vi.fn(async (callback: (value: typeof transaction) => unknown) =>
          callback(transaction),
        ),
      },
    };
    const service = new GoogleOidcService(
      database as never,
      {} as never,
      {} as never,
      {} as never,
    ) as unknown as GoogleResolver;

    await expect(service.resolveUser(claims, formatPublicId(1))).resolves.toBe(
      formatPublicId(1),
    );
    expect(insertedValues).toContainEqual({
      userId: 1,
      provider: "GOOGLE",
      providerSubject: claims.sub,
    });
  });
});
