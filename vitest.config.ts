import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
  },
  resolve: {
    alias: {
      "@lib": new URL("./src/lib", import.meta.url).pathname,
      "@utils": new URL("./src/utils", import.meta.url).pathname,
      "@components": new URL("./src/components", import.meta.url).pathname,
      "@layouts": new URL("./src/layouts", import.meta.url).pathname,
    },
  },
});
