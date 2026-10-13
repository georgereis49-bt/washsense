import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const project = "eydrrfuzfcxcqdivvued";
const user = {
  id: "11111111-1111-4111-8111-111111111111",
  aud: "authenticated",
  role: "authenticated",
  email: "conta@example.test",
  app_metadata: { provider: "email" },
  user_metadata: {},
  created_at: "2026-01-01T00:00:00Z",
};
const session = {
  access_token: "mock-header.mock-payload.mock-signature",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: "mock-refresh-token",
  user,
};
const tariff = {
  distributor: "Enel SP",
  agent: "Enel SP",
  group: "B3",
  subgroup: "B3",
  te: 0.3,
  tusd: 0.4,
  base: 0.7,
  start: "2026-01-01",
  flag: { name: "Verde", additional_kwh: 0 },
  source: "ANEEL",
  updatedAt: "2026-10-13T12:00:00Z",
};
async function fixtures(page: Page, theme: string) {
  await page.addInitScript(
    ({ project, session, theme, tariff }) => {
      localStorage.setItem(
        "sb-" + project + "-auth-token",
        JSON.stringify(session),
      );
      localStorage.setItem("washsense-theme", theme);
      localStorage.setItem("washsenseEnergyConfigV2", JSON.stringify(tariff));
    },
    { project, session, theme, tariff },
  );
  await page.route("https://" + project + ".supabase.co/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    if (req.method() !== "GET") {
      await route.fulfill({
        status: 400,
        json: { message: "Somente leitura nesta fixture" },
      });
      return;
    }
    if (url.pathname.includes("/auth/v1/user")) {
      await route.fulfill({ json: user });
      return;
    }
    const table = url.pathname.split("/").pop();
    const payload =
      table === "organization_members"
        ? [
            {
              organization_id: "org-fixture",
              role: "admin",
              organizations: {
                id: "org-fixture",
                name: "Organização fictícia",
              },
            },
          ]
        : table === "subscriptions"
          ? [
              {
                id: "sub-fixture",
                organization_id: "org-fixture",
                plan_id: "plan-fixture",
                status: "active",
                provider: "asaas",
                billing_cycle: "monthly",
                amount: 149,
                next_due_date: "2026-11-12",
              },
            ]
          : table === "plans"
            ? {
                id: "plan-fixture",
                name: "Profissional",
                description: "Plano fictício para revisão visual",
                price_monthly: 149,
                max_units: 2,
                max_machines: 20,
                max_devices: 20,
              }
            : table === "payments"
              ? [
                  {
                    id: "pay-fixture",
                    organization_id: "org-fixture",
                    subscription_id: "sub-fixture",
                    provider: "asaas",
                    provider_payment_id: "synthetic-only",
                    amount: 149,
                    status: "RECEIVED",
                    payment_method: "PIX",
                    due_date: "2026-10-12",
                    paid_at: "2026-10-12T12:00:00Z",
                    created_at: "2026-10-01T12:00:00Z",
                    description: "Assinatura mensal — fixture",
                    receipt_url: null,
                    invoice_url: null,
                  },
                ]
              : [];
    await route.fulfill({ json: payload });
  });
}
const modules = [
  "visao-geral",
  "maquinas",
  "reservatorios",
  "consumo",
  "energia",
  "alertas",
  "financeiro",
  "relatorios",
  "configuracoes",
];
for (const theme of ["light", "dark"])
  for (const device of ["desktop", "mobile"])
    test(`premium screenshots ${theme} ${device}`, async ({ page }) => {
      test.setTimeout(180000);
      await fixtures(page, theme);
      await page.setViewportSize(
        device === "desktop"
          ? { width: 1440, height: 1000 }
          : { width: 390, height: 844 },
      );
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      for (const module of modules) {
        await page.goto("/app.html#/" + module);
        await expect(page.locator(".ws-module:visible")).toBeVisible();
        if (module === "financeiro")
          await expect(page.locator("[data-finance-plan]")).toHaveText(
            "Profissional",
          );
        await page.evaluate(() => document.fonts.ready);
        await page.emulateMedia({ reducedMotion: "reduce" });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          module + " overflow",
        ).toBeTruthy();
        const round = process.env.VISUAL_ROUND || "final";
        await page.screenshot({
          path: `docs/redesign/screenshots/${round}/${module}-${theme}-${device}.png`,
          fullPage: true,
          animations: "disabled",
        });
      }
      await page.goto("/login.html");
      await expect(page.locator("#loginForm")).toBeVisible();
      await page.screenshot({
        path: `docs/redesign/screenshots/${process.env.VISUAL_ROUND || "final"}/login-${theme}-${device}.png`,
        fullPage: true,
        animations: "disabled",
      });
      expect(errors).toEqual([]);
    });
