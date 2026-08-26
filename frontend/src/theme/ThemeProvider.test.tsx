import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ThemeToggle } from "../components/ThemeToggle";
import { ThemeProvider } from "./ThemeProvider";

describe("ThemeProvider", () => {
  beforeEach(() => {
    window.localStorage.setItem("lapangango-theme", "light");
  });

  afterEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  it("mengganti tema dan menyimpan preferensi pengguna", async () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Aktifkan mode gelap" }),
    );

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("dark");
    });
    expect(window.localStorage.getItem("lapangango-theme")).toBe("dark");
    expect(
      screen.getByRole("button", { name: "Aktifkan mode terang" }),
    ).toBeInTheDocument();
  });
});
