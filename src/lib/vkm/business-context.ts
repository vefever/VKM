// Turns a participant's real business data (business_brains profile +
// business_snapshots monthly metrics) into a compact, readable context block
// that gets appended to the AI Advisor's system prompt. This is what lets the
// advisor answer with the owner's actual numbers instead of generic advice.
//
// Pure + dependency-free so it can be reused and tested in isolation. Only
// non-empty fields are emitted to keep the token budget tight.

export type BrainRow = Record<string, unknown> | null | undefined;
export type SnapshotRow = Record<string, unknown>;

const txt = (v: unknown): string => {
  if (v == null) return "";
  const s = String(v).trim();
  return s;
};

const inr = (v: unknown): string => {
  const n = Number(v);
  if (v == null || !Number.isFinite(n) || n === 0) return "";
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  if (n >= 1e3) return `₹${Math.round(n).toLocaleString("en-IN")}`;
  return `₹${n}`;
};

// label → raw value; emitted only when non-empty.
function line(label: string, value: string): string | null {
  return value ? `- ${label}: ${value}` : null;
}

/**
 * Build the "BUSINESS CONTEXT" block. Returns "" when there is genuinely
 * nothing to share (so the caller can decide whether to append anything).
 */
export function buildBrainContext(brain: BrainRow, snapshots: SnapshotRow[] = []): string {
  const b = brain ?? {};
  const sections: string[] = [];

  // --- Profile -------------------------------------------------------------
  const profile = [
    line("Business", txt(b.business_name)),
    line("Industry", txt(b.industry)),
    line("Location", txt(b.location)),
    line("Model", txt(b.business_model)),
    line("Legal structure", txt(b.legal_structure)),
    line("Founded", txt(b.founded_year)),
    line("Years running", txt(b.years_running)),
    line("Team size", txt(b.team_size)),
    line("Total customers", txt(b.num_customers)),
    line("Website", txt(b.website)),
    line("Social", txt(b.social_handle)),
  ].filter(Boolean);

  // --- Revenue & sales -----------------------------------------------------
  const money = [
    line("Current MRR", inr(b.current_mrr_inr)),
    line("Target MRR", inr(b.target_mrr_inr)),
    line("Average deal", inr(b.avg_deal_inr)),
    line("Closing rate", txt(b.closing_rate_pct) ? `${txt(b.closing_rate_pct)}%` : ""),
    line("Monthly leads", txt(b.monthly_leads)),
    line("Pricing model", txt(b.pricing_model)),
  ].filter(Boolean);

  // --- Positioning & strategy ---------------------------------------------
  const strategy = [
    line("USP", txt(b.usp)),
    line("Target customer", txt(b.target_customer)),
    line("Top products/services", txt(b.top_products)),
    line("Main competitors", txt(b.main_competitors)),
    line("Lead sources", txt(b.lead_sources)),
    line("Biggest challenges", txt(b.top_challenges)),
    line("Definition of success", txt(b.success_definition)),
  ].filter(Boolean);

  if (profile.length) sections.push(`PROFILE\n${profile.join("\n")}`);
  if (money.length) sections.push(`REVENUE & SALES\n${money.join("\n")}`);
  if (strategy.length) sections.push(`POSITIONING & STRATEGY\n${strategy.join("\n")}`);

  // --- Monthly snapshots (most recent first, capped) -----------------------
  const rows = [...snapshots]
    .filter((s) => txt(s.month))
    .sort((a, b2) => txt(b2.month).localeCompare(txt(a.month)))
    .slice(0, 6);

  if (rows.length) {
    const lines = rows.map((s) => {
      const parts = [
        inr(s.revenue_inr) && `rev ${inr(s.revenue_inr)}`,
        inr(s.mrr_inr) && `MRR ${inr(s.mrr_inr)}`,
        txt(s.leads) && `${txt(s.leads)} leads`,
        txt(s.deals) && `${txt(s.deals)} deals`,
        txt(s.closing_rate_pct) && `${txt(s.closing_rate_pct)}% close`,
        inr(s.pipeline_inr) && `pipeline ${inr(s.pipeline_inr)}`,
        txt(s.nps) && `NPS ${txt(s.nps)}`,
      ].filter(Boolean);
      return `- ${txt(s.month)}: ${parts.join(", ") || "no metrics"}`;
    });
    sections.push(`MONTHLY SNAPSHOTS (most recent first)\n${lines.join("\n")}`);
  }

  if (!sections.length) return "";

  return [
    "=== BUSINESS CONTEXT (the owner's real data — use these actual numbers; never invent or contradict them) ===",
    sections.join("\n\n"),
    "=== END BUSINESS CONTEXT ===",
  ].join("\n\n");
}
