import { test as base, expect } from "@playwright/test";
// No production traffic. Per-test synthetic routes are installed later and take precedence.
export const test = base.extend<{ safeNetwork: void }>({
  safeNetwork: [
    async ({ page }, use) => {
      await page.route("**/*", (route) => {
        const url = new URL(route.request().url());
        return ["127.0.0.1", "localhost"].includes(url.hostname)
          ? route.continue()
          : route.abort("blockedbyclient");
      });
      await use();
    },
    { auto: true },
  ],
});
export { expect };
