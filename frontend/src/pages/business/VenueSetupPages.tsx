import { Plus } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { SelectField } from "../../components/SelectField";
import {
  Badge,
  Button,
  Card,
  Dialog,
  Input,
  PageTitle,
  ProgressSteps,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui";
import { usePrototype } from "../../store/PrototypeStore";
import {
  formatRupiah,
  selectVenueSetup,
  statusLabel,
} from "../../store/selectors";

const createVenueSchema = z.object({
  name: z.string().min(3, "Nama venue minimal 3 karakter."),
  location: z.string().min(5, "Lokasi venue wajib diisi."),
  sport: z.string().min(1),
});
type CreateVenueForm = z.infer<typeof createVenueSchema>;

function CreateVenueDialog() {
  const { state, dispatch } = usePrototype();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateVenueForm>({
    resolver: zodResolver(createVenueSchema),
    defaultValues: { sport: "Badminton" },
  });
  function createVenue(values: CreateVenueForm) {
    const id = `v${state.venues.length + 1}`;
    const template = state.venues[0];
    dispatch({
      type: "ADD_VENUE",
      venue: {
        ...template,
        id,
        slug: values.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        tenantId: state.activeTenantId,
        name: values.name,
        location: values.location,
        sport: values.sport,
        rating: 0,
        reviewCount: 0,
        status: "draft",
        facilities: [],
      },
      draft: {
        ...structuredClone(state.venueDrafts[template.id]),
        venueId: id,
        contact: "",
        mediaReady: false,
        exceptions: [],
        policies: [],
        revisionReason: undefined,
      },
    });
    navigate(`/business/cendana/venues/${id}/profile`);
  }
  return (
    <Dialog
      title="Tambah venue"
      description="Buat draft lokal dan lanjutkan setup langkah demi langkah."
      trigger={
        <Button>
          <Plus /> Tambah venue
        </Button>
      }
    >
      <form className="form-grid" onSubmit={handleSubmit(createVenue)}>
        <label>
          Nama venue
          <Input {...register("name")} placeholder="Contoh: Arena Cendana" />
          {errors.name && (
            <span className="field-error">{errors.name.message}</span>
          )}
        </label>
        <label>
          Lokasi
          <Input {...register("location")} placeholder="Kecamatan, kota" />
          {errors.location && (
            <span className="field-error">{errors.location.message}</span>
          )}
        </label>
        <label>
          Olahraga utama
          <select className="input" {...register("sport")}>
            {["Badminton", "Futsal", "Padel", "Basket", "Tenis"].map(
              (sport) => (
                <option key={sport}>{sport}</option>
              ),
            )}
          </select>
        </label>
        <Button type="submit">Buat dan lanjutkan</Button>
      </form>
    </Dialog>
  );
}

export function VenuesSetupPage() {
  const { state, dispatch } = usePrototype();
  const navigate = useNavigate();
  const tenantVenues = state.venues.filter(
    (venue) => venue.tenantId === state.activeTenantId,
  );
  return (
    <>
      <PageTitle
        eyebrow="Workspace venue"
        title="Kelola venue"
        description="Selesaikan setup dan publikasi venue dari satu workspace."
        action={<CreateVenueDialog />}
      />
      <div className="venue-admin-grid">
        {tenantVenues.map((venue) => {
          const setup = selectVenueSetup(state, venue.id);
          const revisionReason = state.venueDrafts[venue.id]?.revisionReason;
          return (
            <Card key={venue.id} className="owner-venue-card">
              <img src={venue.image} alt={venue.name} />
              <div>
                <Badge
                  tone={
                    venue.status === "published"
                      ? "success"
                      : venue.status === "revision" ||
                          venue.status === "rejected"
                        ? "danger"
                        : "warning"
                  }
                >
                  {statusLabel(venue.status)}
                </Badge>
                <h2>{venue.name}</h2>
                <p>{venue.location}</p>
                <p>{setup.completed}/5 langkah setup lengkap</p>
                {revisionReason && (
                  <p className="field-error">Catatan Admin: {revisionReason}</p>
                )}
                <div>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      navigate(`/business/cendana/venues/${venue.id}/profile`)
                    }
                  >
                    Lanjutkan setup
                  </Button>
                  {venue.status !== "published" &&
                    venue.status !== "in_review" && (
                      <Button
                        disabled={!setup.canSubmit}
                        title={
                          setup.canSubmit
                            ? undefined
                            : "Lengkapi profil, lapangan, jadwal, harga, dan kebijakan"
                        }
                        onClick={() =>
                          dispatch({ type: "SUBMIT_VENUE", venueId: venue.id })
                        }
                      >
                        Kirim verifikasi
                      </Button>
                    )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}

const setupMap: Record<
  string,
  { title: string; description: string; active: number }
> = {
  profile: {
    title: "Profil dan media",
    description: "Informasi dasar, galeri, fasilitas, dan add-on venue.",
    active: 0,
  },
  courts: {
    title: "Lapangan",
    description: "Atur jenis olahraga, permukaan, dan status lapangan.",
    active: 1,
  },
  availability: {
    title: "Jadwal dan ketersediaan",
    description: "Jam mingguan, pengecualian, block, dan buffer.",
    active: 2,
  },
  pricing: {
    title: "Aturan harga",
    description: "Harga dasar, weekday, jam sibuk, dan tanggal khusus.",
    active: 3,
  },
  policies: {
    title: "Kebijakan venue",
    description: "Pembayaran, DP, refund, reschedule, dan no-show.",
    active: 4,
  },
};
export function VenueSetupDetailPage() {
  const params = useParams();
  const { state } = usePrototype();
  const navigate = useNavigate();
  const kind =
    Object.keys(setupMap).find((key) => location.pathname.endsWith(key)) ??
    "profile";
  const config = setupMap[kind];
  const venue =
    state.venues.find((item) => item.id === params.venueId) ?? state.venues[0];
  const setup = selectVenueSetup(state, venue.id);
  const setupOrder = [
    "profile",
    "courts",
    "availability",
    "pricing",
    "policies",
  ];
  const currentIndex = setupOrder.indexOf(kind);
  const previousKind = setupOrder[currentIndex - 1];
  const nextKind = setupOrder[currentIndex + 1];
  return (
    <>
      <PageTitle
        eyebrow={venue.name}
        title={config.title}
        description={config.description}
        action={<Badge tone="success">Tersimpan otomatis</Badge>}
      />
      <ProgressSteps
        items={[
          "Profil",
          "Lapangan",
          "Jadwal",
          "Harga",
          "Kebijakan",
          "Verifikasi",
        ]}
        active={config.active}
      />
      <Card className="form-card wide">
        <Tabs defaultValue="utama">
          <TabsList className="tabs-list">
            <TabsTrigger value="utama">Pengaturan utama</TabsTrigger>
            <TabsTrigger value="preview">Preview publikasi</TabsTrigger>
          </TabsList>
          <TabsContent value="utama">
            <SetupForm kind={kind} venueId={venue.id} />
          </TabsContent>
          <TabsContent value="preview">
            <div className="publication-preview">
              <img src={venue.image} alt={venue.name} />
              <div>
                <Badge tone="warning">Preview</Badge>
                <h2>{venue.name}</h2>
                <p>{venue.location}</p>
                <strong>{formatRupiah(venue.priceFrom)}/jam</strong>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </Card>
      <div className="form-actions setup-navigation">
        <Button
          variant="secondary"
          disabled={!previousKind}
          onClick={() =>
            previousKind &&
            navigate(`/business/cendana/venues/${venue.id}/${previousKind}`)
          }
        >
          Sebelumnya
        </Button>
        {nextKind ? (
          <Button
            onClick={() =>
              navigate(`/business/cendana/venues/${venue.id}/${nextKind}`)
            }
          >
            Lanjutkan
          </Button>
        ) : (
          <Button
            disabled={!setup.canSubmit}
            onClick={() => navigate("/business/cendana/venues")}
          >
            Tinjau dan kirim
          </Button>
        )}
      </div>
    </>
  );
}

function SetupForm({ kind, venueId }: { kind: string; venueId: string }) {
  const { state, dispatch } = usePrototype();
  const venue = state.venues.find((item) => item.id === venueId)!;
  const draft = state.venueDrafts[venueId];
  const venueCourts = state.courts.filter((court) => court.venueId === venueId);
  const [courtName, setCourtName] = useState("");
  const [courtSurface, setCourtSurface] = useState("Premium vinyl");
  const [basePrice, setBasePrice] = useState(draft.basePrice);
  const [peakPrice, setPeakPrice] = useState(draft.peakPrice);
  const profileForm = useForm({
    defaultValues: {
      name: venue.name,
      location: venue.location,
      contact: draft.contact,
      mediaReady: draft.mediaReady,
    },
  });
  function saveProfile(values: {
    name: string;
    location: string;
    contact: string;
    mediaReady: boolean;
  }) {
    dispatch({ type: "UPDATE_VENUE_PROFILE", venueId, ...values });
  }
  if (kind === "profile")
    return (
      <form
        className="form-grid"
        onBlur={() => void profileForm.handleSubmit(saveProfile)()}
      >
        <label>
          Nama venue
          <Input {...profileForm.register("name", { required: true })} />
        </label>
        <label>
          Lokasi
          <Input {...profileForm.register("location", { required: true })} />
        </label>
        <label>
          Kontak
          <Input {...profileForm.register("contact", { required: true })} />
        </label>
        <label className="checkbox-row">
          <input type="checkbox" {...profileForm.register("mediaReady")} />
          <span>Media utama dan alt text sudah siap</span>
        </label>
      </form>
    );
  if (kind === "courts")
    return (
      <div>
        <div className="data-card">
          {venueCourts.map((court) => (
            <div className="list-item" key={court.id}>
              <div>
                <strong>{court.name}</strong>
                <small>
                  {court.sport} · {court.surface}
                </small>
              </div>
              <Badge tone={court.active ? "success" : "neutral"}>
                {court.active ? "Aktif" : "Nonaktif"}
              </Badge>
            </div>
          ))}
        </div>
        <div className="form-grid compact-form">
          <label>
            Nama lapangan
            <Input
              value={courtName}
              onChange={(event) => setCourtName(event.target.value)}
            />
          </label>
          <label>
            Permukaan
            <Input
              value={courtSurface}
              onChange={(event) => setCourtSurface(event.target.value)}
            />
          </label>
          <Button
            disabled={!courtName.trim()}
            onClick={() => {
              dispatch({
                type: "ADD_COURT",
                court: {
                  id: `c${state.courts.length + 1}`,
                  venueId,
                  name: courtName,
                  sport: venue.sport,
                  surface: courtSurface,
                  active: true,
                },
              });
              setCourtName("");
            }}
          >
            <Plus /> Tambah lapangan
          </Button>
        </div>
      </div>
    );
  if (kind === "availability")
    return (
      <>
        <div className="weekly-schedule">
          {Object.entries(draft.schedule).map(([day, hours]) => (
            <div key={day}>
              <label>
                <input
                  type="checkbox"
                  checked={hours.enabled}
                  onChange={(event) =>
                    dispatch({
                      type: "UPDATE_AVAILABILITY",
                      venueId,
                      bufferMinutes: draft.bufferMinutes,
                      schedule: {
                        ...draft.schedule,
                        [day]: { ...hours, enabled: event.target.checked },
                      },
                    })
                  }
                />
                {day}
              </label>
              <input type="time" value={hours.opensAt} readOnly />
              <span>—</span>
              <input type="time" value={hours.closesAt} readOnly />
            </div>
          ))}
        </div>
        <label>
          Buffer antar booking
          <SelectField
            ariaLabel="Buffer antar booking"
            value={String(draft.bufferMinutes)}
            options={[15, 30, 45].map((minutes) => ({
              value: String(minutes),
              label: `${minutes} menit`,
            }))}
            onValueChange={(value) =>
              dispatch({
                type: "UPDATE_AVAILABILITY",
                venueId,
                schedule: draft.schedule,
                bufferMinutes: Number(value),
              })
            }
          />
        </label>
        <Button
          variant="secondary"
          onClick={() =>
            dispatch({
              type: "ADD_VENUE_EXCEPTION",
              venueId,
              exception: `Maintenance ${draft.exceptions.length + 1} · 29 Agustus 2026`,
            })
          }
        >
          <Plus />
          Tambah pengecualian
        </Button>
        {draft.exceptions.map((exception) => (
          <Badge key={exception}>{exception}</Badge>
        ))}
      </>
    );
  if (kind === "pricing")
    return (
      <div className="form-grid">
        <label>
          Harga dasar
          <Input
            type="number"
            value={basePrice}
            onChange={(event) => setBasePrice(Number(event.target.value))}
            onBlur={() =>
              dispatch({
                type: "UPDATE_PRICING",
                venueId,
                basePrice,
                peakPrice,
              })
            }
          />
        </label>
        <label>
          Jam sibuk
          <Input
            type="number"
            value={peakPrice}
            onChange={(event) => setPeakPrice(Number(event.target.value))}
            onBlur={() =>
              dispatch({
                type: "UPDATE_PRICING",
                venueId,
                basePrice,
                peakPrice,
              })
            }
          />
        </label>
        <label>
          Preview tanggal
          <Input type="date" defaultValue="2026-08-29" />
        </label>
      </div>
    );
  if (kind === "policies")
    return (
      <div className="policy-list">
        {[
          "DP minimum 30%",
          "Bayar di venue",
          "Reschedule maksimal H-1",
          "Refund bertingkat",
          "No-show ditandai otomatis",
        ].map((policy) => (
          <label key={policy}>
            <input
              type="checkbox"
              checked={draft.policies.includes(policy)}
              onChange={(event) =>
                dispatch({
                  type: "UPDATE_POLICIES",
                  venueId,
                  policies: event.target.checked
                    ? [...draft.policies, policy]
                    : draft.policies.filter((item) => item !== policy),
                })
              }
            />
            {policy}
          </label>
        ))}
      </div>
    );
  return null;
}
