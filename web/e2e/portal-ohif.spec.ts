import { expect, test } from "@playwright/test";

/**
 * Executa contra a stack completa (API + Web + Postgres; Orthanc conforme README).
 * Ex.: na raiz do monorepo: `docker compose up --build`.
 * O estudo configurado no seed pode não existir no PACS remoto — o cenário garante mesmo assim
 * login → lista → abertura do OHIF → pelo menos uma resposta GET/HEAD ao proxy DICOMweb sem 5xx.
 */
test.describe("Portal BlueBeaver", () => {
  test("login → exames → OHIF dispara pedidos ao /api/dicomweb", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill("medico@portal.local");
    await page.getByLabel("Senha").fill("Medico123!");
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });

    await page.goto("/exames");
    await expect(page.getByRole("heading", { name: "Exames" })).toBeVisible();
    await expect(page.getByText("João Silva")).toBeVisible({ timeout: 30_000 });

    const popupPromise = page.waitForEvent("popup");
    await page.getByRole("button", { name: "Abrir estudo" }).first().click();
    const popup = await popupPromise;

    const dicomRespPromise = popup.waitForResponse(
      (r) => {
        const u = r.url();
        return (
          u.includes("/dicomweb/") &&
          (r.request().method() === "GET" || r.request().method() === "HEAD")
        );
      },
      { timeout: 120_000 },
    );

    await popup.waitForLoadState("domcontentloaded");
    await expect(popup).toHaveURL(/\/ohif\//, { timeout: 30_000 });

    const resp = await dicomRespPromise;
    expect(
      resp.status(),
      `proxy DICOMweb respondeu ${resp.status()} para ${resp.url()}`,
    ).toBeLessThan(500);
  });

  test("login → dashboard carrega Catálogo visível e GET /studies/me/summary", async ({
    page,
  }) => {
    const summaryResp = page.waitForResponse(
      (r) =>
        r.url().includes("/studies/me/summary") &&
        r.request().method() === "GET" &&
        r.ok(),
      { timeout: 60_000 },
    );

    await page.goto("/login");
    await page.getByLabel("E-mail").fill("admin@portal.local");
    await page.getByLabel("Senha").fill("Admin123!");
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });

    await summaryResp;

    await expect(
      page.getByRole("heading", { level: 2, name: "Catálogo visível" }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Estudos")).toBeVisible();
  });
});
