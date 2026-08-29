import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const demoPassword = process.env.SEED_DEMO_PASSWORD ?? "LapanganGo-E2E-123";
const maximumRealtimeLatencyMs = 2_000;
const measurementSampleCount = 3;
const evidenceDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../docs/phase-b1/qa/evidence/2026-08-28-b1-local-readiness",
);

interface RealtimeMeasurement {
  bookingId: string;
  automaticLatencyMs: number | null;
  recoveryLatencyMs: number | null;
  maintenanceStatus: number | null;
  maintenanceBody: unknown;
}

test("@manual realtime event booking terlihat maksimal dua detik", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-1440x900",
    "Pengukuran mutasi dijalankan satu kali agar data QA tidak diduplikasi.",
  );

  await loginAsOwner(page);
  const tenantId = await firstWorkspaceId(page);
  const measurements: RealtimeMeasurement[] = [];
  for (let index = 0; index < measurementSampleCount; index += 1) {
    measurements.push(await measureBookingEvent(page, tenantId));
  }
  const evidence = {
    targetLatencyMs: maximumRealtimeLatencyMs,
    maximumLatencyMs: Math.max(
      ...measurements.map(
        (measurement) => measurement.automaticLatencyMs ?? maximumRealtimeLatencyMs + 1,
      ),
    ),
    measurements,
  };
  await mkdir(evidenceDirectory, { recursive: true });
  await writeFile(
    path.join(evidenceDirectory, "realtime-measurement.json"),
    `${JSON.stringify(evidence, null, 2)}\n`,
    "utf8",
  );

  await testInfo.attach("realtime-measurement.json", {
    body: Buffer.from(JSON.stringify(evidence, null, 2)),
    contentType: "application/json",
  });

  for (const measurement of measurements) {
    expect(measurement.bookingId).toMatch(/^LG-[A-Za-z0-9_-]{16}$/);
    expect(
      measurement.automaticLatencyMs,
      `Event otomatis tidak diterima dalam ${maximumRealtimeLatencyMs} ms. ` +
        `Recovery latency: ${measurement.recoveryLatencyMs ?? "tidak diterima"} ms.`,
    ).not.toBeNull();
    expect(measurement.automaticLatencyMs!).toBeLessThanOrEqual(
      maximumRealtimeLatencyMs,
    );
  }
});

async function loginAsOwner(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill("andika.pratama@lapangango.test");
  await page.locator("#login-password").fill(demoPassword);
  const responsePromise = page.waitForResponse("**/api/v1/auth/login");
  await page.getByRole("button", { name: "Masuk" }).click();
  expect((await responsePromise).status()).toBe(200);
}

async function firstWorkspaceId(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const response = await fetch("/api/v1/business/workspaces");
    if (!response.ok) throw new Error("Workspace realtime QA tidak dapat dimuat.");
    const body = (await response.json()) as { items: Array<{ tenantId: string }> };
    const tenantId = body.items[0]?.tenantId;
    if (!tenantId) throw new Error("Workspace realtime QA tidak tersedia.");
    return tenantId;
  });
}

async function measureBookingEvent(
  page: Page,
  tenantId: string,
): Promise<RealtimeMeasurement> {
  return page.evaluate(
    async ({ tenantId, timeoutMs }) => {
      interface VenueSummary {
        id: string;
      }
      interface Court {
        id: string;
      }
      interface VenueDetail {
        id: string;
        courts: Court[];
      }
      interface Slot {
        id: string;
        status: string;
      }
      interface Booking {
        id: string;
      }
      async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
        const response = await fetch(url, init);
        const text = await response.text();
        if (!response.ok) {
          throw new Error(`${response.status} ${url}: ${text}`);
        }
        return (text ? JSON.parse(text) : {}) as T;
      }

      async function findReservableSlot(): Promise<{
        venueId: string;
        courtId: string;
        slotId: string;
      }> {
        const venues = await requestJson<{ items: VenueSummary[] }>(
          `/api/v1/business/venues?tenantId=${encodeURIComponent(tenantId)}`,
        );
        for (const venue of venues.items) {
          const detail = await requestJson<VenueDetail>(
            `/api/v1/business/venues/${encodeURIComponent(venue.id)}?tenantId=${encodeURIComponent(tenantId)}`,
          );
          for (const court of detail.courts) {
            for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
              const date = new Date();
              date.setUTCDate(date.getUTCDate() + dayOffset);
              const localDate = date.toISOString().slice(0, 10);
              const availability = await requestJson<{ items: Slot[] }>(
                `/api/v1/availability?courtId=${encodeURIComponent(court.id)}&date=${localDate}`,
              );
              const slot = availability.items.find(
                (item) => item.status === "AVAILABLE",
              );
              if (slot)
                return { venueId: venue.id, courtId: court.id, slotId: slot.id };
            }
          }
        }
        throw new Error("Tidak ada slot yang dapat dipakai untuk realtime QA.");
      }

      const target = await findReservableSlot();
      const eventSource = new EventSource(
        `/api/v1/events?tenantId=${encodeURIComponent(tenantId)}`,
      );
      await new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(
          () => reject(new Error("SSE tidak mengirim ready event.")),
          5_000,
        );
        eventSource.addEventListener(
          "ready",
          () => {
            window.clearTimeout(timer);
            resolve();
          },
          { once: true },
        );
      });

      let resolveBookingEvent: ((receivedAt: number) => void) | undefined;
      const bookingEvent = new Promise<number>((resolve) => {
        resolveBookingEvent = resolve;
      });
      eventSource.addEventListener("booking.created", () => {
        resolveBookingEvent?.(performance.now());
      });

      const mutationStartedAt = performance.now();
      const booking = await requestJson<Booking>("/api/v1/business/bookings/offline", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          tenantId,
          venueId: target.venueId,
          courtId: target.courtId,
          slotIds: [target.slotId],
          paymentMode: "PAY_AT_VENUE",
          customer: {
            name: "Rizky Pratama QA",
            phone: "+6281212349988",
            channel: "QA_REALTIME",
          },
        }),
      });

      const automaticReceivedAt = await Promise.race([
        bookingEvent,
        new Promise<null>((resolve) =>
          window.setTimeout(() => resolve(null), timeoutMs),
        ),
      ]);

      let recoveryLatencyMs: number | null = null;
      let maintenanceStatus: number | null = null;
      let maintenanceBody: unknown = null;
      if (automaticReceivedAt === null) {
        const recoveryStartedAt = performance.now();
        const maintenanceResponse = await fetch("/api/v1/internal/jobs/maintenance", {
          method: "POST",
          headers: { Authorization: "Bearer local-cron-secret" },
        });
        maintenanceStatus = maintenanceResponse.status;
        const maintenanceText = await maintenanceResponse.text();
        maintenanceBody = maintenanceText ? JSON.parse(maintenanceText) : null;
        const recoveredAt = await Promise.race([
          bookingEvent,
          new Promise<null>((resolve) =>
            window.setTimeout(() => resolve(null), timeoutMs),
          ),
        ]);
        recoveryLatencyMs =
          recoveredAt === null ? null : Math.round(recoveredAt - recoveryStartedAt);
      }

      eventSource.close();
      return {
        bookingId: booking.id,
        automaticLatencyMs:
          automaticReceivedAt === null
            ? null
            : Math.round(automaticReceivedAt - mutationStartedAt),
        recoveryLatencyMs,
        maintenanceStatus,
        maintenanceBody,
      };
    },
    { tenantId, timeoutMs: maximumRealtimeLatencyMs },
  );
}
