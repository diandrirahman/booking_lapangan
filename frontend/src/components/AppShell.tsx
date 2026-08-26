import {
  Bell,
  Building2,
  CalendarDays,
  ChevronDown,
  Heart,
  Home,
  LayoutDashboard,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  ShieldCheck,
  TicketCheck,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { roleLabels } from "../data/fixtures";
import { routeRegistry } from "../routes/registry";
import { usePrototype } from "../store/PrototypeStore";
import { PrototypeControls } from "./PrototypeControls";
import { ThemeToggle } from "./ThemeToggle";
import { NotificationInbox } from "./NotificationInbox";

const customerNav = [
  ["Beranda", "/", Home],
  ["Cari", "/venues", Search],
  ["Booking", "/bookings", TicketCheck],
  ["Mabar", "/mabar", Users],
  ["Favorit", "/favorites", Heart],
] as const;
const businessIcons = [
  LayoutDashboard,
  CalendarDays,
  TicketCheck,
  Building2,
  WalletCards,
  Users,
];
const adminIcons = [
  LayoutDashboard,
  ShieldCheck,
  Building2,
  Users,
  WalletCards,
  Bell,
];

export function AppShell({ children }: { children: ReactNode }) {
  const { state } = usePrototype();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const activeTenant =
    state.tenants.find((tenant) => tenant.id === state.activeTenantId) ??
    state.tenants[0];
  const shell = location.pathname.startsWith("/admin")
    ? "admin"
    : location.pathname.startsWith("/business")
      ? "business"
      : "customer";
  if (shell === "customer")
    return (
      <div className="customer-shell">
        <header className="customer-header">
          <Link to="/" className="brand" aria-label="LapanganGo beranda">
            <span className="brand-mark">LG</span>
            <span>
              Lapangan<strong>Go</strong>
            </span>
          </Link>
          <nav className="desktop-nav" aria-label="Navigasi customer">
            {customerNav.slice(0, 4).map(([label, to]) => (
              <NavLink end={to === "/"} key={to} to={to}>
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="header-actions">
            <ThemeToggle />
            <Link
              className="icon-button desktop-only"
              to="/favorites"
              aria-label="Favorit"
            >
              <Heart />
            </Link>
            <NotificationInbox />
            <PrototypeControls />
          </div>
        </header>
        <main>{children}</main>
        <nav className="bottom-nav" aria-label="Navigasi mobile">
          {customerNav.map(([label, to, Icon]) => (
            <NavLink end={to === "/"} key={to} to={to}>
              <Icon />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        {state.toast && (
          <div className="toast" role="status">
            {state.toast}
          </div>
        )}
      </div>
    );
  const definitions = routeRegistry.filter(
    (route) =>
      route.shell === shell &&
      !(state.role === "staff" && route.staff === "forbidden"),
  );
  const grouped = Array.from(
    new Map(
      definitions.map((item) => [
        item.section,
        definitions.filter((candidate) => candidate.section === item.section),
      ]),
    ).entries(),
  );
  const icons = shell === "admin" ? adminIcons : businessIcons;
  const sidebar = (
    <aside
      className={`workspace-sidebar ${mobileOpen ? "open" : ""} ${sidebarCollapsed ? "collapsed" : ""}`}
    >
      <div className="sidebar-brand">
        <Link
          to={shell === "admin" ? "/admin" : "/business/cendana/overview"}
          className="brand"
        >
          <span className="brand-mark">LG</span>
          <span className="sidebar-brand-name">
            Lapangan<strong>Go</strong>
          </span>
        </Link>
        <button
          className="sidebar-collapse-button desktop-only"
          onClick={() => setSidebarCollapsed((value) => !value)}
          aria-label={sidebarCollapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
          aria-pressed={sidebarCollapsed}
        >
          {sidebarCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
        </button>
        <button
          className="icon-button mobile-only"
          onClick={() => setMobileOpen(false)}
          aria-label="Tutup menu"
        >
          <X />
        </button>
      </div>
      {shell === "business" && (
        <button className="tenant-switch">
          <span>
            <small>Workspace aktif</small>
            {activeTenant.name}
          </span>
          <ChevronDown />
        </button>
      )}
      <nav aria-label={`Navigasi ${shell}`}>
        {grouped.map(([section, routes], groupIndex) => (
          <div className="nav-group" key={section}>
            <p>{section}</p>
            {routes.map((route, routeIndex) => {
              const Icon = icons[(groupIndex + routeIndex) % icons.length];
              const href = route.path
                .replace(":tenant", "cendana")
                .replace(":venueId", "v1");
              return (
                <NavLink
                  end
                  key={route.path}
                  to={href}
                  title={sidebarCollapsed ? route.title : undefined}
                  onClick={() => setMobileOpen(false)}
                >
                  <Icon />
                  <span>{route.title}</span>
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="sidebar-footer">
        <span className="avatar">
          {state.role === "admin" ? "RA" : state.role === "staff" ? "SN" : "AP"}
        </span>
        <div>
          <strong>
            {state.role === "admin"
              ? "Rani Admin"
              : state.role === "staff"
                ? "Sinta N."
                : "Andika Pratama"}
          </strong>
          <small>{roleLabels[state.role]}</small>
        </div>
      </div>
    </aside>
  );
  return (
    <div className="workspace-shell">
      {sidebar}
      <div
        className={`workspace-main ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}
      >
        <header className="workspace-header">
          <button
            className="icon-button mobile-only"
            onClick={() => setMobileOpen(true)}
            aria-label="Buka menu"
          >
            <Menu />
          </button>
          <div className="breadcrumbs">
            <span>
              {shell === "admin" ? "Admin Platform" : activeTenant.name}
            </span>
            <span>/</span>
            <strong>
              {definitions.find((route) =>
                matchPath(route.path, location.pathname),
              )?.title ?? "Workspace"}
            </strong>
          </div>
          <div className="header-actions">
            <ThemeToggle />
            <button className="icon-button" aria-label="Notifikasi">
              <Bell />
            </button>
            <PrototypeControls />
          </div>
        </header>
        <main className="workspace-content">{children}</main>
      </div>
      {mobileOpen && (
        <button
          className="sidebar-scrim"
          onClick={() => setMobileOpen(false)}
          aria-label="Tutup menu"
        />
      )}
      {state.toast && (
        <div className="toast" role="status">
          {state.toast}
        </div>
      )}
    </div>
  );
}

function matchPath(pattern: string, pathname: string) {
  const regex = new RegExp(`^${pattern.replace(/:[^/]+/g, "[^/]+")}$`);
  return regex.test(pathname);
}
