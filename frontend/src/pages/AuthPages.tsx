import { zodResolver } from "@hookform/resolvers/zod";
import { ApiClientError } from "@lapangango/api-client";
import { ArrowRight, CheckCircle2, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { useLogin, useRegister } from "../api/session";
import { Button, Input } from "../components/ui";

const loginSchema = z.object({
  email: z.email("Masukkan alamat email yang valid."),
  password: z.string().min(1, "Password wajib diisi."),
});

const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Nama minimal 2 karakter.")
      .max(50, "Nama maksimal 50 karakter."),
    email: z.email("Masukkan alamat email yang valid."),
    phone: z
      .string()
      .trim()
      .min(8, "Nomor telepon minimal 8 karakter.")
      .max(16, "Nomor telepon maksimal 16 karakter."),
    password: z.string().min(10, "Password minimal 10 karakter."),
    passwordConfirmation: z.string(),
  })
  .refine((values) => values.password === values.passwordConfirmation, {
    path: ["passwordConfirmation"],
    message: "Konfirmasi password belum sama.",
  });

type LoginForm = z.infer<typeof loginSchema>;
type RegisterForm = z.infer<typeof registerSchema>;

export function LoginPage() {
  const login = useLogin();
  const navigate = useNavigate();
  const location = useLocation();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "" },
  });

  const destination = readDestination(location.state);

  async function submit(values: LoginForm) {
    await login.mutateAsync(values);
    navigate(destination, { replace: true });
  }

  return (
    <AuthLayout
      eyebrow="Selamat datang kembali"
      title="Masuk ke LapanganGo"
      description="Kelola booking, pembayaran, dan aktivitas olahraga dari satu akun."
    >
      <form className="auth-form" onSubmit={handleSubmit(submit)} noValidate>
        <FormField htmlFor="login-email" label="Email" error={errors.email?.message}>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            placeholder="nama@email.com"
            {...register("email")}
          />
        </FormField>
        <FormField
          htmlFor="login-password"
          label="Password"
          error={errors.password?.message}
        >
          <PasswordInput
            id="login-password"
            visible={passwordVisible}
            onToggle={() => setPasswordVisible((current) => !current)}
            autoComplete="current-password"
            registration={register("password")}
          />
        </FormField>
        {login.isError && <AuthError error={login.error} />}
        <Button type="submit" size="lg" disabled={login.isPending}>
          {login.isPending ? "Memeriksa akun…" : "Masuk"}
          {!login.isPending && <ArrowRight />}
        </Button>
        <a
          className="btn btn-secondary btn-lg auth-google"
          href="/api/v1/auth/google/start"
        >
          <span aria-hidden="true">G</span>
          Lanjutkan dengan Google
        </a>
      </form>
      <p className="auth-switch">
        Belum memiliki akun?{" "}
        <Link to="/register" state={{ from: destination }}>
          Daftar sekarang
        </Link>
      </p>
    </AuthLayout>
  );
}

