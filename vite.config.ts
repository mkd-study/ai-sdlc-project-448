import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// GitHub Pages отдаёт сайт из каталога с именем репозитория, поэтому пути к файлам относительные.
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: { host: true, port: 8080, allowedHosts: true },
  preview: { host: true, port: 8080, allowedHosts: true },
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["src/test-setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
