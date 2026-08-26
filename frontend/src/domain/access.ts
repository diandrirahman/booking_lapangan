import type { PrototypeRole } from "./types";
import type { RouteDefinition, Shell } from "../routes/registry";

export function shellForRole(role: PrototypeRole): Shell {
  if (role === "customer") return "customer";
  if (role === "admin") return "admin";
  return "business";
}

export function canAccessRoute(
  role: PrototypeRole,
  route: RouteDefinition,
): boolean {
  if (route.shell !== shellForRole(role)) return false;
  return !(role === "staff" && route.staff === "forbidden");
}

export function entryRouteForRole(role: PrototypeRole): string {
  if (role === "customer") return "/";
  if (role === "admin") return "/admin";
  return "/business/cendana/overview";
}
