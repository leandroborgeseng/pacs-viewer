import { expect, test } from "@playwright/test";

/**
 * Requer API + Web + Postgres + Orthanc (ex.: `docker compose up --build` na raiz do monorepo).
 * O estudo seed (`1.2.3.4...`) pode não existir no Orthanc; o teste valida sobretudo
 * login → lista → abertura do OHIF → pelo menos um pedido GET ao proxy DICOMweb sem erro 5xx.
 */
test.describe("Portal BlueBeaver", () => {
  test("login → exames → OHIF dispara pedidos ao /api/dicomweb", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill("medico@portal.local");
    await page.getByLabel("Palavra-passe").fill("Medico123!");
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
});
