import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OperationsCalendar, type OperationsCalendarEvent } from "./OperationsCalendar";

const event: OperationsCalendarEvent = {
  id: "booking-1",
  startsAt: "2026-08-19T08:00:00.000Z",
  endsAt: "2026-08-19T09:00:00.000Z",
  title: "Hoops House Kemang · Lapangan 2",
  detail: "Rizky Ramadhan · CONFIRMED",
  venueId: "venue-1",
  kind: "booking",
  tone: "confirmed",
};

describe("OperationsCalendar", () => {
  afterEach(cleanup);

  it("membuka dengan tampilan bulan dan mempertahankan semua kontrol aktif", () => {
    renderCalendar();

    expect(screen.getByRole("button", { name: "Bulan" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Booking offline" })).toBeVisible();
    expect(screen.getByRole("button", { name: /Hoops House Kemang/i })).toBeVisible();
  });

  it("membuka tampilan hari dari tanggal dan meneruskan event yang dipilih", () => {
    const onSelectEvent = vi.fn();
    renderCalendar(onSelectEvent);

    fireEvent.click(screen.getByRole("button", { name: /19 Agustus 2026/i }));

    expect(screen.getByRole("button", { name: "Hari" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: /Hoops House Kemang/i }));
    expect(onSelectEvent).toHaveBeenCalledWith(event);
  });

  it("mengganti tampilan minggu dan daftar tanpa tombol pajangan", () => {
    renderCalendar();

    fireEvent.click(screen.getByRole("button", { name: "Minggu" }));
    expect(screen.getByRole("button", { name: "Minggu" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: "Daftar" }));
    expect(screen.getByRole("button", { name: "Daftar" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText(/Rabu, 19 Agustus/i)).toBeInTheDocument();
  });
});

function renderCalendar(onSelectEvent = vi.fn()) {
  render(
    <OperationsCalendar
      month={new Date("2026-08-01T00:00:00.000Z")}
      events={[event]}
      venues={[{ id: "venue-1", name: "Hoops House Kemang" }]}
      actions={<button type="button">Booking offline</button>}
      onPreviousMonth={() => undefined}
      onNextMonth={() => undefined}
      onToday={() => undefined}
      onSelectEvent={onSelectEvent}
    />,
  );
}
