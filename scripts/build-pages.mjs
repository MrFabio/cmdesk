#!/usr/bin/env node
/**
 * Static build for GitHub Pages.
 *
 * Set PAGES_BASE to the public path (`/repo-name/` or `/`) before running.
 * Writes dist/client, including index.html, 404.html, and .nojekyll.
 *
 * The server prerender and the client bundle hash CSS independently, so the
 * shell can name a stylesheet that was never emitted. After the build, the
 * shell is pointed at the CSS file that actually landed in dist/client.
 */
import { spawn } from "node:child_process";
import { copyFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
process.env.PAGES = "1";
if (!process.env.PAGES_BASE) process.env.PAGES_BASE = "/";

const code = await new Promise((resolve) => {
  const child = spawn("npm", ["run", "build"], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
    shell: true,
  });
  child.on("exit", (status) => resolve(status ?? 1));
});
if (code !== 0) process.exit(code);

const base = normalizeBase(process.env.PAGES_BASE);
const client = join(root, "dist/client");
const indexPath = join(client, "index.html");
if (!existsSync(indexPath)) {
  console.error("GitHub Pages build did not write dist/client/index.html");
  process.exit(1);
}

const cssName = stylesheetOnDisk(client);
let html = readFileSync(indexPath, "latin1");
const cssHref = `${base}assets/${cssName}`;
const rewritten = html.replace(
  /(href=")[^"]*\/assets\/styles-[^"]+\.css(")/g,
  `$1${cssHref}$2`,
);
if (!rewritten.includes(cssHref)) {
  console.error("GitHub Pages shell has no stylesheet link to rewrite");
  process.exit(1);
}
html = rewritten;
html = injectSeo(html, base);

writeFileSync(indexPath, html, "latin1");
copyFileSync(indexPath, join(client, "404.html"));
writeFileSync(join(client, ".nojekyll"), "");

assertHtmlRefs(html, client, base);
assertBundleRefs(client, base);
console.log(`GitHub Pages output: dist/client (base ${base})`);

function normalizeBase(value) {
  let next = String(value ?? "/").trim() || "/";
  if (!next.startsWith("/")) next = `/${next}`;
  if (!next.endsWith("/")) next = `${next}/`;
  return next;
}

function stylesheetOnDisk(clientDir) {
  const names = readdirSync(join(clientDir, "assets")).filter((name) => name.endsWith(".css"));
  if (names.length !== 1) {
    console.error(`Expected one stylesheet in dist/client/assets, found ${names.length}`);
    process.exit(1);
  }
  return names[0];
}

function injectSeo(html, publicBase) {
  const site = JSON.parse(readFileSync(join(root, "src/lib/og/site.json"), "utf8"));
  const title = escapeHtml(site.title);
  const description = escapeHtml(site.description);
  const url = escapeHtml(site.url);
  const tags = [
    `<meta property="og:site_name" content="CMdesk">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:description" content="${description}">`,
    `<meta name="twitter:card" content="summary">`,
    `<meta name="twitter:title" content="${title}">`,
    `<meta name="twitter:description" content="${description}">`,
  ].join("");
  const noscript = `<noscript><h1>CMdesk</h1><p>${description}</p><p><a href="${url}">${url}</a></p></noscript>`;
  let next = html.includes('property="og:title"') ? html : html.replace("</head>", `${tags}</head>`);
  if (!next.includes("<noscript>")) next = next.replace("<body>", `<body>${noscript}`);
  if (!next.includes(site.url)) {
    console.error("Pages HTML is missing the public URL", site.url);
    process.exit(1);
  }
  void publicBase;
  return next;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "\u0026amp;")
    .replaceAll("<", "\u0026lt;")
    .replaceAll(">", "\u0026gt;")
    .replaceAll('"', "\u0026quot;");
}

function assertHtmlRefs(source, clientDir, publicBase) {
  for (const match of source.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const ref = match[1];
    if (/^(https?:)?\/\//.test(ref) || ref.startsWith("data:") || ref.startsWith("mailto:") || ref.startsWith("#")) {
      continue;
    }
    if (!ref.startsWith(publicBase)) {
      console.error("asset URL is outside the Pages base:", ref);
      process.exit(1);
    }
    const rel = ref.slice(publicBase.length).split("?")[0];
    if (!existsSync(join(clientDir, rel))) {
      console.error("missing Pages asset:", ref);
      process.exit(1);
    }
  }
}

function escapeReg(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function assertBundleRefs(clientDir, publicBase) {
  const assetsDir = join(clientDir, "assets");
  const pattern = new RegExp(`${escapeReg(publicBase)}assets/[A-Za-z0-9._-]+`, "g");
  for (const name of readdirSync(assetsDir)) {
    if (!name.endsWith(".js") && !name.endsWith(".css")) continue;
    const text = readFileSync(join(assetsDir, name), "latin1");
    for (const ref of text.match(pattern) ?? []) {
      const rel = ref.slice(publicBase.length).split("?")[0];
      if (!existsSync(join(clientDir, rel))) {
        console.error("bundle references a missing file:", name, ref);
        process.exit(1);
      }
    }
  }
}
