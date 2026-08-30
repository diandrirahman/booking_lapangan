import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "../api/apiClient";
import { NotificationPreferencesCard } from "./B2SettingsPages";

vi.mock("../api/apiClient", () => ({
  apiClient: {
    listNotificationPreferences: vi.fn(),
    updateNotificationPreference: vi.fn(),
  },
}));

const listNotificationPreferences = vi.mocked(apiClient.listNotificationPreferences);
const updateNotificationPreference = vi.mocked(apiClient.updateNotificationPreference);

describe("NotificationPreferencesCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("menunggu refetch authoritative sebelum mengubah checkbox", async () => {
    const user = userEvent.setup();
    const mutation = deferred<void>();
    listNotificationPreferences
      .mockResolvedValueOnce({
        items: [{ eventType: "booking.reminder", channel: "EMAIL", enabled: true }],
      })
      .mockResolvedValueOnce({
        items: [{ eventType: "booking.reminder", channel: "EMAIL", enabled: false }],
      });
    updateNotificationPreference.mockReturnValueOnce(mutation.promise);
    renderPreferences();

    const checkbox = await screen.findByRole("checkbox", {
      name: "Reminder bermain melalui email",
    });
    expect(checkbox).toBeChecked();
    await user.click(checkbox);
    expect(checkbox).toBeChecked();
    expect(checkbox).toBeDisabled();
    expect(updateNotificationPreference).toHaveBeenCalledWith({
      eventType: "booking.reminder",
      channel: "EMAIL",
      enabled: false,
    });

    mutation.resolve();
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Preferensi berhasil disimpan.",
      ),
    );
    await waitFor(() => expect(checkbox).not.toBeChecked());
  });

  it("menampilkan error dan mempertahankan state server", async () => {
    const user = userEvent.setup();
    listNotificationPreferences.mockResolvedValue({
      items: [{ eventType: "booking.reminder", channel: "EMAIL", enabled: true }],
    });
    updateNotificationPreference.mockRejectedValueOnce(
      new Error("Preferensi gagal disimpan"),
    );
    renderPreferences();

    const checkbox = await screen.findByRole("checkbox", {
      name: "Reminder bermain melalui email",
    });
    await user.click(checkbox);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Preferensi gagal disimpan",
    );
    expect(checkbox).toBeChecked();
  });
});

function renderPreferences() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <NotificationPreferencesCard />
    </QueryClientProvider>,
  );
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
