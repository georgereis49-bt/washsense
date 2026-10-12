import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Build all HTML pages used by the existing multipage WashSense frontend.
// Keep React support for the separately versioned React entry point.
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, "index.html"),
        login: resolve(import.meta.dirname, "login.html"),
        dashboard: resolve(import.meta.dirname, "dashboard.html"),
        details: resolve(import.meta.dirname, "details.html"),
        finance: resolve(import.meta.dirname, "finance.html"),
        settings: resolve(import.meta.dirname, "settings.html"),
        report: resolve(import.meta.dirname, "report.html"),
      },
    },
  },
});
