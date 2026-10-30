import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

/**
 * `PAGES=1` (npm run build:pages) emits a static client bundle for GitHub Pages
 * and skips the Vercel server. `PAGES_BASE` is the public path, for example
 * `/cmdesk/` on a project site, or `/` on a user site or custom domain.
 */
function pagesBase(): string | undefined {
  if (process.env.PAGES !== "1") return undefined;
  let base = process.env.PAGES_BASE?.trim() || "/";
  if (!base.startsWith("/")) base = `/${base}`;
  if (!base.endsWith("/")) base = `${base}/`;
  return base;
}

export default defineConfig(({ command, isPreview }) => {
  const base = pagesBase();
  const pages = base !== undefined;
  return {
    base: base ?? "/",
    server: {
      host: "0.0.0.0",
      port: 8080,
      strictPort: true,
    },
    preview: {
      host: "127.0.0.1",
      port: 8081,
      strictPort: true,
    },
    resolve: { tsconfigPaths: true },
    plugins: [
      tailwindcss(),
      tanstackStart(
        pages
          ? {
              spa: {
                enabled: true,
                prerender: { outputPath: "/index", crawlLinks: false },
              },
            }
          : undefined,
      ),
      ...((command === "build" || isPreview) && !pages
        ? [
            nitro({
              preset: "vercel",
            }),
          ]
        : []),
      viteReact(),
    ],
  };
});
