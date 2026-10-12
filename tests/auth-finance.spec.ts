import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const project = "eydrrfuzfcxcqdivvued";
const user = {
  id: "11111111-1111-4111-8111-111111111111",
  aud: "authenticated",
  role: "authenticated",
  email: "operador@example.test",
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
test("authenticated finance preserves organization-scoped reads and method dialog without payments", async ({
  page,
}) => {
  const errors: string[] = [],
    queries: string[] = [],
    writes: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(
    ({ project, session }) =>
      localStorage.setItem(
        "sb-" + project + "-auth-token",
        JSON.stringify(session),
      ),
    { project, session },
  );
  await page.route("https://" + project + ".supabase.co/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    if (req.method() !== "GET") {
      writes.push(req.method() + " " + url.pathname);
      await route.fulfill({
        status: 400,
        json: { message: "Mutations forbidden in UI tests" },
      });
      return;
    }
    if (url.pathname.includes("/auth/v1/user")) {
      await route.fulfill({ json: user });
      return;
    }
    const table = url.pathname.split("/").pop();
    queries.push(url.pathname + url.search);
    const payload =
      table === "organization_members"
        ? [
            {
              organization_id: "org-fixture",
              role: "owner",
              organizations: {
                id: "org-fixture",
                name: "Organização de teste",
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
                billing_cycle: "monthly",
                amount: 149,
                next_due_date: "2026-11-12",
              },
            ]
          : table === "plans"
            ? {
                id: "plan-fixture",
                name: "Plano de teste",
                description: "Fixture para regressão",
                price_monthly: 149,
                max_units: 2,
                max_machines: 10,
                max_devices: 10,
              }
            : [];
    await route.fulfill({ json: payload });
  });
  await page.goto("/app.html#/financeiro");
  await expect(page.locator(".ws-module:visible")).toBeVisible();
  await expect(page.locator(".ws-module:visible .plan-title h2")).toContainText(
    "Plano de teste",
  );
  await expect(page.locator(".ws-module:visible #paymentRows")).toContainText(
    /Nenhum|Não há|nenhum/,
  );
  await page.locator(".ws-module:visible #changeMethod").click();
  await expect(page.locator(".ws-module:visible #billingModal")).toHaveClass(
    /open/,
  );
  await expect(page.locator(".ws-module:visible #modalBody")).toContainText(
    /PIX|Pix/,
  );
  await expect(page.locator(".ws-module:visible #modalBody")).toContainText(
    /Boleto|boleto/,
  );
  await expect(page.locator(".ws-module:visible #modalBody")).toContainText(
    /Cartão|cartão/,
  );
  await page.keyboard.press("Escape");
  await expect(
    page.locator(".ws-module:visible #billingModal"),
  ).not.toHaveClass(/open/);
  expect(
    queries.some(
      (q) =>
        q.includes("subscriptions") &&
        q.includes("organization_id=eq.org-fixture"),
    ),
  ).toBeTruthy();
  expect(
    queries.some(
      (q) =>
        q.includes("payments") && q.includes("organization_id=eq.org-fixture"),
    ),
  ).toBeTruthy();
  await page.emulateMedia({ reducedMotion: "reduce" });
  const audit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    audit.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);
});
test("login submits to Supabase and opens the SPA with the established session", async ({
  page,
}) => {
  await page.route(
    "https://" + project + ".supabase.co/auth/v1/**",
    async (route) => {
      if (route.request().url().includes("/token")) {
        expect(route.request().postDataJSON()).toMatchObject({
          email: "operador@example.test",
          password: "fixture-password",
        });
        await route.fulfill({ json: session });
      } else await route.fulfill({ json: user });
    },
  );
  await page.goto("/login.html");
  await page.locator("#email").fill("operador@example.test");
  await page.locator("#password").fill("fixture-password");
  await page.locator("#loginButton").click();
  await expect(page).toHaveURL(/app.html#\/visao-geral/);
  await expect(
    page.getByRole("heading", { name: "Visão geral da operação" }),
  ).toBeVisible();
  await expect(page.locator(".ws-user")).toContainText("operador@example.test");
});
test("dashboard accessibility audit", async ({ page }) => {
  await page.goto("/app.html#/visao-geral?demo=1");
  await expect(
    page.getByRole("heading", { name: "Visão geral da operação" }),
  ).toBeVisible();
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
});
for (const theme of ["light", "dark"])
  test(`module accessibility and mobile overflow (${theme})`, async ({
    page,
  }) => {
    await page.addInitScript(
      (theme) => localStorage.setItem("washsense-theme", theme),
      theme,
    );
    await page.setViewportSize({ width: 390, height: 844 });
    const violations: unknown[] = [];
    for (const route of [
      "visao-geral",
      "maquinas",
      "reservatorios",
      "consumo",
      "energia",
      "alertas",
      "relatorios",
      "configuracoes",
    ]) {
      await page.goto("/app.html#/" + route + "?demo=1");
      await expect(page.locator(".ws-module:visible")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        route + " overflow",
      ).toBeTruthy();
      await page.emulateMedia({ reducedMotion: "reduce" });
      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      violations.push(
        ...result.violations.map((v) => ({
          route,
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
      );
    }
    expect(violations).toEqual([]);
  });
test("tariff lookup contract and dashboard cost remain consistent", async ({
  page,
}) => {
  await page.addInitScript(
    ({ project, session }) =>
      localStorage.setItem(
        "sb-" + project + "-auth-token",
        JSON.stringify(session),
      ),
    { project, session },
  );
  await page.route(
    "https://" + project + ".supabase.co/functions/v1/lookup-energy-tariff",
    async (route) => {
      expect(route.request().postDataJSON()).toEqual({
        distributor: "Enel",
        group: "B3",
      });
      await route.fulfill({
        json: {
          tariff: {
            distributor_name: "Enel SP",
            subgroup: "B3",
            te: 0.3,
            tusd: 0.4,
            base: 0.7,
            valid_from: "2026-01-01",
            flag: { name: "Verde", additional_kwh: 0 },
          },
        },
      });
    },
  );
  await page.goto("/app.html#/visao-geral");
  await expect(
    page.locator(".ws-module:visible #dashEnergyCost"),
  ).toContainText("Configure a tarifa");
  await page
    .locator(".ws-sidebar nav")
    .getByRole("link", { name: "Energia", exact: true })
    .click();
  await page.locator(".ws-module:visible #refreshTariff").click();
  await expect(page.locator(".ws-module:visible #tariffStatus")).toContainText(
    "Cálculo atualizado",
  );
  const total = await page
    .locator(".ws-module:visible #energyCostTitle")
    .innerText();
  await page
    .locator(".ws-sidebar nav")
    .getByRole("link", { name: "Visão geral", exact: true })
    .click();
  await expect(page.locator(".ws-module:visible #dashEnergyCost")).toHaveText(
    total,
  );
});
test("login accessibility", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/login.html");
  const audit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    audit.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
});
