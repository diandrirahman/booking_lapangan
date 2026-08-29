import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PaymentStatusPanel } from "./PaymentStatusPanel";

describe("PaymentStatusPanel", () => {
  afterEach(cleanup);

  it("menampilkan status dan ringkasan payment attempt", () => {
    render(
      <PaymentStatusPanel
        attemptId="7025"
        bookingId="5012"
        amount="Rp 220.000"
        kind="FULL"
        status="PENDING"
        onSimulate={() => undefined}
      />,
    );

    expect(screen.getByText("Pembayaran sedang diproses")).toBeInTheDocument();
    expect(screen.getByText("Transaksi #7025")).toBeInTheDocument();
    expect(screen.getByText("Rp 220.000")).toBeInTheDocument();
    expect(screen.getByText("Bayar penuh")).toBeInTheDocument();
  });

  it("meneruskan hasil simulasi yang dipilih", () => {
    const onSimulate = vi.fn();
    render(
      <PaymentStatusPanel
        attemptId="7025"
        bookingId="5012"
        amount="Rp 220.000"
        kind="DP"
        status="CREATED"
        onSimulate={onSimulate}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /berhasil/i }));
    expect(onSimulate).toHaveBeenCalledWith("success");
  });
});
