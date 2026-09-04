import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  test: {
    environment: 'happy-dom',
    environmentOptions: {
      happyDOM: {
        settings: {
          // Transform tests parse HTML containing <iframe>; happy-dom would
          // otherwise fetch each iframe's src over the network.
          navigation: { disableChildFrameNavigation: true }
        }
      }
    },
    include: ['src/**/*.test.ts'],
    alias: {
      // Obsidian's npm package is type-only (its `main` field is empty), so
      // tests cannot import it at runtime. Redirect to a local stub.
      obsidian: fileURLToPath(new URL('./src/__mocks__/obsidian.ts', import.meta.url))
    }
  }
})
