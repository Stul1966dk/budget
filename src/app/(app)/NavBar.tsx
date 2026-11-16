"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/auth/signOut";
import { usePinnedNav } from "./usePinnedNav";

const LINKS = [
  { href: "/", label: "År" },
  { href: "/maaned", label: "Oversigt" },
  { href: "/upload", label: "Upload" },
  { href: "/regler", label: "Regler" },
  { href: "/budget", label: "Budget" },
  { href: "/prognose", label: "Rådgiver" },
];

export function NavBar() {
  const pathname = usePathname();
  const [pinned, setPinned] = usePinnedNav();

  return (
    <>
      <header className="flex items-center justify-between border-b border-stone-200 bg-white px-4 py-3 sm:px-6 lg:px-8">
        <span className="text-lg font-semibold text-forest-900">Budget</span>
        <form action={signOut}>
          <button
            type="submit"
            className="rounded-lg px-3 py-2 text-sm text-stone-500 transition hover:bg-stone-100 hover:text-stone-900"
          >
            Log ud
          </button>
        </form>
      </header>

      <nav
        className={`fixed inset-x-0 bottom-0 z-10 flex justify-around border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)] ${
          pinned ? "sm:sticky sm:top-0 sm:shadow-sm" : "sm:static"
        } sm:justify-start sm:gap-1 sm:border-b sm:border-t-0 sm:px-6 sm:pb-0 lg:px-8`}
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
              className={`flex-1 px-1 py-3 text-center text-xs font-medium sm:text-sm transition sm:flex-none sm:px-4 ${
                isActive
                  ? "text-forest-900 sm:border-b-2 sm:border-forest-900"
                  : "text-stone-500 hover:text-forest-900"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setPinned(!pinned)}
          aria-pressed={pinned}
          title={pinned ? "Lad menuen scrolle med siden" : "Hold menuen synlig, når du scroller"}
          className={`ml-auto hidden items-center gap-1.5 self-center rounded-lg px-2 py-1.5 text-xs transition sm:flex ${
            pinned
              ? "text-forest-900 hover:bg-stone-100"
              : "text-stone-400 hover:bg-stone-100 hover:text-stone-700"
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            fill={pinned ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path d="M9 3h6l-1 6 4 4H6l4-4-1-6z" />
            <path d="M12 13v8" strokeLinecap="round" />
          </svg>
          {pinned ? "Menu fastgjort" : "Fastgør menu"}
        </button>
      </nav>
    </>
  );
}
