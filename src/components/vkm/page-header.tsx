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
        "relative flex flex-col gap-3 pb-3 md:flex-row md:flex-wrap md:items-end md:justify-between md:gap-4 md:pb-6",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3 md:items-start">
        {Icon && (
          <span className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-navy text-primary-foreground shadow-vkm md:h-12 md:w-12">
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
          <h1 className="mt-0.5 text-xl font-semibold leading-tight tracking-tight text-foreground md:mt-1.5 md:text-3xl">
            {title}
          </h1>
          {description && (
            <p className="mt-1 line-clamp-2 max-w-2xl text-[13px] text-muted-foreground md:line-clamp-none md:text-sm">
              {description}
            </p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 self-start md:self-auto">
          {actions}
        </div>
      )}
    </motion.div>
  );
}
