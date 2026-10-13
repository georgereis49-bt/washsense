import { test, expect } from "./fixtures";
const demo = "/app.html#/visao-geral?demo=1";
test("navigation is client-side and retains filters, theme and equipment deep links", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(demo);
  await expect(
    page.getByRole("heading", { name: "Visão geral da operação" }),
  ).toBeVisible();
  await page.evaluate(() => ((window as any).__spaMarker = "retained"));
  await page.locator(".ws-module:visible #periodBtn").click();
  await expect(page.locator(".ws-module:visible #periodBtn")).toContainText(
    "Últimos 7 dias",
  );
  for (const name of [
    "Máquinas",
    "Reservatórios",
    "Consumo",
    "Energia",
    "Alertas",
    "Relatórios",
    "Configurações",
  ]) {
    await page
      .locator(".ws-sidebar nav")
      .getByRole("link", { name, exact: true })
      .click();
    await expect(page.locator(".ws-module:visible")).toBeVisible();
    if (name === "Energia")
      await expect(
        page.locator(".ws-module:visible #tab-energia"),
      ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Não foi possível abrir este módulo" }),
    ).toHaveCount(0);
  }
  await page
    .locator(".ws-sidebar nav")
    .getByRole("link", { name: "Visão geral", exact: true })
    .click();
  await expect(page.locator(".ws-module:visible #periodBtn")).toContainText(
    "Últimos 7 dias",
  );
  expect(await page.evaluate(() => (window as any).__spaMarker)).toBe(
    "retained",
  );
  await page
    .locator('.ws-module:visible [data-detail="maquinas"][data-id="M02"]')
    .click();
  await expect(page).toHaveURL(/maquinas\?id=M02/);
  await page.reload();
  await expect(page.locator(".ws-module:visible #pageTitle")).toContainText(
    "Lavadora 02",
  );
  await page.getByRole("button", { name: "Ativar tema escuro" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(errors).toEqual([]);
});
test("settings drafts survive navigation and reports honor the requested type", async ({
  page,
}) => {
  await page.goto("/app.html#/configuracoes?demo=1");
  await expect(page.locator(".ws-module:visible #washers")).toBeVisible();
  await page.locator(".ws-module:visible #washers").fill("14");
  await page
    .locator(".ws-sidebar nav")
    .getByRole("link", { name: "Relatórios", exact: true })
    .click();
  await expect(page.locator(".ws-module:visible #preview")).toContainText(
    "Relatório gerencial",
  );
  await page
    .locator(".ws-sidebar nav")
    .getByRole("link", { name: "Configurações", exact: true })
    .click();
  await expect(page.locator(".ws-module:visible #washers")).toHaveValue("14");
  await page.goto("/app.html#/relatorios?type=energia&demo=1");
  await expect(page.locator(".ws-module:visible #type")).toHaveValue("energia");
});
test("anonymous users are redirected and demo cannot access payments", async ({
  page,
}) => {
  await page.goto("/app.html#/financeiro");
  await expect(page).toHaveURL(/login.html/);
  await expect(page.locator("#loginForm")).toBeVisible();
  await page.goto("/app.html#/financeiro?demo=1");
  await expect(
    page.getByRole("heading", { name: "Financeiro protegido" }),
  ).toBeVisible();
  await expect(page.locator("#payNow")).toHaveCount(0);
});
test("legacy URLs retain entity and report query parameters", async ({
  page,
}) => {
  await page.goto("/details.html?view=maquinas&id=M03&demo=1");
  await expect(page).toHaveURL(/app.html#\/maquinas\?id=M03&demo=1/);
  await expect(page.locator(".ws-module:visible #pageTitle")).toContainText(
    "Lavadora 03",
  );
  await page.goto("/report.html?type=consumo&demo=1");
  await expect(page.locator(".ws-module:visible #type")).toHaveValue("consumo");
});
for (const width of [390, 768, 1440])
  test(`responsive layout ${width}px and keyboard navigation`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(demo);
    await expect(
      page.getByRole("heading", { name: "Visão geral da operação" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    if (width < 800) {
      await page.getByRole("button", { name: "Abrir navegação" }).click();
      await expect(page.locator(".ws-sidebar")).toHaveClass(/ws-open/);
      await page.keyboard.press("Escape");
      await expect(page.locator(".ws-sidebar")).not.toHaveClass(/ws-open/);
    } else {
      await page.getByRole("button", { name: "Recolher sidebar" }).click();
      await expect(page.locator(".ws-platform")).toHaveClass(/ws-collapsed/);
      await page.getByRole("button", { name: "Expandir sidebar" }).click();
    }
    await page
      .locator(
        '.ws-module:visible [data-detail="reservatorios"][data-id="detergente"]',
      )
      .focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/reservatorios\?id=detergente/);
    await expect(page.locator(".ws-module:visible #pageTitle")).toContainText(
      "Detergente",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
  });
test("visual baseline in light and dark mode", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(demo);
  await expect(
    page.getByRole("heading", { name: "Visão geral da operação" }),
  ).toBeVisible();
  await expect(page).toHaveScreenshot("dashboard-light.png", {
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Ativar tema escuro" }).click();
  await expect(page).toHaveScreenshot("dashboard-dark.png", {
    fullPage: true,
    animations: "disabled",
  });
});
test("report CSV export identifies demonstration data", async ({ page }) => {
  await page.goto("/app.html#/relatorios?demo=1");
  await expect(page.locator(".ws-module:visible #preview")).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar CSV" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(
    "washsense-relatorio-demonstrativo.csv",
  );
  const stream = await download.createReadStream();
  let csv = "";
  for await (const chunk of stream!) csv += chunk.toString("utf8");
  expect(csv).toContain("Relatório demonstrativo");
  expect(csv).toContain("Detergente");
});
