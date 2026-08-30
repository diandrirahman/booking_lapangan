import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LoadingState, ScenarioBoundary } from "./ui";

afterEach(cleanup);

describe("LoadingState", () => {
  it.each([
    ["page", "Memuat halaman…"],
    ["panel", "Memuat data…"],
    ["inline", "Memuat slot…"],
  ] as const)("merender variant %s secara aksesibel", (variant, title) => {
    const { container } = render(<LoadingState variant={variant} title={title} />);

    expect(screen.getByRole("status")).toHaveAttribute("data-loading-variant", variant);
    expect(screen.getByRole("heading", { name: title })).toBeVisible();
    expect(
      container.querySelector(
        variant === "inline" ? ".loading-pulse" : ".loading-ring",
      ),
    ).toBeInTheDocument();
  });
});

describe("ScenarioBoundary", () => {
  it.each([
    ["validation-error", "Periksa kembali data yang diisi"],
    ["expired", "Sesi simulasi sudah berakhir"],
    ["stale", "Data simulasi perlu diperbarui"],
    ["reconnecting", "Menyambungkan ulang fixture lokal"],
    ["unauthorized", "Akses untuk role ini dibatasi"],
    ["success", "Perubahan berhasil disimpan"],
  ])("merender scenario %s", (scenario, title) => {
    render(
      <ScenarioBoundary scenario={scenario}>
        <p>Konten baseline</p>
      </ScenarioBoundary>,
    );
    expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
  });
});
