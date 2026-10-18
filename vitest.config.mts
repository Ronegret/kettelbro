import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Pruebas unitarias del motor y de la capa de datos (lógica pura, entorno Node).
export default defineConfig({
  resolve: {
    // Mismo alias que tsconfig.json: "@/lib/..." => ./src/lib/...
    alias: [{ find: /^@\//, replacement: `${fileURLToPath(new URL("./src", import.meta.url))}/` }],
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
