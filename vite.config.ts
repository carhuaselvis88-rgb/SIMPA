import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base relativa: funciona igual en GitHub Pages, Cloudflare Pages o una carpeta local
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: { outDir: "dist", sourcemap: false, chunkSizeWarningLimit: 900 },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: { provider: "v8", include: ["src/domain/**/*.ts"], exclude: ["src/**/*.test.ts"], reporter: ["text", "json-summary", "html"] },
  },
});
