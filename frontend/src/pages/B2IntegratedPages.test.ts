import { describe, expect, it } from "vitest";
import { formatReminderLeadTime } from "./B2SettingsPages";
import {
  canExportFinance,
  contextualExportDataset,
  financeExportFormatOptions,
  financeExportOptions,
  humanizeStatus,
  ownerItemAmount,
  ownerItemDescription,
} from "./B2IntegratedPages";
import { b2ItemAmount, b2ItemTitle, nextPayoutStatus } from "./b2UiState";

describe("nextPayoutStatus", () => {
  it("hanya menawarkan transisi payout non-terminal", () => {
    expect(nextPayoutStatus("SCHEDULED")).toBe("PROCESSING");
    expect(nextPayoutStatus("PROCESSING")).toBe("SUCCEEDED");
    expect(nextPayoutStatus("SUCCEEDED")).toBeNull();
    expect(nextPayoutStatus("FAILED")).toBeNull();
    expect(nextPayoutStatus("CANCELLED")).toBeNull();
  });
});

describe("B2 item presentation", () => {
  it("menampilkan deskripsi ledger dan total debit sebagai nilai transaksi", () => {
    const item = {
      id: "opaque-id",
      description: "Pembayaran booking LG-123",
      entries: [
        { debit: 125_000, credit: 0 },
        { debit: 0, credit: 125_000 },
      ],
    };

    expect(b2ItemTitle(item)).toBe("Pembayaran booking LG-123");
    expect(b2ItemAmount(item)).toBe(125_000);
  });

  it("memberi konteks khusus sesuai resource, bukan menampilkan data mentah", () => {
    expect(
      ownerItemDescription("promotions", {
        code: "MAIN10",
        discountType: "PERCENT",
        discountValue: 1_000,
      }),
    ).toBe("Kode MAIN10 · Diskon 10%");
    expect(
      ownerItemDescription("reviews", {
        rating: 5,
        comment: "Venue bersih dan nyaman.",
      }),
    ).toBe("5/5 · Venue bersih dan nyaman.");
    expect(ownerItemAmount("reviews", { amount: 0 })).toBeNull();
  });

  it("mengubah status server menjadi label yang mudah dibaca", () => {
    expect(humanizeStatus("MANUAL_REQUIRED")).toBe("Perlu ditinjau");
    expect(humanizeStatus("WAITING_CUSTOMER")).toBe("Menunggu pelanggan");
  });
});

describe("finance export presentation", () => {
  it("hanya menampilkan ekspor kontekstual untuk dataset yang sesuai halaman", () => {
    expect(contextualExportDataset("payments")).toBe("payments");
    expect(contextualExportDataset("refunds")).toBe("refunds");
    expect(contextualExportDataset("payouts")).toBe("payouts");
    expect(contextualExportDataset("promotions")).toBe("promotions");
    expect(contextualExportDataset("ledger")).toBeNull();
    expect(contextualExportDataset("reviews")).toBeNull();
    expect(contextualExportDataset("support")).toBeNull();
  });

  it("menyediakan tepat tujuh dataset export yang diwajibkan PRD", () => {
    expect(financeExportOptions.map((option) => option.value)).toEqual([
      "bookings",
      "payments",
      "refunds",
      "payouts",
      "promotions",
      "staff-activity",
      "offline-bookings",
    ]);
    expect(financeExportFormatOptions.map((option) => option.value)).toEqual([
      "csv",
      "xlsx",
    ]);
  });

  it("menyembunyikan export dari staff tanpa exports.run", () => {
    expect(canExportFinance({ role: "OWNER", permissions: [] })).toBe(true);
    expect(canExportFinance({ role: "STAFF", permissions: ["finance.view"] })).toBe(
      false,
    );
    expect(canExportFinance({ role: "STAFF", permissions: ["exports.run"] })).toBe(
      true,
    );
  });
});

describe("formatReminderLeadTime", () => {
  it("menampilkan durasi reminder tanpa pecahan jam", () => {
    expect(formatReminderLeadTime(30)).toBe("30 menit sebelum");
    expect(formatReminderLeadTime(120)).toBe("2 jam sebelum");
    expect(formatReminderLeadTime(90)).toBe("1 jam 30 menit sebelum");
  });
});
