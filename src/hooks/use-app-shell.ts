import { useEffect, useState } from "react";

// The "app shell" gate (#45). When true we apply native-app treatments
// (haptics, app toasts, gestures, slide transitions). Desktop pointer users
// get the unchanged web experience.
export type AppShellState = {
  appShell: boolean;
  standalone: boolean;
  touch: boolean;
  small: boolean;
  reducedMotion: boolean;
};

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // @ts-expect-error iOS Safari
    window.navigator.standalone === true
  );
}

function compute(): AppShellState {
  if (typeof window === "undefined") {
    return { appShell: false, standalone: false, touch: false, small: false, reducedMotion: false };
  }
  const standalone = isStandalone();
  const touch = window.matchMedia("(pointer: coarse)").matches;
  const small = window.matchMedia("(max-width: 768px)").matches;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return { appShell: standalone || (touch && small), standalone, touch, small, reducedMotion };
}

export function useAppShell(): AppShellState {
  // Start from a server-safe default; recompute after mount to avoid hydration drift.
  const [state, setState] = useState<AppShellState>({
    appShell: false,
    standalone: false,
    touch: false,
    small: false,
    reducedMotion: false,
  });

  useEffect(() => {
    const update = () => setState(compute());
    update();
    const mqls = [
      window.matchMedia("(max-width: 768px)"),
      window.matchMedia("(pointer: coarse)"),
      window.matchMedia("(display-mode: standalone)"),
      window.matchMedia("(prefers-reduced-motion: reduce)"),
    ];
    mqls.forEach((m) => m.addEventListener("change", update));
    return () => mqls.forEach((m) => m.removeEventListener("change", update));
  }, []);

  return state;
}
