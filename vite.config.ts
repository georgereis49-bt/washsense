import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const file = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const pages = [
  "index",
  "app",
  "login",
  "dashboard",
  "details",
  "finance",
  "settings",
  "report",
  "pagamento-sucesso",
];
const assets = [
  "styles.css",
  "interactive.js",
  "supabase-config.js",
  "assets/washsense-logo.svg",
  "assets/washsense-logo-white.svg",
];
export default defineConfig({
  publicDir: false,
  plugins: [
    react(),
    {
      name: "washsense-declared-public-assets",
      apply: "build",
      transformIndexHtml: {
        order: "pre",
        handler(html) {
          return html.replace(/<link\b[^>]*>/gi, (tag) =>
            /href=["']styles.css["']/.test(tag)
              ? tag.replace("<link", "<link vite-ignore")
              : tag,
          );
        },
      },
      buildStart() {
        for (const name of assets)
          this.emitFile({
            type: "asset",
            fileName: name,
            source: readFileSync(file(name)),
          });
      },
    },
  ],
  build: {
    rollupOptions: {
      input: Object.fromEntries(
        pages.map((page) => [page, file(page + ".html")]),
      ),
    },
  },
});
