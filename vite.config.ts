import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { cloudflare } from "@cloudflare/vite-plugin";

// Public (anon) Supabase values — safe to ship in the client bundle. Used as a
// fallback so the client works even when the build env has no .env (Cloudflare CI).
const SUPABASE_URL = "https://ehsbzxrekrhmmpvbxlfv.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_IoF8xSRS0zdq9lJhM3evzQ_qvJr9_KH";
const SUPABASE_PROJECT_ID = "ehsbzxrekrhmmpvbxlfv";

export default defineConfig(({ mode }) => {
  // Mirror Vite's import.meta.env injection for VITE_-prefixed vars so the SSR
  // and client builds agree on the same values.
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const envDefine: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    envDefine[`import.meta.env.${key}`] = JSON.stringify(value);
  }

  // Inject Supabase public vars as build-time constants so they're present in the
  // client bundle even when no .env file is available (e.g. Cloudflare CI).
  const supabaseDefine: Record<string, string> = {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(env.VITE_SUPABASE_URL ?? SUPABASE_URL),
    "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
      env.VITE_SUPABASE_PUBLISHABLE_KEY ?? SUPABASE_PUBLISHABLE_KEY,
    ),
    "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(
      env.VITE_SUPABASE_PROJECT_ID ?? SUPABASE_PROJECT_ID,
    ),
  };

  return {
    define: { ...envDefine, ...supabaseDefine },
    // Run Lightning CSS in dev too so the static build's CSS pipeline matches
    // the preview — Vite only runs Lightning CSS at build by default, which can
    // make a build-time transform diverge from what dev showed.
    css: { transformer: "lightningcss" },
    resolve: {
      alias: { "@": `${process.cwd()}/src` },
      // Single copy of React / TanStack Query so hooks and context don't tear.
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        // Pre-bundle the Zoom Meeting SDK so its dynamic import is stable — without
        // this Vite re-optimizes it mid-session and the lazy import 404s with
        // "Failed to fetch dynamically imported module".
        "@zoom/meetingsdk/embedded",
      ],
      ignoreOutdatedRequests: true,
    },
    server: { host: "::", port: 8080 },
    plugins: [
      tailwindcss(),
      tsConfigPaths({ projects: ["./tsconfig.json"] }),
      tanstackStart({
        // Block server-only modules from leaking into the client bundle.
        importProtection: {
          behavior: "error",
          client: { files: ["**/server/**"], specifiers: ["server-only"] },
        },
        // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR
        // error wrapper).
        server: { entry: "server" },
        // SPA mode: prerender a static index.html shell so the app can be hosted as
        // plain static files (e.g. cPanel public_html) — the client router takes over.
        spa: { enabled: true },
      }),
      viteReact(),
      cloudflare({
        viteEnvironment: { name: "ssr" },
      }),
    ],
  };
});
