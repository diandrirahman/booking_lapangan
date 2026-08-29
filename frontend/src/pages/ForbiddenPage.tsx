import { useNavigate } from "react-router-dom";
import { prototypeModeEnabled } from "../api/apiClient";
import { useSession } from "../api/session";
import { Button } from "../components/ui";
import { usePrototype } from "../store/PrototypeStore";

export function ForbiddenPage() {
  const { state } = usePrototype();
  const session = useSession();
  const navigate = useNavigate();
  const workspacePath = prototypeModeEnabled
    ? prototypeWorkspacePath(state.role)
    : serverWorkspacePath(session.data);

  return (
    <div className="forbidden">
      <span>403</span>
      <h1>Akses dibatasi</h1>
      <p>Role aktif tidak memiliki izin untuk membuka workspace ini.</p>
      <Button variant="secondary" onClick={() => navigate(workspacePath)}>
        Ke workspace aktif
      </Button>
    </div>
  );
}

function prototypeWorkspacePath(role: "customer" | "owner" | "staff" | "admin") {
  if (role === "admin") return "/admin";
  if (role === "owner" || role === "staff") return "/business/cendana/overview";
  return "/";
}

function serverWorkspacePath(session: ReturnType<typeof useSession>["data"]): string {
  if (session?.platformAdmin) return "/admin";
  const membership = session?.memberships[0];
  return membership ? `/business/${membership.tenantId}/overview` : "/";
}
