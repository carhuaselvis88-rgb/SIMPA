import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30000,
  reporter: [["list"], ["html", { outputFolder: "reports/playwright", open: "never" }], ["json", { outputFile: "reports/playwright.json" }]],
  use: { baseURL: "http://localhost:4173", screenshot: "on", trace: "off" },
  webServer: { command: "npx vite preview --port 4173 --strictPort", url: "http://localhost:4173", reuseExistingServer: true, timeout: 60000 },
  projects: [
    { name: "escritorio", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 800 } } },
  ],
});
