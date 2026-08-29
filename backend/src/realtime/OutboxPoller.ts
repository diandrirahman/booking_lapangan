export interface PendingEventPublisher {
  publishPending(limit?: number): Promise<{ published: number; failed: number }>;
}

export type OutboxPollerErrorHandler = (error: unknown) => void;

export class OutboxPoller {
  private timer: NodeJS.Timeout | undefined;
  private isPublishing = false;

  constructor(
    private readonly publisher: PendingEventPublisher,
    private readonly intervalMs: number,
    private readonly onError: OutboxPollerErrorHandler,
  ) {}

  start(): void {
    if (this.timer) return;

    void this.publishOnce();
    this.timer = setInterval(() => void this.publishOnce(), this.intervalMs);
    this.timer.unref();
  }

  stop(): void {
    if (!this.timer) return;

    clearInterval(this.timer);
    this.timer = undefined;
  }

  private async publishOnce(): Promise<void> {
    if (this.isPublishing) return;

    this.isPublishing = true;
    try {
      await this.publisher.publishPending();
    } catch (error) {
      this.onError(error);
    } finally {
      this.isPublishing = false;
    }
  }
}
