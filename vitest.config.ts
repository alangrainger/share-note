import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
    alias: {
      // Obsidian's npm package is type-only (its `main` field is empty), so
      // tests cannot import it at runtime. Redirect to a local stub.
      obsidian: fileURLToPath(new URL('./src/__mocks__/obsidian.ts', import.meta.url))
    }
  }
})
