"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/auth/signOut";

const LINKS = [
  { href: "/", label: "Oversigt" },
  { href: "/upload", label: "Upload" },
  { href: "/regler", label: "Regler" },
  { href: "/prognose", label: "Rådgiver" },
  { href: "/aar", label: "År" },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <>
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <span className="text-lg font-semibold text-slate-900">Budget</span>
        <form action={signOut}>
          <button
            type="submit"
            className="rounded-lg px-3 py-2 text-sm text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            Log ud
          </button>
        </form>
      </header>

      <nav
        className="fixed inset-x-0 bottom-0 z-10 flex justify-around border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] sm:static sm:justify-start sm:gap-1 sm:border-b sm:border-t-0 sm:px-6 sm:pb-0"
        aria-label="Hovednavigation"
      >
        {LINKS.map((link) => {
          const isActive =
            link.href === "/"
              ? pathname === "/"
              : pathname.startsWith(link.href);

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex-1 px-2 py-3 text-center text-sm font-medium transition sm:flex-none sm:px-4 ${
                isActive
                  ? "text-slate-900 sm:border-b-2 sm:border-slate-900"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
