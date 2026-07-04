import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "participant" | "coach" | "mentor" | "super_admin";

type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
};

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  primaryRole: AppRole | null;
  loading: boolean;
  hasRole: (role: AppRole) => boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const ROLE_PRIORITY: AppRole[] = ["super_admin", "mentor", "coach", "participant"];

function pickPrimary(roles: AppRole[]): AppRole | null {
  for (const r of ROLE_PRIORITY) if (roles.includes(r)) return r;
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const loadExtras = useCallback(async (uid: string) => {
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, avatar_url").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
    ]);
    setProfile(p ?? null);
    setRoles(((r ?? []) as { role: AppRole }[]).map((x) => x.role));
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    await loadExtras(user.id);
  }, [user, loadExtras]);

  useEffect(() => {
    let mounted = true;

    const loadIfMounted = async (uid: string) => {
      const [{ data: p }, { data: r }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, avatar_url").eq("id", uid).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", uid),
      ]);
      if (!mounted) return;
      setProfile(p ?? null);
      setRoles(((r ?? []) as { role: AppRole }[]).map((x) => x.role));
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        setTimeout(() => void loadIfMounted(sess.user!.id), 0);
      } else {
        setProfile(null);
        setRoles([]);
      }
      if (event !== "INITIAL_SESSION") setLoading(false);
    });

    // A cold start on a phone routinely fails its FIRST network request (the
    // radio/DNS is still waking up), and the access token has usually lapsed
    // by then (1h JWT) — so a single refresh attempt reads as "logged out"
    // even though a perfectly valid refresh token sits in storage. Retry with
    // backoff, and only give up early when the server DEFINITIVELY rejects
    // the token (invalid/expired), never on a network failure.
    const RETRY_DELAYS = [1000, 3000];
    const refreshWithRetry = async () => {
      for (let i = 0; i <= RETRY_DELAYS.length; i++) {
        try {
          const r = await supabase.auth.refreshSession();
          if (r.data.session) return r.data;
          if (r.error && r.error.name !== "AuthRetryableFetchError") return null; // real rejection
        } catch {
          /* thrown network error → retry */
        }
        if (!mounted) return null;
        if (i < RETRY_DELAYS.length) await new Promise((res) => setTimeout(res, RETRY_DELAYS[i]));
      }
      return null;
    };

    void (async () => {
      let { data } = await supabase.auth.getSession();
      // No live session? The token likely lapsed while the app (esp. an
      // installed PWA) was closed — recover it before concluding logged-out.
      if (!data.session) {
        const recovered = await refreshWithRetry();
        if (recovered) data = recovered;
      }
      if (!mounted) return;
      setSession(data.session ?? null);
      setUser(data.session?.user ?? null);
      if (data.session?.user) await loadIfMounted(data.session.user.id);
      if (mounted) setLoading(false);
    })();

    // Second chance: if boot concluded "logged out" because the network was
    // down/flaky, quietly retry the moment connectivity or focus returns. A
    // successful refresh emits TOKEN_REFRESHED → onAuthStateChange above
    // restores the user and the /auth page bounces them straight back in.
    // With no stored refresh token this fails instantly and silently.
    const lateRecover = () => {
      void supabase.auth.getSession().then(({ data: d }) => {
        if (!d.session) void supabase.auth.refreshSession().catch(() => {});
      });
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") lateRecover();
    };
    window.addEventListener("online", lateRecover);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
      window.removeEventListener("online", lateRecover);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const value: AuthContextValue = {
    user,
    session,
    profile,
    roles,
    primaryRole: pickPrimary(roles),
    loading,
    hasRole: (r) => roles.includes(r),
    refreshProfile,
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
