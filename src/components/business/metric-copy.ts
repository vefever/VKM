import { type MetricKey } from "@/components/business/business-data";

// Single source of plain-language copy for every metric — used by the entry
// modal (labels, tooltips, example placeholders) and the section cards.
export type MetricCopy = {
  label: string; // short friendly label
  full: string; // entry-form label
  help: string; // plain-language tooltip: what it means + how to find it
  example: string; // realistic example placeholder
};

export const METRIC_COPY: Record<MetricKey, MetricCopy> = {
  revenue_inr: {
    label: "Revenue",
    full: "Revenue this month",
    help: "All the money that came into the business this month — from every customer and sale.",
    example: "18,00,000",
  },
  mrr_inr: {
    label: "MRR",
    full: "Monthly recurring revenue (MRR)",
    help: "The income you can count on every month from repeat or subscription customers.",
    example: "1,50,000",
  },
  leads: {
    label: "Leads",
    full: "New leads",
    help: "New potential customers who showed interest this month (enquiries, sign-ups, walk-ins).",
    example: "40",
  },
  deals: {
    label: "Deals",
    full: "Deals closed",
    help: "How many sales you actually won and got paid for this month.",
    example: "12",
  },
  pipeline_inr: {
    label: "Pipeline",
    full: "Pipeline value",
    help: "The total value of deals you're still working on but haven't closed yet.",
    example: "25,00,000",
  },
  avg_deal_inr: {
    label: "Avg deal",
    full: "Average deal size",
    help: "On average, how much each closed sale is worth (revenue ÷ deals).",
    example: "1,50,000",
  },
  closing_rate_pct: {
    label: "Closing rate",
    full: "Closing rate (%)",
    help: "Out of every 100 leads, how many became paying customers.",
    example: "20",
  },
  followup_pct: {
    label: "Follow-up rate",
    full: "Follow-up rate (%)",
    help: "The share of your leads you followed up with on time.",
    example: "80",
  },
  nps: {
    label: "Customer happiness",
    full: "Customer happiness — NPS (−100 to 100)",
    help: "How likely your customers are to recommend you, turned into one score from −100 to 100.",
    example: "50",
  },
};

export type Signal = "good" | "watch" | "bad";

// A human-readable one-liner for a metric's current value + month-over-month move.
export function readingFor(
  key: MetricKey,
  value: number | null,
  deltaPct: number | null,
  display: string,
): { text: string; signal: Signal } | null {
  if (value == null) return null;
  const move =
    deltaPct == null
      ? ""
      : deltaPct > 0
        ? ` — up ${deltaPct}% from last month`
        : deltaPct < 0
          ? ` — down ${Math.abs(deltaPct)}% from last month`
          : " — about the same as last month";
  const signal: Signal =
    deltaPct == null || deltaPct === 0 ? "watch" : deltaPct > 0 ? "good" : "bad";

  let text: string;
  switch (key) {
    case "closing_rate_pct":
      text =
        value > 0
          ? `You're turning about 1 in ${Math.max(1, Math.round(100 / value))} leads into customers${move}.`
          : `No leads converted yet${move}.`;
      break;
    case "followup_pct":
      text = `You followed up with ${value}% of your leads on time${move}.`;
      break;
    case "nps":
      text = `Customers rate you ${value} out of 100 for happiness${move}.`;
      break;
    case "leads":
      text = `${value} new potential customers this month${move}.`;
      break;
    case "deals":
      text = `${value} sales won this month${move}.`;
      break;
    default:
      text = `${display} this month${move}.`;
  }
  return { text, signal };
}
