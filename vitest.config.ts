import path from "path"
import { transformWithOxc } from "vite"
import { configDefaults, defineConfig } from "vitest/config"

const mobileNotificationRouting = /\/android\/src\/lib\/mobile-notification-routing\.ts$/

export default defineConfig({
  oxc: { exclude: mobileNotificationRouting },
  plugins: [{
    name: "standalone-mobile-notification-routing",
    async transform(code, id) {
      if (!mobileNotificationRouting.test(id)) return
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
