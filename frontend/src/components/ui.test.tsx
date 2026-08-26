import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScenarioBoundary } from "./ui";

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
