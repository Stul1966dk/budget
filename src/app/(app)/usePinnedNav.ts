"use client";

import { useSyncExternalStore } from "react";

// Om menuen skal blive stående øverst, når man scroller (kun store skærme).
// Det er en ren visningsindstilling pr. enhed, så den gemmes i browseren.
const STORAGE_KEY = "budget:pinned-nav";
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getSnapshot(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function getServerSnapshot(): boolean {
  return false;
}

export function usePinnedNav(): [boolean, (pinned: boolean) => void] {
  const pinned = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function setPinned(value: boolean) {
    try {
      window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
    } catch {
      // Privat vindue eller blokeret lager - indstillingen huskes så bare ikke.
    }
    listeners.forEach((listener) => listener());
  }

  return [pinned, setPinned];
}
