"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  {
    href: "/",
    label: "Beranda",
    icon: (
      <path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1v-9.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    ),
  },
  {
    href: "/explore",
    label: "Jelajah",
    icon: (
      <>
        <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.7" />
        <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      </>
    ),
  },
  {
    href: "/nobar",
    label: "Nobar",
    icon: (
      <>
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
        <path
          d="M6.5 6.5a7.8 7.8 0 0 0 0 11M17.5 6.5a7.8 7.8 0 0 1 0 11M3.8 3.8a11.6 11.6 0 0 0 0 16.4M20.2 3.8a11.6 11.6 0 0 1 0 16.4"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </>
    ),
  },
  {
    href: "/rooms",
    label: "Room",
    icon: (
      <>
        <circle cx="9" cy="9" r="3.2" stroke="currentColor" strokeWidth="1.7" />
        <path d="M3.5 19c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M16 7.2a3 3 0 1 1 0 5.6M17.5 14.6c2 .4 3.3 1.8 3.7 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </>
    ),
  },
  {
    href: "/profile",
    label: "Profil",
    icon: (
      <>
        <circle cx="12" cy="8.5" r="3.6" stroke="currentColor" strokeWidth="1.7" />
        <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </>
    ),
  },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/[0.07] bg-ink-950/90 backdrop-blur-xl md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5 px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2">
        {ITEMS.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[10px] font-semibold transition-colors ${
                active ? "text-accent-400" : "text-fog-600 hover:text-fog-300"
              }`}
            >
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden>
                {item.icon}
              </svg>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
