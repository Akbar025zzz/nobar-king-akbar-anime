"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { Spinner } from "@/components/ui/Spinner";
import { errorMessage } from "@/lib/api";

interface AuthFormProps {
  mode: "login" | "register";
  next: string | null;
}

export function AuthForm({ mode, next }: AuthFormProps) {
  const router = useRouter();
  const { login, register, user, loading } = useAuth();
  const { toast } = useToast();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const isLogin = mode === "login";
  const target = next && next.startsWith("/") ? next : "/";

  useEffect(() => {
    if (!loading && user) {
      router.replace(target);
    }
  }, [loading, user, router, target]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      if (isLogin) {
        const logged = await login(email.trim(), password);
        toast(`Selamat datang kembali, ${logged.username}!`, "success");
      } else {
        const created = await register(username.trim(), email.trim(), password);
        toast(`Akun dibuat. Halo, ${created.username}!`, "success");
      }
      router.push(target);
    } catch (error) {
      const message = errorMessage(error);
      setFormError(message);
      toast(message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col pt-8">
      <div className="panel rounded-3xl p-7 sm:p-8">
        <p className="section-kicker">{isLogin ? "Selamat datang kembali" : "Bergabung sekarang"}</p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-fog-50">
          {isLogin ? "Masuk ke akunmu" : "Buat akun baru"}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-fog-500">
          {isLogin
            ? "Lanjutkan menonton, simpan favorit, dan masuk ke room nobar."
            : "Gratis. Buat room nobar, simpan favorit, dan lanjutkan tontonan kapan saja."}
        </p>

        <form onSubmit={(event) => void submit(event)} className="mt-6 space-y-4">
          {!isLogin ? (
            <div>
              <label htmlFor="username" className="mb-1.5 block text-xs font-semibold text-fog-400">
                Nama pengguna
              </label>
              <input
                id="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
                minLength={3}
                maxLength={24}
                autoComplete="username"
                placeholder="mis. raja_nobar"
                className="input"
              />
            </div>
          ) : null}

          <div>
            <label htmlFor="email" className="mb-1.5 block text-xs font-semibold text-fog-400">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
              placeholder="nama@email.com"
              className="input"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-xs font-semibold text-fog-400">
              Kata sandi
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={8}
                maxLength={72}
                autoComplete={isLogin ? "current-password" : "new-password"}
                placeholder={isLogin ? "Kata sandi kamu" : "Minimal 8 karakter"}
                className="input pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-fog-600 transition-colors hover:text-fog-300"
                aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
              >
                {showPassword ? (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M10.6 5.3A9.8 9.8 0 0 1 12 5.2c5 0 9 4.4 9 6.8 0 .9-.6 2.2-1.7 3.5M6.6 6.7C4.3 8.3 3 10.4 3 12c0 2.4 4 6.8 9 6.8 1.5 0 2.9-.4 4.1-1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M3 12c0-2.4 4-6.8 9-6.8s9 4.4 9 6.8-4 6.8-9 6.8S3 14.4 3 12Z" stroke="currentColor" strokeWidth="1.8" />
                    <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.8" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {formError ? (
            <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-400">
              {formError}
            </p>
          ) : null}

          <button type="submit" disabled={submitting} className="btn btn-primary w-full">
            {submitting ? (
              <>
                <Spinner size={15} /> {isLogin ? "Masuk…" : "Membuat akun…"}
              </>
            ) : isLogin ? (
              "Masuk"
            ) : (
              "Daftar Sekarang"
            )}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-fog-500">
          {isLogin ? (
            <>
              Belum punya akun?{" "}
              <Link
                href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"}
                className="font-semibold text-accent-400 hover:text-accent-300"
              >
                Daftar gratis
              </Link>
            </>
          ) : (
            <>
              Sudah punya akun?{" "}
              <Link
                href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
                className="font-semibold text-accent-400 hover:text-accent-300"
              >
                Masuk di sini
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
