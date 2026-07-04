import { useEffect } from "react";

// Publishes the on-screen keyboard's overlap with the layout viewport as a
// global `--kb` CSS variable (px). Mounted ONCE in AppShell so every
// bottom-anchored input (chat composer, AI advisor, assistant sheet) can stay
// above the keyboard with `calc(... - var(--kb, 0px))` — previously this
// listener lived inside the chat thread only and was torn down when it
// unmounted, leaving other composers keyboard-blind.
export function useKeyboardInset() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onChange = () => {
      const overlap = window.innerHeight - vv.height - vv.offsetTop;
      document.documentElement.style.setProperty("--kb", `${Math.max(0, overlap)}px`);
    };
    vv.addEventListener("resize", onChange);
    vv.addEventListener("scroll", onChange);
    onChange();
    return () => {
      vv.removeEventListener("resize", onChange);
      vv.removeEventListener("scroll", onChange);
      document.documentElement.style.removeProperty("--kb");
    };
  }, []);
}
