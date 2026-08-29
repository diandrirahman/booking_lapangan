import * as Popover from "@radix-ui/react-popover";
import { BriefcaseBusiness, ChevronDown, Link2, LogOut, UserRound } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCreateTenant } from "../api/businessQueries";
import {
  isAuthenticationRequired,
  useLogout,
  useSession,
  useStartGoogleAccountLink,
} from "../api/session";
import { Button, Dialog, Input } from "./ui";

export function AccountMenu() {
  const session = useSession();
  const logout = useLogout();
  const createTenant = useCreateTenant();
  const googleLink = useStartGoogleAccountLink();
  const navigate = useNavigate();
  const [workspaceName, setWorkspaceName] = useState("");
  const [linkPassword, setLinkPassword] = useState("");

  if (session.isPending) {
    return (
      <button
        className="btn btn-secondary btn-sm account-login"
        type="button"
        disabled
        aria-busy="true"
      >
        <UserRound />
        <span>Memeriksa akun…</span>
      </button>
    );
  }

  if (session.isError && !isAuthenticationRequired(session.error)) {
    return (
      <button
        className="btn btn-secondary btn-sm account-login"
        type="button"
        onClick={() => void session.refetch()}
      >
        <UserRound />
        <span>Coba lagi</span>
      </button>
    );
  }

  if (!session.data) {
    return (
      <Link className="btn btn-secondary btn-sm account-login" to="/login">
        <UserRound />
        <span>Masuk</span>
      </Link>
    );
  }

  const { user, memberships } = session.data;
  const workspace = memberships[0];

  async function signOut() {
    await logout.mutateAsync();
    navigate("/", { replace: true });
  }

  async function openBusinessWorkspace() {
    const workspace = await createTenant.mutateAsync(workspaceName.trim());
    setWorkspaceName("");
    navigate(`/business/${workspace.tenantId}/overview`);
  }

  async function linkGoogleAccount() {
    const result = await googleLink.mutateAsync(linkPassword);
    setLinkPassword("");
    window.location.assign(result.authorizationUrl);
  }

  return (
    <Popover.Root>
      <Popover.Trigger className="account-trigger" aria-label="Buka menu akun">
        <span className="account-avatar" aria-hidden="true">
          {initials(user.name)}
        </span>
        <span className="account-trigger-copy desktop-only">
          <small>Akun</small>
          <strong>{user.name.split(" ")[0]}</strong>
        </span>
        <ChevronDown className="desktop-only" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="account-popover" align="end" sideOffset={10}>
          <div className="account-identity">
            <span className="account-avatar">{initials(user.name)}</span>
            <span>
              <strong>{user.name}</strong>
              <small>{user.email}</small>
            </span>
          </div>
          <nav aria-label="Menu akun">
            <Link to="/profile">
              <UserRound /> Profil dan pengaturan
            </Link>
            <Dialog
              title="Tautkan akun Google"
              description="Tambahkan Google sebagai cara masuk tanpa membuat akun baru."
              trigger={
                <button className="account-menu-item" type="button">
                  <span className="account-menu-icon">
                    <Link2 />
                  </span>
                  <span className="account-menu-copy">
                    <strong>Tautkan Google</strong>
                    <small>Gunakan akun Google untuk masuk</small>
                  </span>
                </button>
              }
            >
              <div className="account-link-form">
                <div className="account-link-notice">
                  <span className="account-menu-icon">
                    <Link2 />
                  </span>
                  <p>
                    <strong>Verifikasi akun lokal</strong>
                    <small>
                      Masukkan password LapanganGo sebelum dialihkan ke Google.
                    </small>
                  </p>
                </div>
                <label>
                  Password akun
                  <Input
                    type="password"
                    autoComplete="current-password"
                    value={linkPassword}
                    maxLength={128}
                    onChange={(event) => setLinkPassword(event.target.value)}
                  />
                </label>
                {googleLink.error && (
                  <p className="field-error" role="alert">
                    {googleLink.error.message}
                  </p>
                )}
                <div className="dialog-actions">
                  <Button
                    disabled={linkPassword.length === 0 || googleLink.isPending}
                    onClick={() => void linkGoogleAccount()}
                  >
                    {googleLink.isPending ? "Memverifikasi..." : "Lanjutkan ke Google"}
                  </Button>
                </div>
              </div>
            </Dialog>
            {workspace && (
              <Link to={`/business/${workspace.tenantId}/overview`}>
                <BriefcaseBusiness /> Workspace bisnis
              </Link>
            )}
            {!workspace && (
              <Dialog
                title="Buka workspace bisnis"
                description="Buat organisasi bisnis. Akun ini tetap dapat digunakan sebagai Customer."
                trigger={
                  <button type="button">
                    <BriefcaseBusiness /> Buka workspace bisnis
                  </button>
                }
              >
                <label>
                  Nama bisnis
                  <Input
                    value={workspaceName}
                    maxLength={80}
                    placeholder="Contoh: Cendana Sports Group"
                    onChange={(event) => setWorkspaceName(event.target.value)}
                  />
                </label>
                {createTenant.error && (
                  <p className="field-error" role="alert">
                    {createTenant.error.message}
                  </p>
                )}
                <Button
                  disabled={workspaceName.trim().length < 3 || createTenant.isPending}
                  onClick={() => void openBusinessWorkspace()}
                >
                  {createTenant.isPending ? "Membuat..." : "Buat workspace"}
                </Button>
              </Dialog>
            )}
          </nav>
          <button onClick={() => void signOut()} disabled={logout.isPending}>
            <LogOut /> {logout.isPending ? "Keluar…" : "Keluar"}
          </button>
          <Popover.Arrow className="account-popover-arrow" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
