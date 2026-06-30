import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassWater, Plus, Minus, Droplets, Clock, AlertTriangle } from "lucide-react";
import { SectionCard } from "@/components/vkm/section-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import { GLASS_ML } from "@/components/habits/habit-tracker";

function Wave({ opacity, dur, color }: { opacity: number; dur: string; color: string }) {
  return (
    <svg
      viewBox="0 0 240 20"
      preserveAspectRatio="none"
      className="water-wave absolute -top-[9px] left-0 h-3 w-[200%]"
      style={{ ["--wm-dur" as string]: dur, opacity }}
    >
      <path
        d="M0,10 C20,2 40,18 60,10 C80,2 100,18 120,10 C140,2 160,18 180,10 C200,2 220,18 240,10 L240,20 L0,20 Z"
        fill={color}
      />
    </svg>
  );
}

function BigGlass({ pct, label }: { pct: number; label: string }) {
  return (
    <div className="relative h-44 w-28 shrink-0 overflow-hidden rounded-b-[2.2rem] rounded-t-xl border-[3px] border-sky-200 bg-sky-50/60">
      <motion.div
        className="absolute inset-x-0 bottom-0 bg-gradient-to-b from-[#38bdf8] to-[#0ea5e9]"
        initial={false}
        animate={{ height: `${pct}%` }}
        transition={{ type: "spring", stiffness: 120, damping: 18 }}
      >
        <Wave opacity={0.9} dur="2.6s" color="#7dd3fc" />
        <Wave opacity={0.5} dur="4.2s" color="#bae6fd" />
      </motion.div>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("text-xl font-bold", pct > 45 ? "text-white" : "text-sky-600")}>
          {label}
        </span>
        <span className={cn("text-[10px]", pct > 45 ? "text-white/80" : "text-sky-500")}>
          {Math.round(pct)}%
        </span>
      </div>
    </div>
  );
}

export function WaterTracker({
  ml,
  goalMl,
  lastAddAt,
  cooldownMs,
  addGlass,
  removeGlass,
}: {
  ml: number;
  goalMl: number;
  lastAddAt: number | null;
  cooldownMs: number;
  addGlass: (reason?: string) => void;
  removeGlass: () => void;
}) {
  const glasses = Math.round(goalMl / GLASS_ML);
  const filled = Math.floor(ml / GLASS_ML);
  const pct = Math.min((ml / goalMl) * 100, 100);

  // Live clock so the cooldown counts down.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remainingMs = lastAddAt ? Math.max(0, lastAddAt + cooldownMs - now) : 0;
  const withinCooldown = remainingMs > 0;
  const remMin = Math.floor(remainingMs / 60000);
  const remSec = Math.floor((remainingMs % 60000) / 1000);

  const [askReason, setAskReason] = useState(false);
  const [reason, setReason] = useState("");

  function attemptAdd() {
    if (ml >= goalMl) return;
    if (withinCooldown) {
      setAskReason(true);
      return;
    }
    haptic(ml + GLASS_ML >= goalMl ? "success" : "tick");
    addGlass();
  }
  function confirmRapid() {
    if (!reason.trim()) return;
    haptic("tick");
    addGlass(reason);
    setReason("");
    setAskReason(false);
  }

  function tapGlass(i: number) {
    if (i === filled) attemptAdd();
    else if (i === filled - 1) removeGlass();
    // tapping ahead / middle is ignored — one glass at a time.
  }

  return (
    <SectionCard
      title="Hydration"
      subtitle={`${(ml / 1000).toFixed(2)} L of ${(goalMl / 1000).toFixed(0)} L · one glass at a time`}
      action={
        ml >= goalMl ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#0ea5e9]/15 px-2 py-0.5 text-[11px] font-semibold text-[#0369a1]">
            <Droplets className="h-3 w-3" /> Goal hit 🎉
          </span>
        ) : withinCooldown ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
            <Clock className="h-3 w-3" /> next in {remMin}:{String(remSec).padStart(2, "0")}
          </span>
        ) : undefined
      }
    >
      <div className="flex items-center gap-5">
        <BigGlass pct={pct} label={`${(ml / 1000).toFixed(1)}L`} />

        <div className="min-w-0 flex-1">
          {/* Mobile: a compact segmented progress bar (the icon grid overflows < 400px) */}
          <div className="sm:hidden">
            <div className="flex gap-1">
              {Array.from({ length: glasses }, (_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-3 flex-1 rounded-full transition-colors",
                    i < filled ? "bg-[#0ea5e9]" : "bg-muted",
                  )}
                />
              ))}
            </div>
            <p className="mt-2 text-sm font-semibold text-foreground">
              {filled} / {glasses} glasses · {(ml / 1000).toFixed(1)}L
            </p>
          </div>

          {/* Tablet/desktop: the delightful tappable glass grid (≥44px targets, wraps) */}
          <div className="hidden gap-1.5 sm:grid sm:grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))]">
            {Array.from({ length: glasses }, (_, i) => {
              const isFilled = i < filled;
              const isNext = i === filled;
              return (
                <motion.button
                  key={i}
                  type="button"
                  onClick={() => tapGlass(i)}
                  whileTap={{ scale: 0.8 }}
                  className={cn(
                    "flex aspect-square items-center justify-center rounded-lg transition-colors",
                    isNext && !isFilled && "ring-1 ring-[#0ea5e9]/40",
                  )}
                  aria-label={`Glass ${i + 1}`}
                >
                  <GlassWater
                    className={cn(
                      "h-5 w-5 transition-colors",
                      isFilled ? "text-[#0ea5e9]" : "text-muted-foreground/30",
                    )}
                    fill={isFilled ? "#bae6fd" : "transparent"}
                  />
                </motion.button>
              );
            })}
          </div>

          {/* Controls */}
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={removeGlass}
              disabled={filled === 0}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-foreground transition-colors hover:bg-secondary/60 disabled:opacity-40"
              aria-label="Remove a glass"
            >
              <Minus className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={attemptAdd}
              disabled={ml >= goalMl}
              className={cn(
                "inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50",
                withinCooldown ? "bg-amber-500" : "bg-[#0ea5e9]",
              )}
            >
              <Plus className="h-4 w-4" />
              {withinCooldown ? "Log anyway (needs a reason)" : `Add a glass (${GLASS_ML}ml)`}
            </button>
          </div>

          <p className="mt-2 text-[11px] text-muted-foreground">
            {filled} / {glasses} glasses · completes “Drink Water” at {(goalMl / 1000).toFixed(0)}L
            · ~30 min between glasses.
          </p>
        </div>
      </div>

      {/* Reason prompt for back-to-back logging */}
      <AnimatePresence>
        {askReason && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 overflow-hidden"
          >
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    You logged a glass {remMin}:{String(remSec).padStart(2, "0")} ago.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Add a quick reason for logging again so soon — your coach can see this.
                  </p>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. just finished a workout, hot day…"
                    className="mt-2 min-h-[56px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <div className="mt-2 flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-lg"
                      onClick={() => {
                        setAskReason(false);
                        setReason("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="rounded-lg bg-amber-500 text-white hover:opacity-90"
                      onClick={confirmRapid}
                      disabled={!reason.trim()}
                    >
                      Log glass
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </SectionCard>
  );
}
