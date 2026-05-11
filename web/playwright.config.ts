import { defineConfig, devices } from "@playwright/test";

/**
 * Testes ponta a ponta contra a stack local (recomendado: `docker compose up --build` na raiz).
 *
 * Variáveis:
 * - `PLAYWRIGHT_BASE_URL` — URL do portal (padrão: http://localhost:3000).
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
