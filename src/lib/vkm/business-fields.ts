// Single source of truth for the business-profile fields that can be
// auto-filled from an uploaded document. The keys match the editable form in
// profile-settings.tsx (BusinessTab) and the columns in business_brains, so the
// extraction server function and the review UI stay in sync.

export type BusinessFieldKey =
  | "business_name"
  | "industry"
  | "location"
  | "website"
  | "legal_structure"
  | "business_model"
  | "founded_year"
  | "years_running"
  | "team_size"
  | "num_customers"
  | "current_mrr_inr"
  | "target_mrr_inr"
  | "avg_deal_inr"
  | "pricing_model"
  | "monthly_leads"
  | "closing_rate_pct"
  | "top_products"
  | "usp"
  | "target_customer"
  | "main_competitors"
  | "lead_sources"
  | "social_handle"
  | "top_challenges"
  | "success_definition";

export type FieldKind = "text" | "long" | "int" | "inr" | "pct";

export type BusinessFieldDef = {
  key: BusinessFieldKey;
  label: string;
  kind: FieldKind;
  hint: string; // guidance the AI uses to find/normalise the value
};

export const BUSINESS_FIELDS: BusinessFieldDef[] = [
  {
    key: "business_name",
    label: "Business name",
    kind: "text",
    hint: "official company/brand name",
  },
  {
    key: "industry",
    label: "Industry",
    kind: "text",
    hint: "sector e.g. SaaS, retail, consulting",
  },
  { key: "location", label: "Location", kind: "text", hint: "city / country of operation" },
  { key: "website", label: "Website", kind: "text", hint: "full URL" },
  {
    key: "legal_structure",
    label: "Legal structure",
    kind: "text",
    hint: "Pvt Ltd / LLP / Sole Proprietor",
  },
  {
    key: "business_model",
    label: "Business model",
    kind: "text",
    hint: "B2B / B2C / D2C / Marketplace",
  },
  { key: "founded_year", label: "Founded year", kind: "int", hint: "4-digit year" },
  { key: "years_running", label: "Years running", kind: "int", hint: "whole number of years" },
  { key: "team_size", label: "Team size", kind: "int", hint: "number of people" },
  { key: "num_customers", label: "Total customers", kind: "int", hint: "current paying customers" },
  {
    key: "current_mrr_inr",
    label: "Current MRR (₹)",
    kind: "inr",
    hint: "monthly recurring revenue in rupees",
  },
  {
    key: "target_mrr_inr",
    label: "Target MRR (₹)",
    kind: "inr",
    hint: "goal monthly recurring revenue in rupees",
  },
  {
    key: "avg_deal_inr",
    label: "Average deal (₹)",
    kind: "inr",
    hint: "typical deal/order value in rupees",
  },
  {
    key: "pricing_model",
    label: "Pricing model",
    kind: "text",
    hint: "One-time / Subscription / Retainer",
  },
  { key: "monthly_leads", label: "Monthly leads", kind: "int", hint: "new leads per month" },
  {
    key: "closing_rate_pct",
    label: "Closing rate (%)",
    kind: "pct",
    hint: "win rate as a percentage 0-100",
  },
  { key: "top_products", label: "Top products / services", kind: "long", hint: "what they sell" },
  {
    key: "usp",
    label: "Unique selling proposition",
    kind: "long",
    hint: "what makes them the obvious choice",
  },
  {
    key: "target_customer",
    label: "Ideal / target customer",
    kind: "long",
    hint: "who they serve best",
  },
  {
    key: "main_competitors",
    label: "Main competitors",
    kind: "long",
    hint: "who they compete against",
  },
  { key: "lead_sources", label: "Lead sources", kind: "long", hint: "where leads come from" },
  { key: "social_handle", label: "Primary social handle", kind: "text", hint: "e.g. @brand" },
  {
    key: "top_challenges",
    label: "Biggest challenges",
    kind: "long",
    hint: "what holds growth back",
  },
  {
    key: "success_definition",
    label: "Definition of success",
    kind: "long",
    hint: "what winning looks like",
  },
];

export const BUSINESS_FIELD_KEYS = BUSINESS_FIELDS.map((f) => f.key);

const FIELD_KIND = Object.fromEntries(BUSINESS_FIELDS.map((f) => [f.key, f.kind])) as Record<
  BusinessFieldKey,
  FieldKind
>;

export type ExtractedBusiness = Partial<Record<BusinessFieldKey, string>>;

/**
 * Convert AI-extracted string values into a business_brains column payload,
 * coercing numeric fields (int/inr/pct) to numbers. Used by the direct-save
 * path on the My Business page. (The profile form has its own coercion.)
 */
export function extractedToColumns(fields: ExtractedBusiness): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  (Object.keys(fields) as BusinessFieldKey[]).forEach((k) => {
    const raw = fields[k];
    if (raw == null || raw === "") return;
    const kind = FIELD_KIND[k];
    if (kind === "int" || kind === "inr" || kind === "pct") {
      const n = Number(String(raw).replace(/[^\d.]/g, ""));
      if (Number.isFinite(n)) out[k] = Math.round(n);
    } else {
      out[k] = String(raw);
    }
  });
  return out;
}
