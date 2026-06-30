import { motion } from "framer-motion";

export function PercentileBanner({ percentile }: { percentile: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 1 }}
      className="flex items-center justify-between gap-4 rounded-[50px] border border-gold/30 bg-gradient-to-r from-gold/15 to-gold/[0.04] px-6 py-5 sm:px-8"
    >
      <p className="text-sm text-foreground sm:text-base">
        You are doing better than{" "}
        <span className="text-lg font-bold text-[oklch(0.5_0.11_80)] sm:text-xl">
          {percentile}%
        </span>{" "}
        of other members
      </p>

      {/* Decorative crown + orb */}
      <svg aria-hidden viewBox="0 0 80 56" className="h-12 w-16 shrink-0" fill="none">
        <defs>
          <linearGradient id="lb-orb" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="oklch(0.32 0.07 264)" />
            <stop offset="100%" stopColor="oklch(0.24 0.07 265)" />
          </linearGradient>
        </defs>
        <circle cx="40" cy="38" r="14" fill="url(#lb-orb)" opacity="0.9" />
        <circle cx="40" cy="38" r="14" stroke="#C8A84B" strokeOpacity="0.6" />
        <path d="M26 22 L31 30 L40 18 L49 30 L54 22 L51 36 L29 36 Z" fill="#C8A84B" />
        <circle cx="26" cy="20" r="2.2" fill="#C8A84B" />
        <circle cx="54" cy="20" r="2.2" fill="#C8A84B" />
        <circle cx="40" cy="15" r="2.4" fill="#C8A84B" />
      </svg>
    </motion.div>
  );
}
