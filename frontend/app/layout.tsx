import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { ToastProvider } from "@/components/providers/ToastProvider";
import { BottomNav } from "@/components/site/BottomNav";
import { Footer } from "@/components/site/Footer";
import { Navbar } from "@/components/site/Navbar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Nobar King Akbar Anime — Streaming & Nonton Bareng Anime",
    template: "%s · Nobar King Akbar Anime",
  },
  description:
    "Streaming anime subtitle Indonesia dan nonton bareng (nobar) online: buat room, sinkronkan pemutaran, dan ngobrol bareng teman dalam satu layar.",
  applicationName: "Nobar King Akbar Anime",
  keywords: ["nobar anime", "streaming anime", "nonton bareng", "anime sub indo", "nobar king akbar"],
  openGraph: {
    title: "Nobar King Akbar Anime",
    description:
      "Streaming anime dan nonton bareng online — sinkronkan pemutaran dan ngobrol bareng teman.",
    type: "website",
    locale: "id_ID",
  },
};

export const viewport: Viewport = {
  themeColor: "#08090c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-dvh bg-ink-950 font-sans text-fog-50 antialiased`}
      >
        <ToastProvider>
          <AuthProvider>
            <a
              href="#konten"
              className="sr-only z-[100] rounded-lg bg-accent-500 px-4 py-2 font-semibold text-ink-950 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
            >
              Lewati ke konten
            </a>
            <Navbar />
            <main
              id="konten"
              className="mx-auto w-full max-w-[1440px] px-4 pb-28 pt-20 sm:px-6 md:pb-20 lg:px-10"
            >
              {children}
            </main>
            <Footer />
            <BottomNav />
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
