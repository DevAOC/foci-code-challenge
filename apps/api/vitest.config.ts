import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    globalSetup: ["./src/test/global-setup.ts"],
    setupFiles: ["./src/test/setup.ts"],
    fileParallelism: false,
    coverage: {
      provider: "v8",
      include: ["src/app.ts", "src/http/**", "src/todos/**", "src/test/http.ts"],
      exclude: ["**/*.test.ts"],
      reporter: ["text"],
    },
  },
});