export function RegisterPage() {
  const registerAccount = useRegister();
  const navigate = useNavigate();
  const location = useLocation();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) });
  const destination = readDestination(location.state);

  async function submit(values: RegisterForm) {
    await registerAccount.mutateAsync({
      name: values.name,
      email: values.email,
      phone: values.phone,
      password: values.password,
    });
    navigate(destination, { replace: true });
  }

  return (
    <AuthLayout
      eyebrow="Akun baru"
      title="Mulai main lebih mudah"
      description="Simpan venue favorit, kelola booking, dan ikuti aktivitas komunitasmu."
    >
      <form className="auth-form" onSubmit={handleSubmit(submit)} noValidate>
        <div className="auth-form-grid">
          <FormField
            htmlFor="register-name"
            label="Nama lengkap"
            error={errors.name?.message}
          >
            <Input
              id="register-name"
              autoComplete="name"
              placeholder="Nama lengkap"
              {...register("name")}
            />
          </FormField>
          <FormField
            htmlFor="register-phone"
            label="Nomor telepon"
            error={errors.phone?.message}
          >
            <Input
              id="register-phone"
              autoComplete="tel"
              placeholder="+62 812 3456 7890"
              {...register("phone")}
            />
          </FormField>
        </div>
        <FormField htmlFor="register-email" label="Email" error={errors.email?.message}>
          <Input
            id="register-email"
            type="email"
            autoComplete="email"
            placeholder="nama@email.com"
            {...register("email")}
          />
        </FormField>
        <FormField
          htmlFor="register-password"
          label="Password"
          error={errors.password?.message}
        >
          <PasswordInput
            id="register-password"
            visible={passwordVisible}
            onToggle={() => setPasswordVisible((current) => !current)}
            autoComplete="new-password"
            registration={register("password")}
          />
        </FormField>
        <FormField
          htmlFor="register-password-confirmation"
          label="Konfirmasi password"
          error={errors.passwordConfirmation?.message}
        >
          <Input
            id="register-password-confirmation"
            type={passwordVisible ? "text" : "password"}
            autoComplete="new-password"
            {...register("passwordConfirmation")}
          />
        </FormField>
        {registerAccount.isError && <AuthError error={registerAccount.error} />}
        <Button type="submit" size="lg" disabled={registerAccount.isPending}>
          {registerAccount.isPending ? "Membuat akun…" : "Buat akun"}
          {!registerAccount.isPending && <ArrowRight />}
        </Button>
      </form>
      <p className="auth-switch">
        Sudah memiliki akun?{" "}
        <Link to="/login" state={{ from: destination }}>
          Masuk
        </Link>
      </p>
    </AuthLayout>
  );
}

function AuthLayout({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main className="auth-page">
      <section className="auth-story" aria-label="Manfaat LapanganGo">
        <Link to="/" className="brand auth-brand" aria-label="LapanganGo beranda">
          <span className="brand-mark">LG</span>
          <span>
            Lapangan<strong>Go</strong>
          </span>
        </Link>
        <div>
          <p className="eyebrow">Booking olahraga tanpa ribet</p>
          <h2>Jadwal yang jelas, pembayaran transparan.</h2>
          <ul>
            <li>
              <CheckCircle2 /> Ketersediaan lapangan langsung dari server
            </li>
            <li>
              <CheckCircle2 /> Harga dihitung ulang saat checkout
            </li>
            <li>
              <ShieldCheck /> Session aman melalui cookie HttpOnly
            </li>
          </ul>
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-panel-content">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="auth-description">{description}</p>
          {children}
        </div>
      </section>
    </main>
  );
}

function FormField({
  htmlFor,
  label,
  error,
  children,
}: {
  htmlFor: string;
  label: string;
  error?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="auth-field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {error && <small className="field-error">{error}</small>}
    </div>
  );
}

function PasswordInput({
  id,
  visible,
  onToggle,
  autoComplete,
  registration,
}: {
  id: string;
  visible: boolean;
  onToggle: () => void;
  autoComplete: string;
  registration: UseFormRegisterReturn;
}) {
  return (
    <span className="password-input">
      <Input
        id={id}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        {...registration}
      />
      <button
        type="button"
        className="icon-button"
        onClick={onToggle}
        aria-label={visible ? "Sembunyikan password" : "Tampilkan password"}
      >
        {visible ? <EyeOff /> : <Eye />}
      </button>
    </span>
  );
}

function AuthError({ error }: { error: Error }) {
  const message =
    error instanceof ApiClientError
      ? error.body.message
      : "Permintaan belum berhasil. Coba kembali.";
  return (
    <p className="auth-error" role="alert">
      {message}
    </p>
  );
}

function readDestination(state: unknown): string {
  if (
    typeof state === "object" &&
    state !== null &&
    "from" in state &&
    typeof state.from === "string" &&
    state.from.startsWith("/")
  ) {
    return state.from;
  }
  return "/";
}
