import { defineConfig } from "vitest/config";

// Tests unitaires seulement : e2e/ est exécuté par Playwright sur le Worker construit.
export default defineConfig({ test: { include: ["test/**/*.test.ts"] } });
