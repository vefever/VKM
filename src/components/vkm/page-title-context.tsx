import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

// Native "large title collapses into the nav bar" pattern: PageHeader
// registers its title + whether the user has scrolled past it; the mobile
// TopBar crossfades the brand logo into that title. Default is a no-op so
// PageHeader keeps working when rendered outside AppShell.
type PageTitleCtx = {
  title: string | null;
  collapsed: boolean;
  setTitle: (t: string | null) => void;
  setCollapsed: (v: boolean) => void;
};

const Ctx = createContext<PageTitleCtx>({
  title: null,
  collapsed: false,
  setTitle: () => {},
  setCollapsed: () => {},
});

export function PageTitleProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const value = useMemo(() => ({ title, collapsed, setTitle, setCollapsed }), [title, collapsed]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePageTitle() {
  return useContext(Ctx);
}
