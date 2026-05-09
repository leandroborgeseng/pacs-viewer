import { defineConfig, devices } from "@playwright/test";

/**
 * Validação fim-a-fim contra stack local (recomendado: `docker compose up --build`).
 *
 * Variáveis:
 * - `PLAYWRIGHT_BASE_URL` — portal (default http://localhost:3000)
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    ...devices["Desktop Chrome"],
    trace: "on-first-retry",
  },
  timeout: 180_000,
});
