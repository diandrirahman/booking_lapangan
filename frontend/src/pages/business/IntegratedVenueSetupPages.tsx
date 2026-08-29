import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, ChevronRight, MapPin, Plus } from "lucide-react";
import { type ChangeEvent, useState } from "react";
import { useForm } from "react-hook-form";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import {
  useBusinessSetupMasters,
  useBusinessVenue,
  useBusinessVenues,
  useCreateBusinessCourt,
  useCreateBusinessClosure,
  useCreateBusinessVenue,
  useCreateScheduleException,
  useCreatePriceRule,
  usePricingPreview,
  useCreateVenueAddon,
  useSubmitBusinessVenue,
  useUploadVenueMedia,
  useUpdateBusinessVenueCatalog,
  useUpdateBusinessVenueProfile,
  useUpdateCourtAvailability,
  useUpdateVenuePaymentSettings,
} from "../../api/businessQueries";
import { SelectField } from "../../components/SelectField";
import {
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  Input,
  PageTitle,
  ProgressSteps,
} from "../../components/ui";

const setupSteps = ["profile", "courts", "availability", "pricing", "policies"];
const stepTitles = ["Profil", "Lapangan", "Jadwal", "Harga", "Kebijakan"];
const acceptedVenueImageTypes = new Set(["image/webp", "image/jpeg", "image/png"]);
const maximumVenueImageBytes = 10 * 1024 * 1024;

const createVenueSchema = z.object({
  name: z.string().trim().min(3, "Nama venue minimal 3 karakter.").max(80),
});

const profileSchema = z.object({
  name: z.string().trim().min(3).max(80),
  description: z.string().trim().min(20, "Deskripsi minimal 20 karakter."),
  phoneE164: z.string().regex(/^\+[1-9]\d{7,14}$/, "Gunakan format +62."),
  email: z.union([z.literal(""), z.email()]),
  addressLine: z.string().trim().min(10, "Alamat minimal 10 karakter."),
  provinceCode: z.string().trim().max(10),
  cityCode: z.string().trim().max(10),
  districtCode: z.string().trim().max(10),
  postalCode: z.union([z.literal(""), z.string().regex(/^\d{5}$/)]),
  latitude: z.string().regex(/^-?\d{1,2}(\.\d{1,7})?$/),
  longitude: z.string().regex(/^-?\d{1,3}(\.\d{1,7})?$/),
  timezone: z.string().min(3),
  indoorOutdoorType: z.enum(["INDOOR", "OUTDOOR", "MIXED"]),
  parkingInfo: z.string().max(255),
  houseRules: z.string().trim().min(10, "Aturan venue minimal 10 karakter."),
  emergencyContact: z.string().trim().max(50),
});

const courtSchema = z.object({
  name: z.string().trim().min(2).max(50),
  sportId: z.string().min(1, "Pilih olahraga."),
  surface: z.string().trim().max(50),
  capacity: z.number().int().min(1).max(500),
});

type ProfileForm = z.infer<typeof profileSchema>;
type CourtForm = z.infer<typeof courtSchema>;

