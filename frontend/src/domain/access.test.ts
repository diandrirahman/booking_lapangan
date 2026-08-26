import { describe, expect, it } from "vitest";
import { canAccessRoute, entryRouteForRole } from "./access";
import type { RouteDefinition } from "../routes/registry";

const customerRoute: RouteDefinition = {
  path: "/venues",
  title: "Cari Venue",
  section: "Jelajah",
  shell: "customer",
};
const ownerRoute: RouteDefinition = {
  path: "/business/:tenant/venues",
  title: "Kelola Venue",
  section: "Venue",
  shell: "business",
  staff: "forbidden",
};
const staffRoute: RouteDefinition = {
  path: "/business/:tenant/operations/bookings",
  title: "Daftar Booking",
  section: "Operasional",
  shell: "business",
  staff: "allow",
};

describe("permission matrix", () => {
  it("membatasi route lintas shell", () => {
    expect(canAccessRoute("customer", customerRoute)).toBe(true);
    expect(canAccessRoute("owner", customerRoute)).toBe(false);
    expect(canAccessRoute("staff", ownerRoute)).toBe(false);
    expect(canAccessRoute("staff", staffRoute)).toBe(true);
    expect(canAccessRoute("admin", staffRoute)).toBe(false);
  });

  it("memberikan entry route yang stabil untuk setiap role", () => {
    expect(entryRouteForRole("customer")).toBe("/");
    expect(entryRouteForRole("owner")).toContain("/business/");
    expect(entryRouteForRole("staff")).toContain("/business/");
    expect(entryRouteForRole("admin")).toBe("/admin");
  });
});
