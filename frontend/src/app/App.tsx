import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from "react";
import { AppShell } from "../components/AppShell";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  PageTitle,
} from "../components/ui";
import { PrototypeProvider, usePrototype } from "../store/PrototypeStore";
import { SelectField } from "../components/SelectField";
import { criticalPaths, routeRegistry, type RouteDefinition } from "../routes/registry";
import { ForbiddenPage } from "../pages/ForbiddenPage";
import { SupportingPage } from "../pages/SupportingPage";
import { canAccessRoute } from "../domain/access";
import { prototypeModeEnabled } from "../api/apiClient";
import { useSession } from "../api/session";
import {
  AdminMastersPage,
  AdminPaymentOptionsPage,
  AdminSchedulingPage,
  IntegratedAdminAuditPage,
} from "../pages/IntegratedAdminPages";
import { BusinessTeamPage } from "../pages/business/BusinessTeamPage";

const LandingPage = lazyNamed(() => import("../pages/CustomerPages"), "LandingPage");
const VenueSearchPage = lazyNamed(
  () => import("../pages/CustomerPages"),
  "VenueSearchPage",
);
const VenueDetailPage = lazyNamed(
  () => import("../pages/CustomerPages"),
  "VenueDetailPage",
);
const BookingPage = lazyNamed(
  () => import("../pages/customer/BookingPages"),
  "BookingPage",
);
const CheckoutPage = lazyNamed(
  () => import("../pages/customer/BookingPages"),
  "CheckoutPage",
);
const PaymentPage = lazyNamed(
  () => import("../pages/customer/BookingPages"),
  "PaymentPage",
);
const PaymentResultPage = lazyNamed(
  () => import("../pages/customer/BookingPages"),
  "PaymentResultPage",
);
const BookingsPage = lazyNamed(
  () => import("../pages/customer/BookingPages"),
  "BookingsPage",
);
const BookingDetailPage = lazyNamed(
  () => import("../pages/customer/BookingPages"),
  "BookingDetailPage",
);
const MabarListPage = lazyNamed(
  () => import("../pages/customer/MabarPages"),
  "MabarListPage",
);
const MabarDetailPage = lazyNamed(
  () => import("../pages/customer/MabarPages"),
  "MabarDetailPage",
);
const MabarCreatePage = lazyNamed(
  () => import("../pages/customer/MabarPages"),
  "MabarCreatePage",
);
const MabarManagePage = lazyNamed(
  () => import("../pages/customer/MabarPages"),
  "MabarManagePage",
);
const BusinessOverviewPage = lazyNamed(
  () => import("../pages/BusinessPages"),
  "BusinessOverviewPage",
);
const OperationsCalendarPage = lazyNamed(
  () => import("../pages/business/OperationsPages"),
  "OperationsCalendarPage",
);
const OperationsBookingsPage = lazyNamed(
  () => import("../pages/business/OperationsPages"),
  "OperationsBookingsPage",
);
const OfflineBookingPage = lazyNamed(
  () => import("../pages/business/OperationsPages"),
  "OfflineBookingPage",
);
const CheckInPage = lazyNamed(
  () => import("../pages/business/OperationsPages"),
  "CheckInPage",
);
const OutstandingPage = lazyNamed(
  () => import("../pages/business/OperationsPages"),
  "OutstandingPage",
);
const VenuesSetupPage = lazyNamed(
  () => import("../pages/business/VenueSetupPages"),
  "VenuesSetupPage",
);
const VenueSetupDetailPage = lazyNamed(
  () => import("../pages/business/VenueSetupPages"),
  "VenueSetupDetailPage",
);
const AdminDashboardPage = lazyNamed(
  () => import("../pages/AdminPages"),
  "AdminDashboardPage",
);
const AdminVenuesPage = lazyNamed(
  () => import("../pages/AdminPages"),
  "AdminVenuesPage",
);
const TenantsPage = lazyNamed(() => import("../pages/AdminPages"), "TenantsPage");
const VerificationsPage = lazyNamed(
  () => import("../pages/AdminPages"),
  "VerificationsPage",
);
const FavoritesPage = lazyNamed(
  () => import("../pages/CustomerEngagementPages"),
  "FavoritesPage",
);
const NotificationsPage = lazyNamed(
  () => import("../pages/CustomerEngagementPages"),
  "NotificationsPage",
);
const HistoryPage = lazyNamed(
  () => import("../pages/CustomerEngagementPages"),
  "HistoryPage",
);
const ReviewsPage = lazyNamed(
  () => import("../pages/CustomerEngagementPages"),
  "ReviewsPage",
);
const SupportPage = lazyNamed(
  () => import("../pages/CustomerEngagementPages"),
  "SupportPage",
);
const ProfilePage = lazyNamed(
  () => import("../pages/CustomerEngagementPages"),
  "ProfilePage",
);
const LoginPage = lazyNamed(() => import("../pages/AuthPages"), "LoginPage");
const RegisterPage = lazyNamed(() => import("../pages/AuthPages"), "RegisterPage");

