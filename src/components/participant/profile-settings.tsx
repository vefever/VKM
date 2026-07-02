import { useEffect, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  UserRound,
  Briefcase,
  ShieldCheck,
  Loader2,
  Save,
  Phone,
  Mail,
  KeyRound,
  Vibrate,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/vkm/page-header";
import { SectionCard } from "@/components/vkm/section-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { haptic, hapticsEnabled, setHapticsEnabled } from "@/lib/haptics";
import { AvatarUploader } from "@/components/vkm/avatar-uploader";
import { LogoUploader } from "@/components/vkm/logo-uploader";
import { ImportDocumentDialog } from "@/components/business/import-document-dialog";
import type { ExtractedBusiness, BusinessFieldKey } from "@/lib/vkm/business-fields";

type TabId = "personal" | "business" | "account";
const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: "personal", label: "Personal", icon: UserRound },
  { id: "business", label: "Business", icon: Briefcase },
  { id: "account", label: "Account", icon: ShieldCheck },
];

type Personal = { full_name: string; phone: string; avatar_url: string | null };
type Business = {
  business_name: string;
  industry: string;
  location: string;
  website: string;
  legal_structure: string;
  business_model: string;
  founded_year: string;
  years_running: string;
  team_size: string;
  num_customers: string;
  current_mrr_inr: string;
  target_mrr_inr: string;
  avg_deal_inr: string;
  pricing_model: string;
  monthly_leads: string;
  closing_rate_pct: string;
  top_products: string;
  usp: string;
  target_customer: string;
  main_competitors: string;
  lead_sources: string;
  social_handle: string;
  top_challenges: string;
  success_definition: string;
  logo_url: string;
};

const EMPTY_BUSINESS: Business = {
  business_name: "",
  industry: "",
  location: "",
  website: "",
  legal_structure: "",
  business_model: "",
  founded_year: "",
  years_running: "",
  team_size: "",
  num_customers: "",
  current_mrr_inr: "",
  target_mrr_inr: "",
  avg_deal_inr: "",
  pricing_model: "",
  monthly_leads: "",
  closing_rate_pct: "",
  top_products: "",
  usp: "",
  target_customer: "",
  main_competitors: "",
  lead_sources: "",
  social_handle: "",
  top_challenges: "",
  success_definition: "",
  logo_url: "",
};

const num = (s: string) => (s.trim() === "" ? null : Number(s));
const str = (n: number | null | undefined) => (n == null ? "" : String(n));

