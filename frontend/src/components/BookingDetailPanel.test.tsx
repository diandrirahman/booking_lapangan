import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BookingDetailPanel } from "./BookingDetailPanel";

describe("BookingDetailPanel", () => {
  afterEach(cleanup);

  it("menampilkan ringkasan booking dan pass simulasi", () => {
    render(
      <BookingDetailPanel
        bookingCode="1053"
        title="Arena Cendana"
        subtitle="Lapangan 1"
        schedule="28 Agustus 2026, 19.00"
        location="Jakarta Selatan"
        status={{ label: "Terkonfirmasi", tone: "success" }}
        payment={{
          method: "Bayar penuh",
          status: "Lunas",
          total: "Rp 100.000",
          balance: "Rp 0",
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Arena Cendana" })).toBeVisible();
    expect(screen.getByText("28 Agustus 2026, 19.00")).toBeVisible();
    expect(screen.getByText("Terkonfirmasi")).toBeVisible();
    expect(screen.getByText("1053")).toBeVisible();
    expect(screen.getByLabelText("Pass check-in simulasi")).toBeVisible();
  });

  it("tetap rapi ketika detail venue belum tersedia", () => {
    render(
      <BookingDetailPanel
        bookingCode="1053"
        title="Reservasi #1053"
        status={{ label: "Menunggu", tone: "warning" }}
        payment={{
          method: "DP 50%",
          status: "Dibayar sebagian",
          total: "Rp 200.000",
          balance: "Rp 100.000",
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Reservasi #1053" })).toBeVisible();
    expect(screen.queryByText("Jadwal")).not.toBeInTheDocument();
    expect(screen.getByText("Rp 100.000")).toBeVisible();
  });
});