test("premium command navigation, chart focus and machine filtering", async ({
  page,
}) => {
  await page.goto("/app.html#/visao-geral?demo=1");
  await expect(page.locator(".p-dashboard")).toBeVisible();
  await page.locator(".p-chart-targets button").first().focus();
  await expect(page.locator(".p-chart-tooltip")).toContainText("102 L");
  await page.locator(".p-filter").click();
  await expect(page.locator(".p-machine")).toHaveCount(3);
  await page.locator(".p-filter").click();
  await expect(page.locator(".p-machine")).toHaveCount(1);
  await page.keyboard.press("Control+k");
  await expect(
    page.getByRole("dialog", { name: "Buscar módulo" }),
  ).toBeVisible();
  await page.getByRole("textbox", { name: "Nome do módulo" }).fill("relat");
  await page.locator(".ws-command-results button").first().click();
  await expect(page).toHaveURL(/relatorios/);
});
for (const theme of ["light", "dark"])
  test(`premium finance and login contrast ${theme}`, async ({ page }) => {
    test.setTimeout(90000);
    await fixtures(page, theme);
    await page.setViewportSize({ width: 390, height: 844 });
    for (const url of ["/app.html#/financeiro", "/login.html"]) {
      await page.goto(url);
      if (url.includes("financeiro"))
        await expect(page.locator("[data-finance-plan]")).toHaveText(
          "Profissional",
        );
      else await expect(page.locator("#loginForm")).toBeVisible();
      await page.emulateMedia({ reducedMotion: "reduce" });
      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      expect(
        result.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
      ).toEqual([]);
    }
  });
test("report visualization parses Brazilian thousands without changing exports", async ({
  page,
}) => {
  await page.goto("/app.html#/relatorios?demo=1");
  await expect(page.locator("#preview")).toBeVisible();
  const width = await page
    .locator(".bar-row .bar i")
    .first()
    .evaluate((el) => parseFloat((el as HTMLElement).style.width));
  expect(width).toBeGreaterThan(90);
  expect(width).toBeLessThan(93);
});
test("login recovery, theme persistence and password visibility preserve contracts", async ({
  page,
}) => {
  const calls: string[] = [];
  await page.route(
    "https://" + project + ".supabase.co/auth/v1/recover**",
    async (route) => {
      expect(route.request().postDataJSON().email).toBe("pessoa@example.test");
      calls.push("recover");
      await route.fulfill({ json: {} });
    },
  );
  await page.goto("/login.html");
  await page.locator("#email").fill("pessoa@example.test");
  await page.locator("#password").fill("fixture-password");
  await page.locator("#togglePassword").click();
  await expect(page.locator("#password")).toHaveAttribute("type", "text");
  await page.locator("#forgot").click();
  await expect(page.locator("#status")).toContainText(
    "enviaremos as instruções",
  );
  expect(calls).toEqual(["recover"]);
  await page.locator("#loginTheme").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});
for (const width of [768, 1920])
  test(`premium viewport ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/app.html#/visao-geral?demo=1");
    await expect(page.locator(".p-dashboard")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await page.screenshot({
      path: `docs/redesign/screenshots/round2/dashboard-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
  });
test("final alert composition in both themes and responsive layouts", async ({
  page,
}) => {
  test.setTimeout(150000);
  for (const theme of ["light", "dark"])
    for (const device of ["desktop", "mobile"]) {
      await fixtures(page, theme);
      await page.setViewportSize(
        device === "desktop"
          ? { width: 1440, height: 1000 }
          : { width: 390, height: 844 },
      );
      await page.goto("/login.html");
      await page.goto("/app.html#/alertas");
      await expect(page.locator(".ws-module:visible")).toBeVisible();
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy();
      const audit = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      expect(audit.violations.map((v) => v.id)).toEqual([]);
      await page.screenshot({
        path: `docs/redesign/screenshots/round2/alertas-${theme}-${device}.png`,
        fullPage: true,
        animations: "disabled",
      });
    }
});
