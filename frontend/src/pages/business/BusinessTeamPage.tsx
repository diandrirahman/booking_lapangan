import { useState } from "react";
import { Building2, Mail, ShieldCheck, UserPlus } from "lucide-react";
import { useParams } from "react-router-dom";
import {
  useAddWorkspaceMember,
  useBusinessVenues,
  useTransferPrimaryOwner,
  useUpdateStaffAssignments,
  useWorkspaceMembers,
} from "../../api/businessQueries";
import {
  useAssignTenantRole,
  useRoleTemplates,
  useTenantRoles,
} from "../../api/b2Queries";
import { SelectField } from "../../components/SelectField";
import {
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  Input,
  LoadingState,
  PageTitle,
} from "../../components/ui";

export function BusinessTeamPage() {
  const { tenant } = useParams();
  const members = useWorkspaceMembers(tenant);
  const venues = useBusinessVenues(tenant);
  const addMember = useAddWorkspaceMember(tenant ?? "");
  const assignments = useUpdateStaffAssignments(tenant ?? "");
  const transfer = useTransferPrimaryOwner(tenant ?? "");
  const roleTemplates = useRoleTemplates();
  const tenantRoles = useTenantRoles(tenant);
  const assignRole = useAssignTenantRole(tenant ?? "");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"OWNER" | "STAFF">("STAFF");
  const [transferReason, setTransferReason] = useState("");

  if (!tenant)
    return (
      <EmptyState
        title="Workspace tidak valid"
        description="Pilih workspace dari menu akun."
      />
    );
  if (!members.data || !venues.data || !tenantRoles.data || !roleTemplates.data) {
    return members.isError ||
      venues.isError ||
      tenantRoles.isError ||
      roleTemplates.isError ? (
      <EmptyState
        title="Tim belum dapat dimuat"
        description="Periksa koneksi API lalu coba lagi."
      />
    ) : (
      <LoadingState
        title="Memuat anggota tim…"
        description="Menyiapkan role, permission, dan assignment venue."
        variant="panel"
      />
    );
  }

  async function submitMember() {
    await addMember.mutateAsync({ email: email.trim(), role });
    setEmail("");
  }

  return (
    <>
      <PageTitle
        eyebrow="Pengaturan workspace"
        title="Tim dan assignment"
        description="Satu akun tetap dapat menjadi Customer sekaligus anggota workspace bisnis."
        action={
          <Dialog
            title="Tambah anggota"
            description="Pengguna harus sudah mempunyai akun LapanganGo."
            trigger={
              <Button>
                <UserPlus /> Tambah anggota
              </Button>
            }
          >
            <label>
              Email akun
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label>
              Role
              <SelectField
                ariaLabel="Role anggota"
                value={role}
                options={[
                  { value: "STAFF", label: "Staff" },
                  { value: "OWNER", label: "Owner" },
                ]}
                onValueChange={(value) => setRole(value as "OWNER" | "STAFF")}
              />
            </label>
            {addMember.error && (
              <p className="field-error">{addMember.error.message}</p>
            )}
            <Button
              disabled={!email.includes("@") || addMember.isPending}
              onClick={() => void submitMember()}
            >
              Tambahkan
            </Button>
          </Dialog>
        }
      />
      <Card className="team-overview-card">
        <div>
          <span className="team-overview-icon">
            <ShieldCheck aria-hidden="true" />
          </span>
          <p>
            <strong>{members.data.items.length} anggota</strong>
            <small>Satu Primary Owner aktif</small>
          </p>
        </div>
        <div>
          <span className="team-overview-icon">
            <Building2 aria-hidden="true" />
          </span>
          <p>
            <strong>{venues.data.items.length} venue</strong>
            <small>Assignment Staff per venue</small>
          </p>
        </div>
      </Card>
      <div className="team-grid">
        {members.data.items.map((member) => (
          <Card key={member.membershipId} className="team-member-card">
            <div className="team-member-header">
              <span className="team-member-avatar" aria-hidden="true">
                {initials(member.name)}
              </span>
              <div className="team-member-identity">
                <h2>{member.name}</h2>
                <a href={`mailto:${member.email}`}>
                  <Mail aria-hidden="true" /> {member.email}
                </a>
              </div>
              <Badge tone={member.role === "PRIMARY_OWNER" ? "success" : "neutral"}>
                {member.role.replaceAll("_", " ")}
              </Badge>
            </div>
            {member.role === "STAFF" && (
              <fieldset className="team-access-list">
                <legend>Venue yang dapat diakses</legend>
                <label>
                  Role operasional
                  <SelectField
                    ariaLabel={`Role ${member.name}`}
                    value={member.tenantRoleId ?? ""}
                    options={tenantRoles.data.items.map((tenantRole) => ({
                      value: tenantRole.id,
                      label: tenantRole.name,
                    }))}
                    onValueChange={(roleId) =>
                      assignRole.mutate({ membershipId: member.membershipId, roleId })
                    }
                  />
                </label>
                {member.permissions.length > 0 && (
                  <div className="team-permission-list" aria-label="Permission aktif">
                    {member.permissions.map((permission) => (
                      <Badge key={permission} tone="neutral">
                        {permission}
                      </Badge>
                    ))}
                  </div>
                )}
                <p>Pilih venue yang boleh dikelola oleh Staff ini.</p>
                {venues.data.items.map((venue) => (
                  <label className="team-access-option" key={venue.id}>
                    <input
                      type="checkbox"
                      checked={member.assignedVenueIds.includes(venue.id)}
                      disabled={assignments.isPending}
                      onChange={(event) =>
                        assignments.mutate({
                          membershipId: member.membershipId,
                          venueIds: event.target.checked
                            ? [...member.assignedVenueIds, venue.id]
                            : member.assignedVenueIds.filter((id) => id !== venue.id),
                        })
                      }
                    />
                    <span>
                      <Building2 aria-hidden="true" />
                      {venue.name}
                    </span>
                  </label>
                ))}
              </fieldset>
            )}
            {member.role === "PRIMARY_OWNER" && (
              <div className="team-owner-access">
                <ShieldCheck aria-hidden="true" />
                <span>
                  <strong>Akses penuh workspace</strong>
                  <small>Mengelola semua venue, anggota, dan pengaturan.</small>
                </span>
              </div>
            )}
            {member.role === "OWNER" && (
              <Dialog
                title={`Transfer Primary Owner ke ${member.name}`}
                description="Aksi ini mengubah role kedua membership secara transaksional."
                trigger={<Button variant="secondary">Jadikan Primary Owner</Button>}
              >
                <label>
                  Alasan
                  <textarea
                    className="input"
                    value={transferReason}
                    onChange={(event) => setTransferReason(event.target.value)}
                  />
                </label>
                <Button
                  disabled={transferReason.trim().length < 5 || transfer.isPending}
                  onClick={() =>
                    transfer.mutate({
                      targetMembershipId: member.membershipId,
                      reason: transferReason.trim(),
                    })
                  }
                >
                  Konfirmasi transfer
                </Button>
              </Dialog>
            )}
          </Card>
        ))}
      </div>
    </>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