export function ProfileSettings({
  roleLabel = "Participant",
  showBusinessTab = true,
  roleSubtitle,
}: {
  roleLabel?: string;
  showBusinessTab?: boolean;
  roleSubtitle?: string;
} = {}) {
  const { user } = useAuth();
  const [tab, setTab] = useState<TabId>("personal");
  const [autoImport, setAutoImport] = useState(false);
  const [loading, setLoading] = useState(true);

  // Deep-link from the My Business page: /participant/profile?import=1#business
  // jumps straight to the Business tab and opens the document importer.
  useEffect(() => {
    if (typeof window === "undefined" || !showBusinessTab) return;
    const wantsBusiness = window.location.hash === "#business";
    const wantsImport = new URLSearchParams(window.location.search).get("import") === "1";
    if (wantsBusiness || wantsImport) setTab("business");
    if (wantsImport) setAutoImport(true);
  }, [showBusinessTab]);
  const [personal, setPersonal] = useState<Personal>({
    full_name: "",
    phone: "",
    avatar_url: null,
  });
  const [business, setBusiness] = useState<Business>(EMPTY_BUSINESS);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const [{ data: prof }, { data: brain }] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, phone, avatar_url")
          .eq("id", user.id)
          .maybeSingle(),
        supabase.from("business_brains").select("*").eq("user_id", user.id).maybeSingle(),
      ]);
      if (!active) return;
      if (prof)
        setPersonal({
          full_name: prof.full_name ?? "",
          phone: prof.phone ?? "",
          avatar_url: prof.avatar_url ?? null,
        });
      if (brain)
        setBusiness({
          business_name: brain.business_name ?? "",
          industry: brain.industry ?? "",
          location: brain.location ?? "",
          website: brain.website ?? "",
          legal_structure: brain.legal_structure ?? "",
          business_model: brain.business_model ?? "",
          founded_year: str(brain.founded_year),
          years_running: str(brain.years_running),
          team_size: str(brain.team_size),
          num_customers: str(brain.num_customers),
          current_mrr_inr: str(brain.current_mrr_inr),
          target_mrr_inr: str(brain.target_mrr_inr),
          avg_deal_inr: str(brain.avg_deal_inr),
          pricing_model: brain.pricing_model ?? "",
          monthly_leads: str(brain.monthly_leads),
          closing_rate_pct: str(brain.closing_rate_pct),
          top_products: brain.top_products ?? "",
          usp: brain.usp ?? "",
          target_customer: brain.target_customer ?? "",
          main_competitors: brain.main_competitors ?? "",
          lead_sources: brain.lead_sources ?? "",
          social_handle: brain.social_handle ?? "",
          top_challenges: brain.top_challenges ?? "",
          success_definition: brain.success_definition ?? "",
          logo_url: brain.logo_url ?? "",
        });
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [user]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      <PageHeader
        eyebrow={roleLabel}
        title="Profile & settings"
        description="Manage your photo, personal details, account security, and app preferences."
        icon={UserRound}
      />

      {/* Identity header */}
      <div className="flex flex-col items-center gap-3 rounded-3xl bg-gradient-navy p-6 text-center text-primary-foreground shadow-vkm-float sm:flex-row sm:gap-5 sm:text-left">
        <AvatarUploader
          avatarUrl={personal.avatar_url}
          name={personal.full_name || user?.email || "You"}
          userId={user?.id}
          size="lg"
          onChange={(url) => setPersonal((p) => ({ ...p, avatar_url: url }))}
        />
        <div className="min-w-0">
          <h2 className="truncate text-xl font-semibold">{personal.full_name || "Your name"}</h2>
          <p className="truncate text-sm text-primary-foreground/70">{user?.email}</p>
          <p className="mt-1 text-xs text-primary-foreground/60">
            {roleSubtitle ??
              (business.business_name ? `${business.business_name} · ` : "") + `${roleLabel}`}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div
        className={cn(
          "grid gap-1.5 rounded-2xl border border-border bg-card p-1.5 shadow-vkm",
          showBusinessTab ? "grid-cols-3" : "grid-cols-2",
        )}
      >
        {TABS.filter((t) => showBusinessTab || t.id !== "business").map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-2.5 text-center text-[11px] font-medium transition-all sm:flex-row sm:gap-2 sm:py-2 sm:text-sm",
                active
                  ? "bg-gradient-navy text-primary-foreground shadow-vkm"
                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {t.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading your profile…
        </div>
      ) : tab === "personal" ? (
        <PersonalTab
          personal={personal}
          setPersonal={setPersonal}
          email={user?.email ?? ""}
          userId={user?.id}
        />
      ) : tab === "business" ? (
        <BusinessTab
          business={business}
          setBusiness={setBusiness}
          userId={user?.id}
          autoImport={autoImport}
        />
      ) : (
        <AccountTab email={user?.email ?? ""} />
      )}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
