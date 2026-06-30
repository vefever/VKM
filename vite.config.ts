import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

export default defineConfig(({ mode }) => {
  // Mirror Vite's import.meta.env injection for VITE_-prefixed vars so the SSR
  // and client builds agree on the same values.
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const envDefine: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    envDefine[`import.meta.env.${key}`] = JSON.stringify(value);
  }

  return {
    define: envDefine,
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
        // error wrapper). nitro/vite builds from this.
        server: { entry: "server" },
        // SPA mode: prerender a static index.html shell so the app can be hosted as
        // plain static files (e.g. cPanel public_html) — the client router takes over.
        spa: { enabled: true },
      }),
      // Static Node preset; the prerendered client + index.html land in
      // .output/public, which is what you upload to cPanel's public_html.
      nitro({ preset: "node-server" }),
      viteReact(),
    ],
  };
});
