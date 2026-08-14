import { defineConfig } from "vitest/config"
import { fileURLToPath } from "node:url"

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    // Each file sets the env it needs (APP_SECRET, NODE_ENV), so they must not
    // share a process and race on process.env.
    isolate: true,
  },
})
