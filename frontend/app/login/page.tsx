import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/AuthForm";

export const metadata: Metadata = {
  title: "Masuk",
  description: "Masuk ke akun Nobar King Akbar Anime.",
};

interface PageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function LoginPage({ searchParams }: PageProps) {
  const params = await searchParams;
  return <AuthForm mode="login" next={params.next ?? null} />;
}
