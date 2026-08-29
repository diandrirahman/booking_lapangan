import { fireEvent, render, screen } from "@testing-library/react";
import { Clock3 } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { AttentionCard, SandboxVolumeCard } from "./DashboardInsightCards";

describe("DashboardInsightCards", () => {
  it("menjalankan tindakan dari item perhatian", () => {
    const onClick = vi.fn();

    render(
      <AttentionCard
        description="Prioritas operasional hari ini."
        items={[
          {
            icon: Clock3,
            value: "2 booking",
            label: "menunggu konfirmasi",
            status: "Tinjau",
            tone: "warning",
            onClick,
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /2 booking/i }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("menjelaskan batas sandbox tanpa menyiratkan transaksi nyata", () => {
    render(<SandboxVolumeCard amount="Rp 1.250.000" />);

    expect(screen.getByText("Rp 1.250.000")).toBeInTheDocument();
    expect(screen.getByText(/tidak ada dana nyata/i)).toBeInTheDocument();
  });
});