function PersonalTab({
  personal,
  setPersonal,
  email,
  userId,
}: {
  personal: Personal;
  setPersonal: React.Dispatch<React.SetStateAction<Personal>>;
  email: string;
  userId?: string;
}) {
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!userId) return;
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: personal.full_name.trim() || null,
        phone: personal.phone.trim() || null,
      })
      .eq("id", userId);
    setBusy(false);
    if (error) toast.error("Could not save", { description: error.message });
    else toast.success("Personal details saved");
  }

  return (
    <SectionCard title="Personal information" subtitle="How you appear across VKM">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Full name">
          <Input
            value={personal.full_name}
            onChange={(e) => setPersonal((p) => ({ ...p, full_name: e.target.value }))}
            placeholder="Your full name"
            className="h-11 rounded-xl"
          />
        </Field>
        <Field label="Phone" icon={Phone}>
          <Input
            value={personal.phone}
            onChange={(e) => setPersonal((p) => ({ ...p, phone: e.target.value }))}
            placeholder="+91…"
            className="h-11 rounded-xl"
          />
        </Field>
        <Field label="Email" icon={Mail} className="sm:col-span-2">
          <Input value={email} disabled className="h-11 rounded-xl bg-muted/50" />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Email is managed in the Account tab.
          </p>
        </Field>
      </div>
      <SaveBar busy={busy} onSave={save} />
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
function BusinessTab({
  business,
  setBusiness,
  userId,
  autoImport = false,
}: {
  business: Business;
  setBusiness: React.Dispatch<React.SetStateAction<Business>>;
  userId?: string;
  autoImport?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const set = (k: keyof Business, v: string) => setBusiness((b) => ({ ...b, [k]: v }));

  // Open the importer automatically when deep-linked from the My Business page.
  useEffect(() => {
    if (autoImport) setImportOpen(true);
  }, [autoImport]);

  // Merge AI-extracted fields into the live form for review before saving. Every
  // business_brains text column is a string in this form, so the keys map 1:1.
  function applyExtracted(fields: ExtractedBusiness) {
    setBusiness((b) => {
      const next = { ...b };
      (Object.keys(fields) as BusinessFieldKey[]).forEach((k) => {
        const v = fields[k];
        if (v != null && k in next) (next as Record<string, string>)[k] = v;
      });
      return next;
    });
    toast.success("Details filled in — review, then Save changes");
  }

  async function save() {
    if (!userId) return;
    setBusy(true);
    const { error } = await supabase.from("business_brains").upsert(
      {
        user_id: userId,
        business_name: business.business_name.trim() || null,
        industry: business.industry.trim() || null,
        location: business.location.trim() || null,
        website: business.website.trim() || null,
        legal_structure: business.legal_structure.trim() || null,
        business_model: business.business_model.trim() || null,
        founded_year: num(business.founded_year),
        years_running: num(business.years_running),
        team_size: num(business.team_size),
        num_customers: num(business.num_customers),
        current_mrr_inr: num(business.current_mrr_inr),
        target_mrr_inr: num(business.target_mrr_inr),
        avg_deal_inr: num(business.avg_deal_inr),
        pricing_model: business.pricing_model.trim() || null,
        monthly_leads: num(business.monthly_leads),
        closing_rate_pct: num(business.closing_rate_pct),
        top_products: business.top_products.trim() || null,
        usp: business.usp.trim() || null,
        target_customer: business.target_customer.trim() || null,
        main_competitors: business.main_competitors.trim() || null,
        lead_sources: business.lead_sources.trim() || null,
        social_handle: business.social_handle.trim() || null,
        top_challenges: business.top_challenges.trim() || null,
        success_definition: business.success_definition.trim() || null,
        logo_url: business.logo_url.trim() || null,
      },
      { onConflict: "user_id" },
    );
    setBusy(false);
    if (error) toast.error("Could not save", { description: error.message });
    else toast.success("Business profile saved — your AI Advisor uses this");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Auto-fill from a document</p>
            <p className="text-xs text-muted-foreground">
              Upload a business plan or report (PDF) and we'll fill these fields for you to review.
            </p>
          </div>
        </div>
        <Button
          type="button"
          onClick={() => setImportOpen(true)}
          className="shrink-0 rounded-xl bg-gradient-navy shadow-vkm"
        >
          <Sparkles className="h-4 w-4" /> Upload PDF
        </Button>
      </div>

      <ImportDocumentDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onApply={applyExtracted}
      />

      <SectionCard title="Business profile" subtitle="Powers your AI Advisor & coach insights">
        <div className="mb-5 flex items-center gap-4">
          <LogoUploader
            logoUrl={business.logo_url || null}
            businessName={business.business_name}
            userId={userId}
            size="lg"
            onChange={(url) => set("logo_url", url)}
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Business logo</p>
            <p className="text-xs text-muted-foreground">
              Shown across your business profile & My Business page. Square PNG works best.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Business name">
            <Input
              value={business.business_name}
              onChange={(e) => set("business_name", e.target.value)}
              className="h-11 rounded-xl"
            />
          </Field>
          <Field label="Industry">
            <Input
              value={business.industry}
              onChange={(e) => set("industry", e.target.value)}
              className="h-11 rounded-xl"
            />
          </Field>
          <Field label="Location">
            <Input
              value={business.location}
              onChange={(e) => set("location", e.target.value)}
              className="h-11 rounded-xl"
            />
          </Field>
          <Field label="Years running">
            <Input
              type="number"
              inputMode="numeric"
              value={business.years_running}
              onChange={(e) => set("years_running", e.target.value)}
              className="h-11 rounded-xl"
            />
          </Field>
          <Field label="Team size">
            <Input
              type="number"
              inputMode="numeric"
              value={business.team_size}
              onChange={(e) => set("team_size", e.target.value)}
              className="h-11 rounded-xl"
            />
          </Field>
          <Field label="Website">
            <Input
              type="url"
              inputMode="url"
              value={business.website}
              onChange={(e) => set("website", e.target.value)}
              placeholder="https://…"
              className="h-11 rounded-xl"
            />
          </Field>
          <Field label="Founded year">
            <Input
              type="number"
              inputMode="numeric"
              value={business.founded_year}
              onChange={(e) => set("founded_year", e.target.value)}
              placeholder="2021"
              className="h-11 rounded-xl"
            />
          </Field>
          <Field label="Legal structure">
            <Input
              value={business.legal_structure}
              onChange={(e) => set("legal_structure", e.target.value)}
              placeholder="Pvt Ltd / LLP / Sole Proprietor"
              className="h-11 rounded-xl"
            />
          </Field>
          <Field label="Business model">
            <Input
              value={business.business_model}
              onChange={(e) => set("business_model", e.target.value)}
              placeholder="B2B / B2C / D2C / Marketplace"
              className="h-11 rounded-xl"
            />
          </Field>
          <Field label="Total customers">
            <Input
              type="number"
              inputMode="numeric"
              value={business.num_customers}
              onChange={(e) => set("num_customers", e.target.value)}
              className="h-11 rounded-xl"
            />
          </Field>
          <Field label="Monthly leads">
            <Input
              type="number"
              inputMode="numeric"
              value={business.monthly_leads}
              onChange={(e) => set("monthly_leads", e.target.value)}
              className="h-11 rounded-xl"
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Positioning" subtitle="Who you serve and why they choose you">
        <div className="space-y-4">
          <Field label="Unique selling proposition (USP)">
            <TextArea
              value={business.usp}
              onChange={(v) => set("usp", v)}
              placeholder="What makes you the obvious choice…"
            />
          </Field>
          <Field label="Ideal / target customer">
            <TextArea
              value={business.target_customer}
              onChange={(v) => set("target_customer", v)}
              placeholder="Who you serve best — industry, size, role…"
            />
          </Field>
          <Field label="Main competitors">
            <TextArea
              value={business.main_competitors}
              onChange={(v) => set("main_competitors", v)}
              placeholder="Who you're up against…"
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Pricing model">
              <Input
                value={business.pricing_model}
                onChange={(e) => set("pricing_model", e.target.value)}
                placeholder="One-time / Subscription / Retainer"
                className="h-11 rounded-xl"
              />
            </Field>
            <Field label="Primary social handle">
              <Input
                value={business.social_handle}
                onChange={(e) => set("social_handle", e.target.value)}
                placeholder="@yourbusiness"
                className="h-11 rounded-xl"
              />
            </Field>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Revenue & sales" subtitle="All amounts in ₹">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Current MRR (₹)">
            <Input
              type="number"
              inputMode="numeric"
              value={business.current_mrr_inr}
              onChange={(e) => set("current_mrr_inr", e.target.value)}
              className="h-11 rounded-xl"
            />
          </Field>
          <Field label="Target MRR (₹)">
            <Input
              type="number"
              inputMode="numeric"
              value={business.target_mrr_inr}
              onChange={(e) => set("target_mrr_inr", e.target.value)}
              className="h-11 rounded-xl"
            />
          </Field>
          <Field label="Average deal (₹)">
            <Input
              type="number"
              inputMode="numeric"
              value={business.avg_deal_inr}
              onChange={(e) => set("avg_deal_inr", e.target.value)}
              className="h-11 rounded-xl"
            />
          </Field>
          <Field label="Closing rate (%)">
            <Input
              type="number"
              inputMode="numeric"
              value={business.closing_rate_pct}
              onChange={(e) => set("closing_rate_pct", e.target.value)}
              className="h-11 rounded-xl"
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Strategy" subtitle="Context for tailored advice">
        <div className="space-y-4">
          <Field label="Top products / services">
            <TextArea
              value={business.top_products}
              onChange={(v) => set("top_products", v)}
              placeholder="What you sell…"
            />
          </Field>
          <Field label="Lead sources">
            <TextArea
              value={business.lead_sources}
              onChange={(v) => set("lead_sources", v)}
              placeholder="Where leads come from…"
            />
          </Field>
          <Field label="Biggest challenges">
            <TextArea
              value={business.top_challenges}
              onChange={(v) => set("top_challenges", v)}
              placeholder="What's holding growth back…"
            />
          </Field>
          <Field label="Success in 4 months">
            <TextArea
              value={business.success_definition}
              onChange={(v) => set("success_definition", v)}
              placeholder="What winning looks like…"
            />
          </Field>
        </div>
        <SaveBar busy={busy} onSave={save} />
      </SectionCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
function AccountTab({ email }: { email: string }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [haptics, setHaptics] = useState(true);
  useEffect(() => setHaptics(hapticsEnabled()), []);

  async function changePassword() {
    if (pw.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (pw !== pw2) {
      toast.error("Passwords don’t match.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) toast.error("Could not update password", { description: error.message });
    else {
      toast.success("Password updated");
      setPw("");
      setPw2("");
    }
  }

  return (
    <div className="space-y-4">
      <SectionCard title="Account" subtitle="Your sign-in details">
        <Field label="Email" icon={Mail}>
          <Input value={email} disabled className="h-11 rounded-xl bg-muted/50" />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Contact your mentor to change the email on your account.
          </p>
        </Field>
      </SectionCard>

      <SectionCard title="Change password" subtitle="Use 8+ characters">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="New password" icon={KeyRound}>
            <Input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="••••••••"
              className="h-11 rounded-xl"
            />
          </Field>
          <Field label="Confirm password" icon={KeyRound}>
            <Input
              type="password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              placeholder="••••••••"
              className="h-11 rounded-xl"
            />
          </Field>
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            onClick={changePassword}
            disabled={busy}
            className="rounded-xl bg-gradient-navy shadow-vkm"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            Update password
          </Button>
        </div>
      </SectionCard>

      <SectionCard title="Preferences" subtitle="App behaviour on this device">
        <label className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-2.5">
            <Vibrate className="h-4 w-4 text-muted-foreground" />
            <span>
              <span className="block text-sm font-medium text-foreground">Haptic feedback</span>
              <span className="block text-xs text-muted-foreground">
                Subtle vibrations on taps & wins (where supported)
              </span>
            </span>
          </span>
          <Switch
            checked={haptics}
            onCheckedChange={(v) => {
              setHaptics(v);
              setHapticsEnabled(v);
              if (v) haptic("success");
            }}
          />
        </label>
      </SectionCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
function Field({
  label,
  icon: Icon,
  className,
  children,
}: {
  label: string;
  icon?: LucideIcon;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" />} {label}
      </label>
      {children}
    </div>
  );
}

function TextArea({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="min-h-[72px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    />
  );
}

function SaveBar({ busy, onSave }: { busy: boolean; onSave: () => void }) {
  return (
    <div className="mt-5 flex justify-end border-t border-border pt-4">
      <Button onClick={onSave} disabled={busy} className="rounded-xl bg-gradient-navy shadow-vkm">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Save changes
      </Button>
    </div>
  );
}
