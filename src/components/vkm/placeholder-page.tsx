import { type LucideIcon, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export function PlaceholderPage({
  title,
  description,
  icon: Icon = Sparkles,
  eyebrow,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  eyebrow?: string;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-16 text-center">
      <div className="relative">
        <span className="absolute inset-0 -z-10 mx-auto h-24 w-24 rounded-full bg-gradient-gold opacity-30 blur-2xl" />
        <span className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-card shadow-vkm-float">
          <Icon className="h-8 w-8 text-navy" />
        </span>
      </div>
      {eyebrow && (
        <p className="mt-6 text-xs font-medium uppercase tracking-[0.2em] text-gold">{eyebrow}</p>
      )}
      <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        {title}
      </h1>
      <p className="mt-3 max-w-lg text-base text-muted-foreground">
        {description ??
          "This module is being crafted. We're designing it with the same care as the rest of the platform — beautiful, fast, and built for transformation."}
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button asChild variant="outline" size="lg" className="rounded-full">
          <Link to="/">Back to dashboard</Link>
        </Button>
        <span className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-vkm">
          Coming soon
        </span>
      </div>
    </div>
  );
}
