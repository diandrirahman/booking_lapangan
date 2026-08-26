import { Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  PageTitle,
} from "../components/ui";
import { PrototypeProvider, usePrototype } from "../store/PrototypeStore";
import { SelectField } from "../components/SelectField";
import {
  criticalPaths,
  routeRegistry,
  type RouteDefinition,
} from "../routes/registry";
import {
  LandingPage,
  VenueDetailPage,
  VenueSearchPage,
} from "../pages/CustomerPages";
import {
  BookingDetailPage,
  BookingPage,
  BookingsPage,
  CheckoutPage,
  PaymentPage,
  PaymentResultPage,
} from "../pages/customer/BookingPages";
import {
  MabarCreatePage,
  MabarDetailPage,
  MabarListPage,
  MabarManagePage,
} from "../pages/customer/MabarPages";
import { BusinessOverviewPage, ForbiddenPage } from "../pages/BusinessPages";
import {
  CheckInPage,
  OfflineBookingPage,
  OperationsBookingsPage,
  OperationsCalendarPage,
  OutstandingPage,
} from "../pages/business/OperationsPages";
import {
  VenuesSetupPage,
  VenueSetupDetailPage,
} from "../pages/business/VenueSetupPages";
import {
  AdminDashboardPage,
  AdminVenuesPage,
  TenantsPage,
  VerificationsPage,
} from "../pages/AdminPages";
import { SupportingPage } from "../pages/SupportingPage";
import {
  FavoritesPage,
  NotificationsPage,
} from "../pages/CustomerEngagementPages";
import { canAccessRoute } from "../domain/access";

export function App() {
  return (
    <PrototypeProvider>
      <AppShell>
        <RouteAccessGate>
          <Routes>
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
            <Route
              path="/mabar/create/:bookingId"
              element={<MabarCreatePage />}
            />
            <Route path="/mabar/:id/manage" element={<MabarManagePage />} />
            <Route path="/favorites" element={<FavoritesPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
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
            <Route
              path="/admin/verifications"
              element={<VerificationsPage />}
            />
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
  return canAccessRoute(state.role, route) ? (
    <>{children}</>
  ) : (
    <ForbiddenPage />
  );
}

function OwnerOnly({ children }: { children: React.ReactNode }) {
  const { state } = usePrototype();
  return state.role === "staff" ? <ForbiddenPage /> : <>{children}</>;
}
function GuardedSupporting({ route }: { route: RouteDefinition }) {
  const { state } = usePrototype();
  if (state.role === "staff" && route.staff === "forbidden")
    return <ForbiddenPage />;
  return <SupportingPage route={route} />;
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
