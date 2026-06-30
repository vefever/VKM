// #22 — fire a celebratory "+40 pts" flyaway. The <FlyPointsHost/> (mounted in
// __root) listens for this event and renders the rising pill.
export function flyPoints(amount: number, label = "pts") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("vkm:flypoints", { detail: { text: `+${amount} ${label}` } }),
  );
}
