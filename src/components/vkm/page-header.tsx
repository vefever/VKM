import { type LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  icon: Icon,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
      className={cn(
        "relative flex flex-col gap-4 pb-5 md:flex-row md:flex-wrap md:items-end md:justify-between md:gap-4 md:pb-6",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <span className="relative inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-navy text-primary-foreground shadow-vkm">
            <Icon className="h-5 w-5" />
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-white/15"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute -inset-px rounded-2xl opacity-60 blur-md bg-gradient-gold -z-10"
            />
          </span>
        )}
        <div className="min-w-0">
          {eyebrow && (
            <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-gold animate-blink shadow-gold-glow" />
              {eyebrow}
            </p>
          )}
          <h1 className="mt-1.5 text-2xl font-semibold leading-tight tracking-tight text-foreground md:text-3xl">
            {title}
          </h1>
          {description && (
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </motion.div>
  );
}
