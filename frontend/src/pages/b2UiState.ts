export function nextPayoutStatus(status: unknown): "PROCESSING" | "SUCCEEDED" | null {
  if (status === "SCHEDULED") return "PROCESSING";
  if (status === "PROCESSING") return "SUCCEEDED";
  return null;
}

export function b2ItemTitle(item: Record<string, unknown>): string {
  return String(
    item.name ??
      item.code ??
      item.subject ??
      item.description ??
      item.comment ??
      item.reason ??
      item.kind ??
      item.title ??
      item.id,
  );
}

export function b2ItemAmount(item: Record<string, unknown>): number {
  const directAmount = item.amount ?? item.totalAmount;
  if (typeof directAmount === "number") return directAmount;
  if (!Array.isArray(item.entries)) return 0;
  return item.entries.reduce(
    (total, entry) =>
      total +
      (typeof entry === "object" && entry !== null && "debit" in entry
        ? Number(entry.debit)
        : 0),
    0,
  );
}
