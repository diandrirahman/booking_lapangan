import { describe, expect, it } from "vitest";
import { routeRegistry } from "./registry";
import { criticalPaths } from "./registry";
import { supportingDomainPaths } from "../pages/SupportingPage";

describe("routeRegistry", () => {
  it("mendaftarkan tepat 66 route PRD", () => {
    expect(routeRegistry).toHaveLength(66);
    expect(new Set(routeRegistry.map((route) => route.path)).size).toBe(66);
  });

  it("memberi konfigurasi domain khusus untuk seluruh supporting route", () => {
    const supportingRoutes = routeRegistry.filter(
      (route) => !criticalPaths.has(route.path),
    );
    expect(supportingRoutes).toHaveLength(35);
    expect(
      supportingRoutes.every((route) => supportingDomainPaths.has(route.path)),
    ).toBe(true);
  });

  it("menetapkan matriks Staff pada semua route Business", () => {
    expect(
      routeRegistry
        .filter((route) => route.shell === "business")
        .every(
          (route) => route.staff === "allow" || route.staff === "forbidden",
        ),
    ).toBe(true);
  });
});
