"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/auth/signOut";
import { usePinnedNav } from "./usePinnedNav";

// Ikonerne vises kun i mobilmenuen i bunden af skærmen, så knapperne er
// store og nemme at ramme med fingeren.
const LINKS = [
  {
    href: "/",
    label: "År",
    icon: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </>
    ),
  },
  {
    href: "/maaned",
    label: "Posteringer",
    icon: <path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />,
  },
  {
    href: "/upload",
    label: "Upload",
    icon: <path d="M12 15V4M7 9l5-5 5 5M4 20h16" />,
  },
  {
    href: "/regler",
    label: "Regler",
    icon: (
      <>
        <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
        <circle cx="15" cy="7" r="2" />
        <circle cx="9" cy="17" r="2" />
      </>
    ),
  },
  {
    href: "/budget",
    label: "Budget",
    icon: (
      <>
        <path d="M12 3a9 9 0 1 0 9 9h-9z" />
        <path d="M15 3.5A9 9 0 0 1 20.5 9H15z" />
      </>
    ),
  },
  {
    href: "/prognose",
    label: "Rådgiver",
    icon: <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.4A8 8 0 1 1 21 12z" />,
  },
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
              aria-current={isActive ? "page" : undefined}
              className={`flex min-h-16 flex-1 select-none flex-col items-center justify-center gap-1 px-0.5 text-center text-xs font-medium transition [-webkit-tap-highlight-color:transparent] sm:min-h-0 sm:flex-none sm:px-4 sm:py-3 sm:text-sm ${
                isActive
                  ? "text-forest-900 sm:border-b-2 sm:border-forest-900"
                  : "text-stone-500 hover:text-forest-900 active:text-forest-900"
              }`}
            >
              <span
                className={`flex h-8 w-14 items-center justify-center rounded-full transition sm:hidden ${
                  isActive ? "bg-forest-100" : ""
                }`}
                aria-hidden="true"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-6 w-6"
                >
                  {link.icon}
                </svg>
              </span>
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
