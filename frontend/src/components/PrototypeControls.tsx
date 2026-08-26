import * as Dialog from "@radix-ui/react-dialog";
import { RotateCcw, Settings2, X } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { roleLabels } from "../data/fixtures";
import type { PrototypeRole, Scenario } from "../domain/types";
import { entryRouteForRole } from "../domain/access";
import { usePrototype } from "../store/PrototypeStore";
import { Button } from "./ui";
import { SelectField } from "./SelectField";

const scenarios: Scenario[] = [
  "baseline",
  "loading",
  "empty",
  "validation-error",
  "server-error",
  "expired",
  "stale",
  "reconnecting",
  "success",
  "unauthorized",
];

export function PrototypeControls() {
  const { state, dispatch } = usePrototype();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  function switchRole(role: PrototypeRole) {
    dispatch({ type: "SWITCH_ROLE", role });
    setOpen(false);
    navigate(entryRouteForRole(role));
  }
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="secondary" size="sm">
          <Settings2 />
          Kontrol prototype
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="drawer-content">
          <div className="dialog-heading">
            <div>
              <Dialog.Title>Kontrol prototype</Dialog.Title>
              <Dialog.Description>
                Uji role dan state tanpa akun atau jaringan.
              </Dialog.Description>
            </div>
            <Dialog.Close className="icon-button" aria-label="Tutup">
              <X />
            </Dialog.Close>
          </div>
          <div className="control-group">
            <label>Peran aktif</label>
            <SelectField
              ariaLabel="Peran aktif"
              options={(Object.keys(roleLabels) as PrototypeRole[]).map(
                (role) => ({ value: role, label: roleLabels[role] }),
              )}
              value={state.role}
              onValueChange={(value) => switchRole(value as PrototypeRole)}
            />
          </div>
          <div className="control-group">
            <label>Skenario UI</label>
            <SelectField
              ariaLabel="Skenario UI"
              options={scenarios.map((scenario) => ({
                value: scenario,
                label: scenario,
              }))}
              value={state.scenario}
              onValueChange={(value) =>
                dispatch({
                  type: "SET_SCENARIO",
                  scenario: value as Scenario,
                })
              }
            />
          </div>
          <div className="sandbox-panel">
            <strong>Sandbox Phase A</strong>
            <p>
              Pembayaran, refund, saldo, payout, dan dokumen legal hanya
              simulasi.
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              dispatch({ type: "RESET" });
              setOpen(false);
              navigate("/");
            }}
          >
            <RotateCcw />
            Reset ke baseline
          </Button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
