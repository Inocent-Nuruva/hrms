import path from "path"
import { transformWithOxc } from "vite"
import { configDefaults, defineConfig } from "vitest/config"

const standaloneMobileModules = /\/android\/src\/lib\/(?:mobile-notification-routing|attendance-punch-policy)\.ts$/

export default defineConfig({
  oxc: { exclude: standaloneMobileModules },
  plugins: [{
    name: "standalone-mobile-modules",
    async transform(code, id) {
      if (!standaloneMobileModules.test(id)) return
      return transformWithOxc(code, id, { tsconfig: false })
    },
  }],
  test: {
    environment: "node",
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
