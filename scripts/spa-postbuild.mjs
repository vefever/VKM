// SPA post-build — produce a self-consistent static index.html for cPanel/Apache.
//
// TanStack's SPA prerender emits `_shell.html`, but the Nitro build RE-HASHES
// the public assets, so the shell's references (in <script>/<link> tags AND in
// the inline router manifest: preloads:[…], src:"…") point at filenames that
// don't exist in this folder → 404 → Apache returns index.html → "module script
// has MIME text/html" → dead app. We remap every stale `/assets/<name>-<hash>`
// to the real file that exists here (matched by name prefix), as a global string
// replace so the inline manifest is fixed too.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function fixDir(dir) {
  const shellPath = `${dir}/_shell.html`;
  const assetsDir = `${dir}/assets`;
  if (!existsSync(shellPath) || !existsSync(assetsDir)) return null;

  let html = readFileSync(shellPath, "utf8");
  const present = new Set(readdirSync(assetsDir));

  const referenced = new Set(
    [...html.matchAll(/\/assets\/([\w.-]+\.(?:js|css))/g)].map((m) => m[1]),
  );

  let remapped = 0;
  let unresolved = 0;
  for (const name of referenced) {
    if (present.has(name)) continue; // already correct
    const m = name.match(/^(.+)-[A-Za-z0-9_-]+\.(js|css)$/); // strip the trailing -<hash>.<ext>
    if (!m) continue;
    const [, prefix, ext] = m;
    const re = new RegExp(`^${escapeRe(prefix)}-[A-Za-z0-9_-]+\\.${ext}$`);
    const real = [...present].find((f) => re.test(f));
    if (real) {
      html = html.split(name).join(real); // global replace (tags + inline manifest)
      remapped++;
    } else {
      unresolved++;
    }
  }

  writeFileSync(`${dir}/index.html`, html);
  return { dir, remapped, unresolved };
}

let done = 0;
for (const dir of [".output/public", "dist/client"]) {
  const r = fixDir(dir);
  if (r) {
    done++;
    console.log(
      `SPA: ${r.dir}/index.html — remapped ${r.remapped} stale ref(s)` +
        (r.unresolved ? `, ${r.unresolved} UNRESOLVED` : ""),
    );
  }
}
if (!done) console.warn("SPA post-build: no _shell.html found — is SPA mode enabled?");