export function IntegratedVenuesSetupPage() {
  const { tenant } = useParams();
  const navigate = useNavigate();
  const venues = useBusinessVenues(tenant);
  const createVenue = useCreateBusinessVenue(tenant ?? "");
  const form = useForm<{ name: string }>({ resolver: zodResolver(createVenueSchema) });

  if (!tenant) return <InvalidWorkspace />;
  if (venues.isLoading) return <LoadingCard label="Memuat venue..." />;
  if (venues.isError || !venues.data) {
    return <QueryError onRetry={() => void venues.refetch()} />;
  }

  async function submit(values: { name: string }) {
    const venue = await createVenue.mutateAsync(values.name);
    navigate(`/business/${tenant}/venues/${venue.id}/profile`);
  }

  return (
    <>
      <PageTitle
        eyebrow="Workspace venue"
        title="Kelola venue"
        description="Progress dan status publikasi dihitung langsung oleh server."
        action={
          <Dialog
            title="Tambah venue"
            description="Venue dibuat sebagai draft pada workspace aktif."
            contentClassName="create-venue-dialog"
            trigger={
              <Button>
                <Plus /> Tambah venue
              </Button>
            }
          >
            <form className="create-venue-form" onSubmit={form.handleSubmit(submit)}>
              <label>
                Nama venue
                <Input {...form.register("name")} placeholder="Contoh: Arena Cendana" />
                {form.formState.errors.name && (
                  <span className="field-error">
                    {form.formState.errors.name.message}
                  </span>
                )}
              </label>
              <div className="dialog-actions">
                <Button type="submit" disabled={createVenue.isPending}>
                  {createVenue.isPending ? "Membuat..." : "Buat dan lanjutkan"}
                </Button>
              </div>
            </form>
          </Dialog>
        }
      />
      {venues.data.items.length === 0 ? (
        <EmptyState
          title="Belum ada venue"
          description="Tambahkan venue pertama untuk memulai setup."
        />
      ) : (
        <div className="venue-admin-grid">
          {venues.data.items.map((venue) => {
            const completedSections = Object.values(venue.progress.sections).filter(
              Boolean,
            ).length;
            const totalSections = Object.keys(venue.progress.sections).length;
            const progressPercentage = Math.min(
              100,
              Math.max(0, venue.progress.percentage),
            );

            return (
              <Card
                key={venue.id}
                className="owner-venue-management-card"
                aria-label={`Venue ${venue.name}`}
              >
                <div className="owner-venue-card-header">
                  <span className="owner-venue-icon" aria-hidden="true">
                    <Building2 />
                  </span>
                  <Badge tone={statusTone(venue.publicationStatus)}>
                    {statusText(venue.publicationStatus)}
                  </Badge>
                </div>

                <div className="owner-venue-card-content">
                  <div className="owner-venue-title-row">
                    <div>
                      <h2>{venue.name}</h2>
                      <p className="owner-venue-address">
                        <MapPin aria-hidden="true" />
                        {venue.addressLine || "Alamat belum diisi"}
                      </p>
                    </div>
                    <span className="owner-venue-lifecycle">
                      <span aria-hidden="true" />
                      {venue.status === "ACTIVE" ? "Aktif" : statusText(venue.status)}
                    </span>
                  </div>

                  <div className="owner-venue-progress">
                    <div className="owner-venue-progress-heading">
                      <span>Progres setup</span>
                      <strong>{progressPercentage}%</strong>
                    </div>
                    <div
                      className="owner-venue-progress-track"
                      role="progressbar"
                      aria-label={`Progres setup ${venue.name}`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={progressPercentage}
                    >
                      <span style={{ width: `${progressPercentage}%` }} />
                    </div>
                    <p>
                      {completedSections} dari {totalSections} bagian selesai
                    </p>
                  </div>

                  {venue.revisionReason && (
                    <p className="owner-venue-revision" role="alert">
                      <strong>Catatan Admin</strong>
                      {venue.revisionReason}
                    </p>
                  )}
                </div>

                <footer className="owner-venue-card-actions">
                  <Button
                    variant="secondary"
                    onClick={() =>
                      navigate(`/business/${tenant}/venues/${venue.id}/profile`)
                    }
                  >
                    Kelola setup
                    <ChevronRight aria-hidden="true" />
                  </Button>
                  <SubmitVenueButton tenantId={tenant} venue={venue} />
                </footer>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

function SubmitVenueButton({
  tenantId,
  venue,
}: {
  tenantId: string;
  venue: {
    id: string;
    status: string;
    publicationStatus: string;
    progress: { complete: boolean };
  };
}) {
  const submit = useSubmitBusinessVenue(tenantId, venue.id);
  if (venue.publicationStatus === "IN_REVIEW" || venue.publicationStatus === "APPROVED")
    return null;
  return (
    <Button
      disabled={!venue.progress.complete || submit.isPending}
      title={venue.progress.complete ? undefined : "Lengkapi seluruh bagian wajib"}
      onClick={() => submit.mutate()}
    >
      {submit.isPending ? "Mengirim..." : "Kirim verifikasi"}
    </Button>
  );
}

export function IntegratedVenueSetupDetailPage() {
  const { tenant, venueId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const venue = useBusinessVenue(tenant, venueId);
  const step =
    setupSteps.find((candidate) => location.pathname.endsWith(candidate)) ?? "profile";
  const activeStep = setupSteps.indexOf(step);

  if (!tenant || !venueId) return <InvalidWorkspace />;
  if (venue.isLoading) return <LoadingCard label="Memuat setup venue..." />;
  if (venue.isError || !venue.data)
    return <QueryError onRetry={() => void venue.refetch()} />;

  const previous = setupSteps[activeStep - 1];
  const next = setupSteps[activeStep + 1];
  return (
    <>
      <PageTitle
        eyebrow={venue.data.name}
        title={stepTitles[activeStep]}
        description={`Data tersimpan di API · ${venue.data.progress.percentage}% lengkap`}
        action={<Badge tone="success">Server state</Badge>}
      />
      {venue.data.revisionReason && (
        <Card className="inline-alert danger" role="alert">
          <strong>Perlu revisi</strong>
          <span>{venue.data.revisionReason}</span>
        </Card>
      )}
      <ProgressSteps items={[...stepTitles, "Verifikasi"]} active={activeStep} />
      <Card className="form-card wide">
        {step === "profile" && (
          <ProfileSetupForm tenantId={tenant} venue={venue.data} />
        )}
        {step === "courts" && <CourtSetupForm tenantId={tenant} venue={venue.data} />}
        {step === "availability" && (
          <AvailabilitySetupForm tenantId={tenant} venue={venue.data} />
        )}
        {step === "pricing" && (
          <PricingSetupView tenantId={tenant} venue={venue.data} />
        )}
        {step === "policies" && (
          <PaymentSettingsForm tenantId={tenant} venue={venue.data} />
        )}
      </Card>
      <div className="form-actions setup-navigation">
        <Button
          variant="secondary"
          disabled={!previous}
          onClick={() =>
            previous && navigate(`/business/${tenant}/venues/${venueId}/${previous}`)
          }
        >
          Sebelumnya
        </Button>
        {next ? (
          <Button
            onClick={() => navigate(`/business/${tenant}/venues/${venueId}/${next}`)}
          >
            Lanjutkan
          </Button>
        ) : (
          <Button onClick={() => navigate(`/business/${tenant}/venues`)}>
            Tinjau dan kirim
          </Button>
        )}
      </div>
    </>
  );
}

function ProfileSetupForm({ tenantId, venue }: SetupFormProps) {
  const masters = useBusinessSetupMasters();
  const updateProfile = useUpdateBusinessVenueProfile(tenantId, venue.id);
  const updateCatalog = useUpdateBusinessVenueCatalog(tenantId, venue.id);
  const uploadMedia = useUploadVenueMedia(tenantId, venue.id);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaFileError, setMediaFileError] = useState<string | null>(null);
  const [mediaAltText, setMediaAltText] = useState("");
  const [mediaPurpose, setMediaPurpose] = useState<"COVER" | "GALLERY">("COVER");
  const [sportIds, setSportIds] = useState(venue.sportIds);
  const [facilityIds, setFacilityIds] = useState(venue.facilityIds);
  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: venue.name,
      description: venue.description,
      phoneE164: venue.phoneE164,
      email: venue.email ?? "",
      addressLine: venue.addressLine,
      provinceCode: venue.provinceCode ?? "",
      cityCode: venue.cityCode ?? "",
      districtCode: venue.districtCode ?? "",
      postalCode: venue.postalCode ?? "",
      latitude: venue.latitude ?? "-6.2000000",
      longitude: venue.longitude ?? "106.8166667",
      timezone: venue.timezone,
      indoorOutdoorType: venue.indoorOutdoorType as ProfileForm["indoorOutdoorType"],
      parkingInfo: venue.parkingInfo ?? "",
      houseRules: venue.houseRules,
      emergencyContact: venue.emergencyContact ?? "",
    },
  });

  async function submit(values: ProfileForm) {
    await Promise.all([
      updateProfile.mutateAsync({
        tenantId,
        ...values,
        email: values.email || undefined,
        provinceCode: values.provinceCode || undefined,
        cityCode: values.cityCode || undefined,
        districtCode: values.districtCode || undefined,
        postalCode: values.postalCode || undefined,
        emergencyContact: values.emergencyContact || undefined,
      }),
      updateCatalog.mutateAsync({ sportIds, facilityIds }),
    ]);
  }

  function selectMediaFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    const validationError = file ? validateVenueImage(file) : null;

    if (validationError) {
      event.target.value = "";
      setMediaFile(null);
      setMediaFileError(validationError);
      return;
    }

    setMediaFile(file);
    setMediaFileError(null);
  }

  return (
    <form className="form-grid" onSubmit={form.handleSubmit(submit)}>
      <label>
        Nama venue
        <Input {...form.register("name")} />
      </label>
      <label>
        Telepon
        <Input {...form.register("phoneE164")} placeholder="+628123456789" />
      </label>
      <label className="full-width">
        Deskripsi
        <textarea className="input" {...form.register("description")} />
      </label>
      <label>
        Email
        <Input {...form.register("email")} />
      </label>
      <label>
        Jenis venue
        <SelectField
          ariaLabel="Jenis venue"
          value={form.watch("indoorOutdoorType")}
          options={[
            { value: "INDOOR", label: "Indoor" },
            { value: "OUTDOOR", label: "Outdoor" },
            { value: "MIXED", label: "Campuran" },
          ]}
          onValueChange={(value) =>
            form.setValue(
              "indoorOutdoorType",
              value as ProfileForm["indoorOutdoorType"],
            )
          }
        />
      </label>
      <label className="full-width">
        Alamat
        <Input {...form.register("addressLine")} />
      </label>
      <label>
        Kode provinsi
        <Input {...form.register("provinceCode")} placeholder="31" />
      </label>
      <label>
        Kode kota/kabupaten
        <Input {...form.register("cityCode")} placeholder="3171" />
      </label>
      <label>
        Kode kecamatan
        <Input {...form.register("districtCode")} placeholder="3171010" />
      </label>
      <label>
        Kode pos
        <Input {...form.register("postalCode")} inputMode="numeric" />
      </label>
      <label>
        Latitude
        <Input {...form.register("latitude")} />
      </label>
      <label>
        Longitude
        <Input {...form.register("longitude")} />
      </label>
      <label>
        Timezone
        <Input {...form.register("timezone")} />
      </label>
      <label>
        Informasi parkir
        <Input {...form.register("parkingInfo")} />
      </label>
      <label>
        Kontak darurat
        <Input {...form.register("emergencyContact")} />
      </label>
      <label className="full-width">
        Aturan venue
        <textarea className="input" {...form.register("houseRules")} />
      </label>
      <div className="setup-option-panels full-width">
        <fieldset className="setup-option-panel">
          <legend>Olahraga</legend>
          <div className="checkbox-grid">
            {masters.data?.sports.map((sport) => (
              <CheckboxOption
                key={sport.id}
                label={sport.name}
                checked={sportIds.includes(sport.id)}
                onChange={(checked) =>
                  setSportIds(toggleId(sportIds, sport.id, checked))
                }
              />
            ))}
          </div>
        </fieldset>
        <fieldset className="setup-option-panel">
          <legend>Fasilitas</legend>
          <div className="checkbox-grid">
            {masters.data?.facilities.map((facility) => (
              <CheckboxOption
                key={facility.id}
                label={facility.name}
                checked={facilityIds.includes(facility.id)}
                onChange={(checked) =>
                  setFacilityIds(toggleId(facilityIds, facility.id, checked))
                }
              />
            ))}
          </div>
        </fieldset>
      </div>
      <fieldset className="full-width">
        <legend>Media venue ({venue.mediaCount})</legend>
        <div className="form-grid compact-form venue-media-form">
          <label>
            File foto
            <Input
              type="file"
              accept="image/webp,image/jpeg,image/png"
              aria-describedby={
                mediaFileError
                  ? "venue-image-hint venue-image-error"
                  : "venue-image-hint"
              }
              onChange={selectMediaFile}
            />
            <small id="venue-image-hint" className="field-hint">
              JPG, PNG, atau WebP. Maksimal 10 MB.
            </small>
            {mediaFileError && (
              <span id="venue-image-error" className="field-error" role="alert">
                {mediaFileError}
              </span>
            )}
          </label>
          <label>
            Posisi media
            <SelectField
              ariaLabel="Posisi media venue"
              value={mediaPurpose}
              options={[
                { value: "COVER", label: "Cover utama" },
                { value: "GALLERY", label: "Galeri" },
              ]}
              onValueChange={(value) => setMediaPurpose(value as "COVER" | "GALLERY")}
            />
          </label>
          <label>
            Alt text
            <Input
              value={mediaAltText}
              maxLength={150}
              onChange={(event) => setMediaAltText(event.target.value)}
            />
          </label>
          <Button
            type="button"
            variant="secondary"
            disabled={
              !mediaFile || mediaAltText.trim().length < 3 || uploadMedia.isPending
            }
            onClick={() =>
              mediaFile &&
              uploadMedia.mutate({
                file: mediaFile,
                altText: mediaAltText.trim(),
                purpose: mediaPurpose,
              })
            }
          >
            {uploadMedia.isPending ? "Mengunggah..." : "Unggah media"}
          </Button>
        </div>
        {uploadMedia.error && (
          <p className="field-error">{uploadMedia.error.message}</p>
        )}
      </fieldset>
      {Object.values(form.formState.errors)[0]?.message && (
        <p className="field-error full-width">
          {Object.values(form.formState.errors)[0]?.message}
        </p>
      )}
      <div className="form-actions full-width profile-form-actions">
        <Button
          type="submit"
          disabled={
            sportIds.length === 0 || updateProfile.isPending || updateCatalog.isPending
          }
        >
          Simpan profil
        </Button>
      </div>
    </form>
  );
}

function CourtSetupForm({ tenantId, venue }: SetupFormProps) {
  const masters = useBusinessSetupMasters();
  const createCourt = useCreateBusinessCourt(tenantId, venue.id);
  const form = useForm<CourtForm>({
    resolver: zodResolver(courtSchema),
    defaultValues: { sportId: venue.sportIds[0] ?? "", capacity: 10, surface: "" },
  });
  async function submit(values: CourtForm) {
    await createCourt.mutateAsync(values);
    form.reset({ sportId: venue.sportIds[0] ?? "", capacity: 10, surface: "" });
  }
  return (
    <div>
      <div className="data-card">
        {venue.courts.map((court) => (
          <div className="list-item" key={court.id}>
            <div>
              <strong>{court.name}</strong>
              <small>
                {masters.data?.sports.find((sport) => sport.id === court.sportId)?.name}{" "}
                · {court.surface || "Permukaan belum diisi"}
              </small>
            </div>
            <Badge tone="success">{court.status}</Badge>
          </div>
        ))}
      </div>
      <form className="form-grid compact-form" onSubmit={form.handleSubmit(submit)}>
        <label>
          Nama lapangan
          <Input {...form.register("name")} />
        </label>
        <label>
          Olahraga
          <SelectField
            ariaLabel="Olahraga lapangan"
            value={form.watch("sportId")}
            options={(masters.data?.sports ?? [])
              .filter((sport) => venue.sportIds.includes(sport.id))
              .map((sport) => ({ value: sport.id, label: sport.name }))}
            onValueChange={(value) => form.setValue("sportId", value)}
          />
        </label>
        <label>
          Permukaan
          <Input {...form.register("surface")} />
        </label>
        <label>
          Kapasitas
          <Input
            type="number"
            {...form.register("capacity", { valueAsNumber: true })}
          />
        </label>
        <Button type="submit" disabled={createCourt.isPending}>
          <Plus /> Tambah lapangan
        </Button>
      </form>
    </div>
  );
}

function AvailabilitySetupForm({ tenantId, venue }: SetupFormProps) {
  const masters = useBusinessSetupMasters();
  const [courtId, setCourtId] = useState(venue.courts[0]?.id ?? "");
  const selectedCourt = venue.courts.find((court) => court.id === courtId);
  const update = useUpdateCourtAvailability(tenantId, venue.id);
  const createException = useCreateScheduleException(tenantId, venue.id);
  const createClosure = useCreateBusinessClosure(tenantId);
  const [exceptionDate, setExceptionDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [exceptionReason, setExceptionReason] = useState("");
  const [exceptionKind, setExceptionKind] = useState<
    "CLOSED" | "OPEN" | "CUSTOM_HOURS"
  >("CLOSED");
  const [exceptionOpensAt, setExceptionOpensAt] = useState("08:00");
  const [exceptionClosesAt, setExceptionClosesAt] = useState("22:00");
  const [interval, setInterval] = useState<number>(
    numericSetting(selectedCourt?.settings, "intervalMinutes", 60),
  );
  const [buffer, setBuffer] = useState<number>(
    numericSetting(selectedCourt?.settings, "bufferMinutes", 15),
  );
  const [bookingWindowDays, setBookingWindowDays] = useState(
    numericSetting(selectedCourt?.settings, "bookingWindowDays", 30),
  );
  const [minimumLeadMinutes, setMinimumLeadMinutes] = useState(
    numericSetting(selectedCourt?.settings, "minimumLeadMinutes", 60),
  );
  const [maximumDurationMinutes, setMaximumDurationMinutes] = useState(
    numericSetting(selectedCourt?.settings, "maximumDurationMinutes", 180),
  );
  const [closureKind, setClosureKind] = useState<"CLOSURE" | "MAINTENANCE" | "BLOCK">(
    "MAINTENANCE",
  );
  const [closureStartsAt, setClosureStartsAt] = useState("");
  const [closureEndsAt, setClosureEndsAt] = useState("");
  const [closureReason, setClosureReason] = useState("");
  const [schedule, setSchedule] = useState<WeeklyScheduleItem[]>(() =>
    completeWeeklySchedule(selectedCourt?.weeklySchedule ?? []),
  );

  function selectCourt(nextCourtId: string) {
    const nextCourt = venue.courts.find((court) => court.id === nextCourtId);
    setCourtId(nextCourtId);
    setSchedule(completeWeeklySchedule(nextCourt?.weeklySchedule ?? []));
    setInterval(numericSetting(nextCourt?.settings, "intervalMinutes", 60));
    setBuffer(numericSetting(nextCourt?.settings, "bufferMinutes", 15));
    setBookingWindowDays(numericSetting(nextCourt?.settings, "bookingWindowDays", 30));
    setMinimumLeadMinutes(
      numericSetting(nextCourt?.settings, "minimumLeadMinutes", 60),
    );
    setMaximumDurationMinutes(
      numericSetting(nextCourt?.settings, "maximumDurationMinutes", 180),
    );
  }

  function updateScheduleDay(dayOfWeek: number, patch: Partial<WeeklyScheduleItem>) {
    setSchedule((current) =>
      current.map((item) =>
        item.dayOfWeek === dayOfWeek ? { ...item, ...patch } : item,
      ),
    );
  }
  if (venue.courts.length === 0) {
    return (
      <EmptyState
        title="Tambahkan lapangan dahulu"
        description="Jadwal disimpan per lapangan."
      />
    );
  }
  return (
    <div className="form-grid">
      <label>
        Lapangan
        <SelectField
          ariaLabel="Pilih lapangan"
          value={courtId}
          options={venue.courts.map((court) => ({
            value: court.id,
            label: court.name,
          }))}
          onValueChange={selectCourt}
        />
      </label>
      <label>
        Interval
        <SelectField
          ariaLabel="Interval booking"
          value={String(interval)}
          options={(masters.data?.intervals ?? [60]).map((value) => ({
            value: String(value),
            label: `${value} menit`,
          }))}
          onValueChange={(value) => setInterval(Number(value))}
        />
      </label>
      <label>
        Buffer
        <SelectField
          ariaLabel="Buffer booking"
          value={String(buffer)}
          options={(masters.data?.buffers ?? [15]).map((value) => ({
            value: String(value),
            label: `${value} menit`,
          }))}
          onValueChange={(value) => setBuffer(Number(value))}
        />
      </label>
      <label>
        Booking window (hari)
        <Input
          type="number"
          min={1}
          max={365}
          value={bookingWindowDays}
          onChange={(event) => setBookingWindowDays(Number(event.target.value))}
        />
      </label>
      <label>
        Minimum lead (menit)
        <Input
          type="number"
          min={0}
          value={minimumLeadMinutes}
          onChange={(event) => setMinimumLeadMinutes(Number(event.target.value))}
        />
      </label>
      <label>
        Durasi maksimum (menit)
        <Input
          type="number"
          min={interval}
          step={interval}
          value={maximumDurationMinutes}
          onChange={(event) => setMaximumDurationMinutes(Number(event.target.value))}
        />
      </label>
      <div className="weekly-schedule full-width">
        {schedule.map((item) => (
          <div key={item.dayOfWeek}>
            <label className="schedule-day-toggle">
              <input
                type="checkbox"
                checked={item.active}
                onChange={(event) =>
                  updateScheduleDay(item.dayOfWeek, { active: event.target.checked })
                }
              />
              {dayName(item.dayOfWeek)}
            </label>
            <Input
              aria-label={`Jam buka ${dayName(item.dayOfWeek)}`}
              type="time"
              disabled={!item.active}
              value={item.opensAt.slice(0, 5)}
              onChange={(event) =>
                updateScheduleDay(item.dayOfWeek, {
                  opensAt: `${event.target.value}:00`,
                })
              }
            />
            <span>—</span>
            <Input
              aria-label={`Jam tutup ${dayName(item.dayOfWeek)}`}
              type="time"
              disabled={!item.active}
              value={item.closesAt.slice(0, 5)}
              onChange={(event) =>
                updateScheduleDay(item.dayOfWeek, {
                  closesAt: `${event.target.value}:00`,
                })
              }
            />
          </div>
        ))}
      </div>
      <Button
        disabled={!courtId || update.isPending}
        onClick={() =>
          update.mutate({
            courtId,
            input: {
              intervalMinutes: interval,
              bufferMinutes: buffer,
              minimumDurationMinutes: interval,
              maximumDurationMinutes,
              bookingWindowDays,
              minimumLeadMinutes,
              weeklySchedule: schedule,
            },
          })
        }
      >
        Simpan ketersediaan
      </Button>
      <fieldset className="full-width">
        <legend>Pengecualian jadwal</legend>
        <div className="form-grid compact-form">
          <label>
            Jenis
            <SelectField
              ariaLabel="Jenis pengecualian jadwal"
              value={exceptionKind}
              options={[
                { value: "CLOSED", label: "Tutup" },
                { value: "OPEN", label: "Buka khusus" },
                { value: "CUSTOM_HOURS", label: "Ubah jam" },
              ]}
              onValueChange={(value) =>
                setExceptionKind(value as "CLOSED" | "OPEN" | "CUSTOM_HOURS")
              }
            />
          </label>
          {exceptionKind !== "CLOSED" && (
            <>
              <label>
                Jam buka
                <Input
                  type="time"
                  value={exceptionOpensAt}
                  onChange={(event) => setExceptionOpensAt(event.target.value)}
                />
              </label>
              <label>
                Jam tutup
                <Input
                  type="time"
                  value={exceptionClosesAt}
                  onChange={(event) => setExceptionClosesAt(event.target.value)}
                />
              </label>
            </>
          )}
          <label>
            Tanggal
            <Input
              type="date"
              value={exceptionDate}
              onChange={(event) => setExceptionDate(event.target.value)}
            />
          </label>
          <label>
            Alasan
            <Input
              value={exceptionReason}
              onChange={(event) => setExceptionReason(event.target.value)}
            />
          </label>
          <Button
            variant="secondary"
            disabled={exceptionReason.trim().length < 3 || createException.isPending}
            onClick={() =>
              createException.mutate({
                courtId,
                localDate: exceptionDate,
                kind: exceptionKind,
                opensAt: exceptionKind === "CLOSED" ? undefined : exceptionOpensAt,
                closesAt: exceptionKind === "CLOSED" ? undefined : exceptionClosesAt,
                reason: exceptionReason.trim(),
              })
            }
          >
            Simpan pengecualian
          </Button>
        </div>
        {venue.exceptions.length > 0 && (
          <p>{venue.exceptions.length} pengecualian tersimpan.</p>
        )}
      </fieldset>
      <fieldset className="full-width">
        <legend>Block, maintenance, atau closure</legend>
        <div className="form-grid compact-form">
          <label>
            Jenis
            <SelectField
              ariaLabel="Jenis block jadwal"
              value={closureKind}
              options={[
                { value: "MAINTENANCE", label: "Maintenance" },
                { value: "BLOCK", label: "Internal event" },
                { value: "CLOSURE", label: "Closure" },
              ]}
              onValueChange={(value) =>
                setClosureKind(value as "CLOSURE" | "MAINTENANCE" | "BLOCK")
              }
            />
          </label>
          <label>
            Mulai
            <Input
              type="datetime-local"
              value={closureStartsAt}
              onChange={(event) => setClosureStartsAt(event.target.value)}
            />
          </label>
          <label>
            Selesai
            <Input
              type="datetime-local"
              value={closureEndsAt}
              onChange={(event) => setClosureEndsAt(event.target.value)}
            />
          </label>
          <label>
            Alasan
            <Input
              value={closureReason}
              onChange={(event) => setClosureReason(event.target.value)}
            />
          </label>
          <Button
            variant="secondary"
            disabled={
              !courtId ||
              !closureStartsAt ||
              !closureEndsAt ||
              closureReason.trim().length < 3 ||
              createClosure.isPending
            }
            onClick={() =>
              createClosure.mutate({
                venueId: venue.id,
                courtId,
                startsAt: new Date(closureStartsAt).toISOString(),
                endsAt: new Date(closureEndsAt).toISOString(),
                kind: closureKind,
                reason: closureReason.trim(),
              })
            }
          >
            Simpan block
          </Button>
        </div>
        {createClosure.data && (
          <div className="inline-alert warning" role="status">
            <strong>
              {createClosure.data.impactedBookingIds.length} booking terdampak
            </strong>
            <span>Buka kalender operasional untuk memilih cancel atau reschedule.</span>
          </div>
        )}
        {createClosure.error && (
          <p className="field-error">{createClosure.error.message}</p>
        )}
      </fieldset>
    </div>
  );
}

function PricingSetupView({ tenantId, venue }: SetupFormProps) {
  const rules = normalizePriceRules(venue.priceRules);
  const createRule = useCreatePriceRule(tenantId, venue.id);
  const preview = usePricingPreview(tenantId, venue.id);
  const [amount, setAmount] = useState(100_000);
  const [courtId, setCourtId] = useState<string | null>(null);
  const [kind, setKind] = useState<
    "BASE" | "WEEKDAY_WEEKEND" | "DAY_TIME" | "SPECIAL_DATE"
  >("BASE");
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [specialDate, setSpecialDate] = useState(new Date().toISOString().slice(0, 10));
  const [startsAtLocal, setStartsAtLocal] = useState("18:00");
  const [endsAtLocal, setEndsAtLocal] = useState("22:00");
  const [previewTime, setPreviewTime] = useState("19:00");

  function currentPriceRule() {
    return {
      tenantId,
      venueId: venue.id,
      courtId,
      kind,
      amount,
      dayOfWeek: kind === "WEEKDAY_WEEKEND" || kind === "DAY_TIME" ? dayOfWeek : null,
      specialDate: kind === "SPECIAL_DATE" ? specialDate : null,
      startsAtLocal:
        kind === "DAY_TIME" || kind === "SPECIAL_DATE" ? `${startsAtLocal}:00` : null,
      endsAtLocal:
        kind === "DAY_TIME" || kind === "SPECIAL_DATE" ? `${endsAtLocal}:00` : null,
    };
  }

  return (
    <div>
      <h2>Aturan harga</h2>
      {rules.length === 0 ? (
        <EmptyState
          title="Belum ada aturan harga"
          description="Tambahkan harga dasar agar venue dapat diajukan."
        />
      ) : (
        <div className="data-card">
          {rules.map((rule) => (
            <div className="list-item" key={rule.id}>
              <div>
                <strong>{rule.kind}</strong>
                <small>
                  {new Intl.NumberFormat("id-ID", {
                    style: "currency",
                    currency: "IDR",
                    maximumFractionDigits: 0,
                  }).format(rule.amount)}
                </small>
              </div>
              <Badge tone={rule.active ? "success" : "neutral"}>
                {rule.active ? "Aktif" : "Nonaktif"}
              </Badge>
            </div>
          ))}
        </div>
      )}
      <div className="form-grid compact-form">
        <label>
          Jenis aturan
          <SelectField
            ariaLabel="Jenis aturan harga"
            value={kind}
            options={[
              { value: "BASE", label: "Harga dasar" },
              { value: "WEEKDAY_WEEKEND", label: "Hari tertentu" },
              { value: "DAY_TIME", label: "Hari dan jam" },
              { value: "SPECIAL_DATE", label: "Tanggal khusus" },
            ]}
            onValueChange={(value) =>
              setKind(value as "BASE" | "WEEKDAY_WEEKEND" | "DAY_TIME" | "SPECIAL_DATE")
            }
          />
        </label>
        <label>
          Scope
          <SelectField
            ariaLabel="Scope harga"
            value={courtId ?? "venue"}
            options={[
              { value: "venue", label: "Semua lapangan" },
              ...venue.courts.map((court) => ({ value: court.id, label: court.name })),
            ]}
            onValueChange={(value) => setCourtId(value === "venue" ? null : value)}
          />
        </label>
        <label>
          Harga per slot
          <Input
            type="number"
            min={1}
            value={amount}
            onChange={(event) => setAmount(Number(event.target.value))}
          />
        </label>
        {(kind === "WEEKDAY_WEEKEND" || kind === "DAY_TIME") && (
          <label>
            Hari
            <SelectField
              ariaLabel="Hari aturan harga"
              value={String(dayOfWeek)}
              options={Array.from({ length: 7 }, (_, value) => ({
                value: String(value),
                label: dayName(value),
              }))}
              onValueChange={(value) => setDayOfWeek(Number(value))}
            />
          </label>
        )}
        {kind === "SPECIAL_DATE" && (
          <label>
            Tanggal khusus
            <Input
              type="date"
              value={specialDate}
              onChange={(event) => setSpecialDate(event.target.value)}
            />
          </label>
        )}
        {(kind === "DAY_TIME" || kind === "SPECIAL_DATE") && (
          <>
            <label>
              Mulai
              <Input
                type="time"
                value={startsAtLocal}
                onChange={(event) => setStartsAtLocal(event.target.value)}
              />
            </label>
            <label>
              Selesai
              <Input
                type="time"
                value={endsAtLocal}
                onChange={(event) => setEndsAtLocal(event.target.value)}
              />
            </label>
          </>
        )}
        <Button
          disabled={amount <= 0 || createRule.isPending}
          onClick={() => createRule.mutate(currentPriceRule())}
        >
          Tambah aturan harga
        </Button>
      </div>
      {createRule.error && <p className="field-error">{createRule.error.message}</p>}
      <fieldset className="pricing-preview full-width">
        <legend>Preview harga</legend>
        <p>
          Periksa rule terpilih pada tiga tanggal sebelum mengaktifkan publikasi venue.
        </p>
        <div className="form-grid compact-form">
          <label>
            Mulai tanggal
            <Input
              type="date"
              value={specialDate}
              onChange={(event) => setSpecialDate(event.target.value)}
            />
          </label>
          <label>
            Jam
            <Input
              type="time"
              value={previewTime}
              onChange={(event) => setPreviewTime(event.target.value)}
            />
          </label>
          <Button
            variant="secondary"
            disabled={!(courtId ?? venue.courts[0]?.id) || preview.isPending}
            onClick={() => {
              const previewCourtId = courtId ?? venue.courts[0]?.id;
              if (!previewCourtId) return;
              preview.mutate({
                courtId: previewCourtId,
                samples: previewDates(specialDate).map((localDate) => ({
                  localDate,
                  localTime: `${previewTime}:00`,
                })),
                candidate: currentPriceRule(),
              });
            }}
          >
            {preview.isPending ? "Menghitung…" : "Preview 3 tanggal"}
          </Button>
        </div>
        {preview.data && (
          <div className="data-card">
            {preview.data.items.map((item) => (
              <div className="list-item" key={`${item.localDate}-${item.localTime}`}>
                <span>
                  <strong>{item.localDate}</strong>
                  <small>
                    {item.localTime.slice(0, 5)} · {item.selectedKind} · {item.scope}
                  </small>
                </span>
                <strong>
                  {new Intl.NumberFormat("id-ID", {
                    style: "currency",
                    currency: "IDR",
                    maximumFractionDigits: 0,
                  }).format(item.amount)}
                </strong>
              </div>
            ))}
          </div>
        )}
        {preview.error && <p className="field-error">{preview.error.message}</p>}
      </fieldset>
    </div>
  );
}

function PaymentSettingsForm({ tenantId, venue }: SetupFormProps) {
  const update = useUpdateVenuePaymentSettings(tenantId, venue.id);
  const createAddon = useCreateVenueAddon(tenantId, venue.id);
  const submitVenue = useSubmitBusinessVenue(tenantId, venue.id);
  const current = venue.paymentSettings;
  const [allowFull, setAllowFull] = useState(current?.allowFull ?? true);
  const [allowDp, setAllowDp] = useState(current?.allowDp ?? true);
  const [allowPayAtVenue, setAllowPayAtVenue] = useState(
    current?.allowPayAtVenue ?? true,
  );
  const [dpPercentage, setDpPercentage] = useState(current?.dpPercentage ?? 50);
  const [reservationAmount, setReservationAmount] = useState(
    current?.reservationAmount ?? 50_000,
  );
  const [manualConfirmationMinutes, setManualConfirmationMinutes] = useState(
    current?.manualConfirmationMinutes ?? 30,
  );
  const [balanceDeadlineMinutes, setBalanceDeadlineMinutes] = useState(
    current?.balanceDeadlineMinutes ?? 120,
  );
  const [addonName, setAddonName] = useState("");
  const [addonPrice, setAddonPrice] = useState(25_000);
  return (
    <div className="form-grid">
      <CheckboxOption label="Bayar penuh" checked={allowFull} onChange={setAllowFull} />
      <CheckboxOption label="DP" checked={allowDp} onChange={setAllowDp} />
      <CheckboxOption
        label="Bayar di venue"
        checked={allowPayAtVenue}
        onChange={setAllowPayAtVenue}
      />
      <label>
        Persentase DP
        <Input
          type="number"
          min={1}
          max={100}
          value={dpPercentage}
          disabled={!allowDp}
          onChange={(event) => setDpPercentage(Number(event.target.value))}
        />
      </label>
      <label>
        Reservation amount
        <Input
          type="number"
          min={0}
          value={reservationAmount}
          disabled={!allowPayAtVenue}
          onChange={(event) => setReservationAmount(Number(event.target.value))}
        />
      </label>
      <label>
        Timeout konfirmasi (menit)
        <Input
          type="number"
          min={5}
          value={manualConfirmationMinutes}
          onChange={(event) => setManualConfirmationMinutes(Number(event.target.value))}
        />
      </label>
      <label>
        Deadline pelunasan (menit)
        <Input
          type="number"
          min={0}
          value={balanceDeadlineMinutes}
          onChange={(event) => setBalanceDeadlineMinutes(Number(event.target.value))}
        />
      </label>
      <Button
        disabled={(!allowFull && !allowDp && !allowPayAtVenue) || update.isPending}
        onClick={() =>
          update.mutate({
            allowFull,
            allowDp,
            dpPercentage: allowDp ? dpPercentage : null,
            allowPayAtVenue,
            reservationAmount: allowPayAtVenue ? reservationAmount : null,
            manualConfirmationMinutes,
            balanceDeadlineMinutes,
          })
        }
      >
        Simpan opsi pembayaran
      </Button>
      <fieldset className="full-width">
        <legend>Add-on venue</legend>
        <div className="data-card">
          {venue.addons.map((addon) => (
            <div className="list-item" key={String(addon.id)}>
              <strong>{String(addon.name)}</strong>
              <span>
                {typeof addon.price === "number"
                  ? new Intl.NumberFormat("id-ID").format(addon.price)
                  : "-"}
              </span>
            </div>
          ))}
        </div>
        <div className="form-grid compact-form">
          <label>
            Nama
            <Input
              value={addonName}
              onChange={(event) => setAddonName(event.target.value)}
            />
          </label>
          <label>
            Harga
            <Input
              type="number"
              value={addonPrice}
              onChange={(event) => setAddonPrice(Number(event.target.value))}
            />
          </label>
          <Button
            variant="secondary"
            disabled={
              addonName.trim().length < 2 || addonPrice < 0 || createAddon.isPending
            }
            onClick={() =>
              createAddon.mutate({ name: addonName.trim(), price: addonPrice })
            }
          >
            Tambah add-on
          </Button>
        </div>
      </fieldset>
      <section
        className="publication-preview full-width"
        aria-labelledby="publication-preview-title"
      >
        <div>
          <p className="eyebrow">Preview publikasi</p>
          <h2 id="publication-preview-title">{venue.name}</h2>
          <p>{venue.addressLine}</p>
        </div>
        <div>
          <strong>{venue.courts.length}</strong>
          <span>lapangan</span>
        </div>
        <div>
          <strong>{venue.progress.percentage}%</strong>
          <span>setup lengkap</span>
        </div>
        <Button
          disabled={!venue.progress.complete || submitVenue.isPending}
          onClick={() => submitVenue.mutate()}
          title={
            venue.progress.complete
              ? undefined
              : "Lengkapi seluruh bagian wajib sebelum mengirim."
          }
        >
          {submitVenue.isPending ? "Mengirim…" : "Ajukan verifikasi"}
        </Button>
        {submitVenue.error && (
          <p className="field-error">{submitVenue.error.message}</p>
        )}
      </section>
    </div>
  );
}

type SetupVenue = NonNullable<ReturnType<typeof useBusinessVenue>["data"]>;
interface SetupFormProps {
  tenantId: string;
  venue: SetupVenue;
}

function CheckboxOption({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="checkbox-row">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}
function toggleId(values: string[], id: string, enabled: boolean): string[] {
  return enabled
    ? [...new Set([...values, id])]
    : values.filter((value) => value !== id);
}

function validateVenueImage(file: File): string | null {
  if (!acceptedVenueImageTypes.has(file.type)) {
    return "File foto harus berupa JPG, PNG, atau WebP.";
  }
  if (file.size > maximumVenueImageBytes) {
    return "Ukuran file foto maksimal 10 MB.";
  }
  return null;
}
function dayName(day: number): string {
  return (
    ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"][day] ?? "Hari"
  );
}
function statusTone(status: string): "success" | "warning" | "danger" {
  return status === "APPROVED"
    ? "success"
    : status === "REJECTED" || status === "REVISION_REQUIRED"
      ? "danger"
      : "warning";
}
function statusText(status: string): string {
  return (
    (
      {
        DRAFT: "Draft",
        PRIVATE: "Draft",
        SUBMITTED: "Menunggu review",
        IN_REVIEW: "Menunggu review",
        APPROVED: "Disetujui",
        ACTIVE: "Aktif",
        INACTIVE: "Nonaktif",
        SUSPENDED: "Ditangguhkan",
        REJECTED: "Ditolak",
        REVISION_REQUIRED: "Perlu revisi",
      } as Record<string, string>
    )[status] ?? status
  );
}
function LoadingCard({ label }: { label: string }) {
  return (
    <Card className="state-card" aria-busy="true">
      {label}
    </Card>
  );
}
function QueryError({ onRetry }: { onRetry: () => void }) {
  return (
    <EmptyState
      title="Data belum dapat dimuat"
      description="Periksa koneksi API dan coba lagi."
      action={<Button onClick={onRetry}>Coba lagi</Button>}
    />
  );
}
function InvalidWorkspace() {
  return (
    <EmptyState
      title="Workspace tidak valid"
      description="Pilih workspace bisnis dari menu akun."
    />
  );
}

function numericSetting(
  settings: Record<string, unknown> | null | undefined,
  key: string,
  fallback: number,
): number {
  const value = settings?.[key];
  return typeof value === "number" ? value : fallback;
}

interface WeeklyScheduleItem {
  dayOfWeek: number;
  opensAt: string;
  closesAt: string;
  active: boolean;
}

function normalizeWeeklySchedule(
  values: Array<Record<string, unknown>>,
): WeeklyScheduleItem[] {
  return values.flatMap((value) =>
    typeof value.dayOfWeek === "number" &&
    typeof value.opensAt === "string" &&
    typeof value.closesAt === "string" &&
    typeof value.active === "boolean"
      ? [
          {
            dayOfWeek: value.dayOfWeek,
            opensAt: value.opensAt,
            closesAt: value.closesAt,
            active: value.active,
          },
        ]
      : [],
  );
}

function completeWeeklySchedule(
  values: Array<Record<string, unknown>>,
): WeeklyScheduleItem[] {
  const savedSchedule = normalizeWeeklySchedule(values);
  return Array.from(
    { length: 7 },
    (_, dayOfWeek) =>
      savedSchedule.find((item) => item.dayOfWeek === dayOfWeek) ?? {
        dayOfWeek,
        opensAt: "07:00:00",
        closesAt: "23:00:00",
        active: true,
      },
  );
}

function normalizePriceRules(values: Array<Record<string, unknown>>) {
  return values.flatMap((value) =>
    typeof value.id === "string" &&
    typeof value.kind === "string" &&
    typeof value.amount === "number" &&
    typeof value.active === "boolean"
      ? [{ id: value.id, kind: value.kind, amount: value.amount, active: value.active }]
      : [],
  );
}

function previewDates(startDate: string): string[] {
  const start = new Date(`${startDate}T12:00:00Z`);
  return Array.from({ length: 3 }, (_, offset) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + offset);
    return date.toISOString().slice(0, 10);
  });
}
