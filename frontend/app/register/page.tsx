import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/AuthForm";

export const metadata: Metadata = {
  title: "Daftar",
  description: "Buat akun Nobar King Akbar Anime — gratis.",
};

interface PageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function RegisterPage({ searchParams }: PageProps) {
  const params = await searchParams;
  return <AuthForm mode="register" next={params.next ?? null} />;
}
