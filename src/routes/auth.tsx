import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Eye, EyeOff, Loader2, KeyRound, Mail } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { invokeMessaging, otpLoginEnabled, signupsEnabled } from "@/components/admin/messaging-data";
import { useAuth } from "@/hooks/use-auth";
import { VKMLogo } from "@/components/vkm/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AuroraBackground } from "@/components/vkm/aurora-bg";
import { ShimmerButton } from "@/components/vkm/shimmer-button";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in · VK Mentorship" },
      { name: "description", content: "Sign in to your VK Mentorship account." },
    ],
  }),
  component: AuthPage,
});

export function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  // Whether the admin has opened public sign-ups (controls the Create-account
  // tab). Pre-auth public RPC; defaults closed until it resolves.
  const [signupsOpen, setSignupsOpen] = useState(false);
  useEffect(() => {
    let alive = true;
    signupsEnabled()
      .then((on) => alive && setSignupsOpen(on))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const brandPanelRef = useRef<HTMLDivElement>(null);

  const handlePanelMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = brandPanelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    el.style.setProperty("--mouse-x", `${x}%`);
    el.style.setProperty("--mouse-y", `${y}%`);
  };

  const handlePanelMouseLeave = () => {
    const el = brandPanelRef.current;
    if (el) {
      el.style.setProperty("--mouse-x", "50%");
      el.style.setProperty("--mouse-y", "50%");
    }
  };

  useEffect(() => {
    if (!loading && user) navigate({ to: "/app" });
  }, [user, loading, navigate]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <AuroraBackground variant="warm" />

      <div className="mx-auto grid min-h-screen max-w-6xl items-stretch gap-0 px-6 py-8 lg:grid-cols-2">
        {/* Brand panel */}
        <motion.aside
          ref={brandPanelRef}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
          onMouseMove={handlePanelMouseMove}
          onMouseLeave={handlePanelMouseLeave}
          className="group relative hidden flex-col justify-between overflow-hidden rounded-3xl bg-gradient-navy p-10 text-primary-foreground shadow-vkm-float lg:flex"
          style={{ "--mouse-x": "50%", "--mouse-y": "50%" } as React.CSSProperties}
        >
          {/* Cursor-following spotlight for premium interactive feel */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
            style={{
              background: `radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(255, 215, 140, 0.35), rgba(255,255,255,0.15) 25%, transparent 55%)`,
            }}
          />

          {/* decorative aurora inside brand panel */}
          <span
            aria-hidden
            className="pointer-events-none absolute -top-16 -right-16 h-72 w-72 rounded-full bg-gradient-gold opacity-30 blur-3xl animate-aurora"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-0 left-0 h-64 w-64 rounded-full bg-white/10 blur-3xl animate-aurora [animation-delay:-6s]"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-grid opacity-[0.06]"
          />

          <div className="relative">
            <VKMLogo inverted />
          </div>
          <div className="relative space-y-6">
            <p className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-primary-foreground/70">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-gold animate-blink" />
              Operating System for Transformation
            </p>
            <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              Welcome to the <span className="text-gradient-gold">VKM</span> community.
            </h2>
            <p className="max-w-md text-primary-foreground/80">
              Premium coaching, AI-powered business intelligence, and a recognition system designed
              to compound your wins — every single week.
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              {["Cohort 17", "AI Co-pilot", "Live Sprints", "Wealth Stack"].map((tag, i) => (
                <motion.span
                  key={tag}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + i * 0.08 }}
                  className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-medium text-primary-foreground/80 backdrop-blur"
                >
                  {tag}
                </motion.span>
              ))}
            </div>
          </div>
          <div className="relative flex gap-2 text-xs text-primary-foreground/60">
            <span>© {new Date().getFullYear()} VK Mentorship</span>
            <span>·</span>
            <Link to="/" className="hover:text-primary-foreground">
              Back home
            </Link>
          </div>
        </motion.aside>

        {/* Form panel */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex flex-col justify-center px-2 py-8 pb-12 lg:py-10 lg:px-12"
        >
          {/* Mobile modern header */}
          <div className="lg:hidden mb-8 text-center">
            <div className="mb-4 flex justify-center">
              <VKMLogo />
            </div>
            <p className="text-sm text-muted-foreground tracking-[0.5px]">
              The operating system for transformation
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="mx-auto w-full max-w-md">
              {signupsOpen ? (
                <Tabs defaultValue="signin">
                  <TabsList className="grid w-full grid-cols-2 rounded-full mb-1">
                    <TabsTrigger value="signin" className="rounded-full">
                      Sign in
                    </TabsTrigger>
                    <TabsTrigger value="signup" className="rounded-full">
                      Create account
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="signin" className="mt-5">
                    <SignInForm />
                  </TabsContent>
                  <TabsContent value="signup" className="mt-5">
                    <SignUpForm />
                  </TabsContent>
                </Tabs>
              ) : (
                <>
                  <div className="mb-6 text-center lg:text-left">
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                      Sign in
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Welcome back — enter your details to continue.
                    </p>
                  </div>
                  <SignInForm />
                </>
              )}
            </div>
          )}

          {/* Subtle modern app footer on mobile */}
          <div className="lg:hidden mt-8 text-center text-[10px] text-muted-foreground/60 tracking-wider">
            Premium • Secure • Built for ambitious founders
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function SignInForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [otpAvailable, setOtpAvailable] = useState(false);
  const [otpMode, setOtpMode] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);

  // Is email-OTP login switched on by the admin? (Pre-auth public RPC.)
  useEffect(() => {
    let alive = true;
    otpLoginEnabled()
      .then((on) => alive && setOtpAvailable(on))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (forgotMode) return <ForgotPassword initialEmail={email} onBack={() => setForgotMode(false)} />;
  if (otpMode) return <OtpSignIn initialEmail={email} onBack={() => setOtpMode(false)} />;

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        setBusy(false);
        if (error) return toast.error(error.message);
        toast.success("Welcome back");
        navigate({ to: "/app" });
      }}
      className="space-y-4"
    >
      <div className="space-y-1.5">
        <Label htmlFor="signin-email">Email</Label>
        <Input
          id="signin-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy}
          className="rounded-xl h-11 bg-card"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="signin-password">Password</Label>
        <div className="relative">
          <Input
            id="signin-password"
            type={show ? "text" : "password"}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
            className="rounded-xl h-11 bg-card pr-10"
          />
          <button
            type="button"
            onClick={() => setShow(!show)}
            aria-label={show ? "Hide password" : "Show password"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <div className="-mt-1 flex justify-end">
        <button
          type="button"
          onClick={() => setForgotMode(true)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Forgot password?
        </button>
      </div>
      <ShimmerButton type="submit" disabled={busy} className="w-full">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <span>Sign in</span>}
      </ShimmerButton>

      {otpAvailable && (
        <button
          type="button"
          onClick={() => setOtpMode(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary/60"
        >
          <KeyRound className="h-4 w-4" /> Sign in with an email code
        </button>
      )}
    </form>
  );
}

// Supabase `generateLink` email_otp is 6 digits (the emailed code) — keep the UI in sync.
const EMAIL_OTP_LENGTH = 6;

// Passwordless sign-in: request a one-time code (emailed via the admin-configured
// provider), then verify it with Supabase to create the session.
function OtpSignIn({ initialEmail, onBack }: { initialEmail: string; onBack: () => void }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    try {
      await invokeMessaging("request_otp", { email: email.trim() });
      toast.success("Code sent", { description: `Check ${email} for your login code.` });
      setStage("code");
    } catch (err) {
      toast.error("Couldn't send code", { description: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (code.trim().length !== EMAIL_OTP_LENGTH) {
      toast.error(`Enter the full ${EMAIL_OTP_LENGTH}-digit code`);
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email",
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back");
    navigate({ to: "/app" });
  }

  return (
    <form onSubmit={stage === "email" ? requestCode : verify} className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Mail className="h-4 w-4 text-gold" /> Email code sign-in
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="otp-email">Email</Label>
        <Input
          id="otp-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy || stage === "code"}
          className="h-11 rounded-xl bg-card"
        />
      </div>

      {stage === "code" && (
        <div className="space-y-1.5">
          <Label htmlFor="otp-code">{EMAIL_OTP_LENGTH}-digit code</Label>
          <Input
            id="otp-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, EMAIL_OTP_LENGTH))}
            maxLength={EMAIL_OTP_LENGTH}
            placeholder={"•".repeat(EMAIL_OTP_LENGTH)}
            disabled={busy}
            className="h-11 rounded-xl bg-card text-center text-lg tracking-[0.5em]"
          />
        </div>
      )}

      <ShimmerButton type="submit" disabled={busy} className="w-full">
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <span>{stage === "email" ? "Send code" : "Verify & sign in"}</span>
        )}
      </ShimmerButton>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <button type="button" onClick={onBack} className="hover:text-foreground">
          ← Back to password
        </button>
        {stage === "code" && (
          <button type="button" onClick={() => setStage("email")} className="hover:text-foreground">
            Use a different email
          </button>
        )}
      </div>
    </form>
  );
}

// Forgot-password: email a one-time code, verify it (which signs the user in),
// then set a brand-new password. Reuses the same OTP mechanism as code sign-in.
function ForgotPassword({ initialEmail, onBack }: { initialEmail: string; onBack: () => void }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [stage, setStage] = useState<"email" | "reset">("email");
  const [busy, setBusy] = useState(false);

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    try {
      // Invite-only: this returns sent:false for a non-member, so we tell them
      // plainly instead of showing an OTP screen for a code that never went out.
      const res = await invokeMessaging("request_password_reset", { email: email.trim() });
      if (res?.sent) {
        toast.success("Reset code sent", { description: `Check ${email} for your 6-digit code.` });
        setStage("reset");
      } else {
        toast.error("No account found", {
          description: "This email isn't registered. VK Mentorship is invite-only — please use your invitation to join.",
        });
      }
    } catch (err) {
      toast.error("Couldn't send the code", { description: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function reset(e: React.FormEvent) {
    e.preventDefault();
    if (code.trim().length !== EMAIL_OTP_LENGTH)
      return toast.error(`Enter the full ${EMAIL_OTP_LENGTH}-digit code`);
    if (pw.length < 8) return toast.error("Password must be at least 8 characters");
    if (pw !== pw2) return toast.error("Passwords don't match");
    setBusy(true);
    try {
      // Verify the code → this creates a session for the account…
      const { error: vErr } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: "email",
      });
      if (vErr) throw new Error("That code is wrong or expired. Request a new one.");
      // …then set the new password on the now-authenticated user.
      const { error: uErr } = await supabase.auth.updateUser({ password: pw });
      if (uErr) throw uErr;
      toast.success("Password reset", { description: "You're signed in with your new password." });
      navigate({ to: "/app" });
    } catch (err) {
      toast.error("Couldn't reset your password", { description: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={stage === "email" ? requestCode : reset} className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <KeyRound className="h-4 w-4 text-gold" /> Reset your password
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="fp-email">Email</Label>
        <Input
          id="fp-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy || stage === "reset"}
          className="h-11 rounded-xl bg-card"
        />
      </div>

      {stage === "reset" && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="fp-code">{EMAIL_OTP_LENGTH}-digit code</Label>
            <Input
              id="fp-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, EMAIL_OTP_LENGTH))}
              maxLength={EMAIL_OTP_LENGTH}
              placeholder={"•".repeat(EMAIL_OTP_LENGTH)}
              disabled={busy}
              className="h-11 rounded-xl bg-card text-center text-lg tracking-[0.5em]"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fp-pw">New password</Label>
            <div className="relative">
              <Input
                id="fp-pw"
                type={show ? "text" : "password"}
                minLength={8}
                required
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                disabled={busy}
                className="h-11 rounded-xl bg-card pr-10"
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                aria-label={show ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fp-pw2">Confirm new password</Label>
            <Input
              id="fp-pw2"
              type={show ? "text" : "password"}
              required
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              disabled={busy}
              className="h-11 rounded-xl bg-card"
            />
          </div>
        </>
      )}

      <ShimmerButton type="submit" disabled={busy} className="w-full">
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <span>{stage === "email" ? "Send reset code" : "Reset password"}</span>
        )}
      </ShimmerButton>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <button type="button" onClick={onBack} className="hover:text-foreground">
          ← Back to sign in
        </button>
        {stage === "reset" && (
          <button type="button" onClick={() => setStage("email")} className="hover:text-foreground">
            Use a different email
          </button>
        )}
      </div>
    </form>
  );
}

function SignUpForm() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setBusy(true);
    try {
      // Create the account through the gated edge function (checks the admin
      // "public sign-ups" flag server-side). GoTrue's own signup is disabled,
      // so this is the only path — a stranger can't self-provision when the
      // admin has sign-ups closed.
      await invokeMessaging("public_signup", { email, password, full_name: name });
      // Then sign in with the password they just chose.
      const { error: siErr } = await supabase.auth.signInWithPassword({ email, password });
      if (siErr) throw siErr;
      toast.success("Account created — welcome to VKM");
      navigate({ to: "/app" });
    } catch (err) {
      toast.error((err as Error).message || "Could not create your account");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="signup-name">Full name</Label>
        <Input
          id="signup-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={busy}
          className="rounded-xl h-11 bg-card"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="signup-email">Email</Label>
        <Input
          id="signup-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy}
          className="rounded-xl h-11 bg-card"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="signup-password">Password</Label>
        <div className="relative">
          <Input
            id="signup-password"
            type={show ? "text" : "password"}
            minLength={8}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
            className="rounded-xl h-11 bg-card pr-10"
          />
          <button
            type="button"
            onClick={() => setShow(!show)}
            aria-label={show ? "Hide password" : "Show password"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="signup-confirm">Confirm password</Label>
        <Input
          id="signup-confirm"
          type={show ? "text" : "password"}
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={busy}
          className="rounded-xl h-11 bg-card"
        />
      </div>
      <ShimmerButton type="submit" disabled={busy} className="w-full">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <span>Create account</span>}
      </ShimmerButton>

      <p className="text-center text-xs text-muted-foreground">
        By continuing you agree to the VKM Code of Conduct. The first account becomes Super Admin
        automatically.
      </p>
    </form>
  );
}
