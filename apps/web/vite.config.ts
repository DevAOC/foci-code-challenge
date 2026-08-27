/// <reference types="vitest/config" />
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// In development the browser talks to relative /api/* URLs and Vite forwards
// them to the Fastify API, stripping the prefix. No CORS, no VITE_* variables.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3000",
        rewrite: (url) => url.replace(/^\/api/, ""),
      },
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/test/setup.ts"],
    // Deterministic formatting of due dates regardless of the developer's zone.
    env: { TZ: "America/Toronto" },
    coverage: {
      provider: "v8",
      include: ["src/**"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/test/**", "src/main.tsx", "src/components/ui/**"],
      reporter: ["text"],
    },
  },
});
