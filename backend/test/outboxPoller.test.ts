import { afterEach, describe, expect, it, vi } from "vitest";
import { OutboxPoller } from "../src/realtime/OutboxPoller.js";

describe("OutboxPoller", () => {
  afterEach(() => vi.useRealTimers());

  it("menerbitkan event berkala tanpa menjalankan batch yang tumpang tindih", async () => {
    vi.useFakeTimers();
    let finishBatch: (() => void) | undefined;
    const publishPending = vi.fn(
      () =>
        new Promise<{ published: number; failed: number }>((resolve) => {
          finishBatch = () => resolve({ published: 1, failed: 0 });
        }),
    );
    const poller = new OutboxPoller({ publishPending }, 250, vi.fn());

    poller.start();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(publishPending).toHaveBeenCalledOnce();

    finishBatch?.();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(250);
    expect(publishPending).toHaveBeenCalledTimes(2);

    poller.stop();
  });

  it("melaporkan kegagalan dan melanjutkan polling berikutnya", async () => {
    vi.useFakeTimers();
    const error = new Error("Redis tidak tersedia");
    const publishPending = vi
      .fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValue({ published: 0, failed: 0 });
    const onError = vi.fn();
    const poller = new OutboxPoller({ publishPending }, 250, onError);

    poller.start();
    await vi.advanceTimersByTimeAsync(250);

    expect(onError).toHaveBeenCalledWith(error);
    expect(publishPending).toHaveBeenCalledTimes(2);
    poller.stop();
  });
});
