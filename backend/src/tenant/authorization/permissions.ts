export const PERMISSION_CODES = [
  "operations.view",
  "bookings.manage",
  "attendance.manage",
  "payments.manage",
  "schedule.manage",
  "venues.manage",
  "pricing.manage",
  "finance.view",
  "refunds.manage",
  "payouts.view",
  "promotions.manage",
  "reviews.manage",
  "support.manage",
  "team.manage",
  "exports.run",
] as const;

export type PermissionCode = (typeof PERMISSION_CODES)[number];

export const ROLE_TEMPLATES: ReadonlyArray<{
  code: string;
  name: string;
  permissions: readonly PermissionCode[];
}> = [
  {
    code: "VENUE_MANAGER",
    name: "Venue Manager",
    permissions: [
      "operations.view",
      "bookings.manage",
      "attendance.manage",
      "payments.manage",
      "schedule.manage",
      "venues.manage",
      "pricing.manage",
      "promotions.manage",
      "reviews.manage",
      "support.manage",
    ],
  },
  {
    code: "BOOKING_OPERATOR",
    name: "Operator Booking",
    permissions: ["operations.view", "bookings.manage", "attendance.manage"],
  },
  {
    code: "CASHIER",
    name: "Kasir",
    permissions: ["operations.view", "payments.manage"],
  },
  {
    code: "FINANCE",
    name: "Finance",
    permissions: ["finance.view", "refunds.manage", "payouts.view", "exports.run"],
  },
  {
    code: "SCHEDULE_MANAGER",
    name: "Schedule Manager",
    permissions: ["operations.view", "schedule.manage"],
  },
] as const;