function lazyNamed<
  ExportName extends string,
  Module extends Record<ExportName, ComponentType<Record<string, never>>>,
>(
  loader: () => Promise<Module>,
  exportName: ExportName,
): LazyExoticComponent<Module[ExportName]> {
  return lazy(async () => ({ default: (await loader())[exportName] }));
}

export function App() {
  return (
    <PrototypeProvider>
      <AppShell>
        <RouteAccessGate>
          <Suspense fallback={<RouteLoading />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/" element={<LandingPage />} />
              <Route path="/venues" element={<VenueSearchPage />} />
              <Route path="/venues/:slug" element={<VenueDetailPage />} />
              <Route path="/venues/:slug/book" element={<BookingPage />} />
              <Route path="/checkout/:bookingId" element={<CheckoutPage />} />
              <Route path="/payments/:attemptId" element={<PaymentPage />} />
              <Route
                path="/payments/:attemptId/result"
                element={<PaymentResultPage />}
              />
              <Route path="/bookings" element={<BookingsPage />} />
              <Route path="/bookings/:id" element={<BookingDetailPage />} />
              <Route path="/mabar" element={<MabarListPage />} />
              <Route path="/mabar/:id" element={<MabarDetailPage />} />
              <Route path="/mabar/create/:bookingId" element={<MabarCreatePage />} />
              <Route path="/mabar/:id/manage" element={<MabarManagePage />} />
              <Route path="/favorites" element={<FavoritesPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/reviews" element={<ReviewsPage />} />
              <Route path="/support" element={<SupportPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route
                path="/business/:tenant/overview"
                element={<BusinessOverviewPage />}
              />
              <Route
                path="/business/:tenant/operations/calendar"
                element={<OperationsCalendarPage />}
              />
              <Route
                path="/business/:tenant/operations/bookings"
                element={<OperationsBookingsPage />}
              />
              <Route
                path="/business/:tenant/operations/bookings/new-offline"
                element={<OfflineBookingPage />}
              />
              <Route
                path="/business/:tenant/operations/check-in"
                element={<CheckInPage />}
              />
              <Route
                path="/business/:tenant/operations/outstanding"
                element={<OutstandingPage />}
              />
              <Route
                path="/business/:tenant/venues"
                element={
                  <OwnerOnly>
                    <VenuesSetupPage />
                  </OwnerOnly>
                }
              />
              <Route
                path="/business/:tenant/venues/:venueId/profile"
                element={
                  <OwnerOnly>
                    <VenueSetupDetailPage />
                  </OwnerOnly>
                }
              />
              <Route
                path="/business/:tenant/venues/:venueId/courts"
                element={
                  <OwnerOnly>
                    <VenueSetupDetailPage />
                  </OwnerOnly>
                }
              />
              <Route
                path="/business/:tenant/venues/:venueId/availability"
                element={
                  <OwnerOnly>
                    <VenueSetupDetailPage />
                  </OwnerOnly>
                }
              />
              <Route
                path="/business/:tenant/venues/:venueId/pricing"
                element={
                  <OwnerOnly>
                    <VenueSetupDetailPage />
                  </OwnerOnly>
                }
              />
              <Route
                path="/business/:tenant/venues/:venueId/policies"
                element={
                  <OwnerOnly>
                    <VenueSetupDetailPage />
                  </OwnerOnly>
                }
              />
              <Route path="/admin" element={<AdminDashboardPage />} />
              <Route path="/admin/tenants" element={<TenantsPage />} />
              <Route path="/admin/verifications" element={<VerificationsPage />} />
              <Route path="/admin/venues" element={<AdminVenuesPage />} />
              {routeRegistry
                .filter((route) => !criticalPaths.has(route.path))
                .map((route) => (
                  <Route
                    key={route.path}
                    path={route.path}
                    element={<GuardedSupporting route={route} />}
                  />
                ))}
              <Route path="/__design-system" element={<DesignSystemPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </RouteAccessGate>
      </AppShell>
    </PrototypeProvider>
  );
}

function RouteAccessGate({ children }: { children: React.ReactNode }) {
  const { state } = usePrototype();
  const location = useLocation();
  if (location.pathname === "/__design-system") return <>{children}</>;
  const route = routeRegistry.find((candidate) =>
    new RegExp(`^${candidate.path.replace(/:[^/]+/g, "[^/]+")}$`).test(
      location.pathname,
    ),
  );
  if (!route) return <>{children}</>;
  if (!prototypeModeEnabled && route.shell !== "customer") {
    return <AuthenticatedWorkspaceGate>{children}</AuthenticatedWorkspaceGate>;
  }
  return canAccessRoute(state.role, route) ? <>{children}</> : <ForbiddenPage />;
}

function AuthenticatedWorkspaceGate({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const location = useLocation();

  if (session.isLoading) return <RouteLoading />;
  if (!session.data) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }
  if (location.pathname.startsWith("/admin") && !session.data.platformAdmin) {
    return <ForbiddenPage />;
  }
  if (location.pathname.startsWith("/business/")) {
    const tenantId = location.pathname.split("/")[2];
    const membership = session.data.memberships.find(
      (candidate) => candidate.tenantId === tenantId,
    );
    if (!membership) return <ForbiddenPage />;
    const definition = routeRegistry.find((candidate) =>
      new RegExp(`^${candidate.path.replace(/:[^/]+/g, "[^/]+")}$`).test(
        location.pathname,
      ),
    );
    if (membership.role === "STAFF" && definition?.staff === "forbidden") {
      return <ForbiddenPage />;
    }
  }
  return <>{children}</>;
}

function OwnerOnly({ children }: { children: React.ReactNode }) {
  const { state } = usePrototype();
  const session = useSession();
  const location = useLocation();
  if (!prototypeModeEnabled) {
    const tenantId = location.pathname.split("/")[2];
    const membership = session.data?.memberships.find(
      (candidate) => candidate.tenantId === tenantId,
    );
    return membership?.role === "STAFF" ? <ForbiddenPage /> : <>{children}</>;
  }
  return state.role === "staff" ? <ForbiddenPage /> : <>{children}</>;
}
function GuardedSupporting({ route }: { route: RouteDefinition }) {
  const { state } = usePrototype();
  if (prototypeModeEnabled && state.role === "staff" && route.staff === "forbidden")
    return <ForbiddenPage />;
  if (!prototypeModeEnabled && route.path === "/admin/masters/sports") {
    return <AdminMastersPage kind="sport" />;
  }
  if (!prototypeModeEnabled && route.path === "/admin/masters/facilities") {
    return <AdminMastersPage kind="facility" />;
  }
  if (!prototypeModeEnabled && route.path === "/admin/masters/scheduling") {
    return <AdminSchedulingPage />;
  }
  if (!prototypeModeEnabled && route.path === "/admin/templates/payments") {
    return <AdminPaymentOptionsPage />;
  }
  if (!prototypeModeEnabled && route.path === "/admin/audit") {
    return <IntegratedAdminAuditPage />;
  }
  if (!prototypeModeEnabled && route.path === "/business/:tenant/team") {
    return <BusinessTeamPage />;
  }
  return <SupportingPage route={route} />;
}

function RouteLoading() {
  return (
    <div className="content-container route-loading">
      <LoadingState
        variant="page"
        title="Memuat halaman…"
        description="Menyiapkan tampilan yang kamu pilih."
      />
    </div>
  );
}

function NotFound() {
  return (
    <div className="content-container">
      <EmptyState
        title="Halaman tidak ditemukan"
        description="Route ini tidak termasuk dalam 66 route Phase A."
      />
    </div>
  );
}
function DesignSystemPage() {
  return (
    <div className="content-container design-system">
      <PageTitle
        eyebrow="A-011"
        title="LapanganGo Design System"
        description="Token dan primitive internal untuk Customer, Business, dan Admin."
      />
      <section>
        <h2>Tombol</h2>
        <div className="demo-row">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button disabled>Disabled</Button>
        </div>
      </section>
      <section>
        <h2>Form controls</h2>
        <div className="demo-row">
          <Input placeholder="Input default" />
          <Input aria-invalid placeholder="Validation error" />
          <SelectField
            ariaLabel="Contoh select"
            defaultValue="example"
            options={[{ value: "example", label: "Select option" }]}
          />
        </div>
      </section>
      <section>
        <h2>Status semantic</h2>
        <div className="demo-row">
          <Badge tone="success">Berhasil</Badge>
          <Badge tone="warning">Menunggu</Badge>
          <Badge tone="danger">Gagal</Badge>
          <Badge tone="info">Simulasi</Badge>
          <Badge>Netral</Badge>
        </div>
      </section>
      <section>
        <h2>State components</h2>
        <div className="demo-state-grid">
          <EmptyState />
          <ErrorState />
        </div>
      </section>
      <section>
        <h2>Cards</h2>
        <div className="metric-grid">
          <Card>
            <span>Booking</span>
            <strong>24</strong>
            <small>Data simulasi</small>
          </Card>
          <Card>
            <span>Okupansi</span>
            <strong>78%</strong>
            <small>+8% minggu ini</small>
          </Card>
        </div>
      </section>
    </div>
  );
}
