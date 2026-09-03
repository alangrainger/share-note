import obsidianmd from 'eslint-plugin-obsidianmd'
import neostandard from 'neostandard'

export default [
  {
    ignores: ['main.js', 'node_modules/**', 'esbuild.config.mjs', 'version-bump.mjs']
  },
  ...obsidianmd.configs.recommended,
  ...neostandard({ ts: true, noJsx: true, semi: false }),
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        sourceType: 'module'
      }
    },
    rules: {
      'no-new': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { args: 'none' }],
      '@typescript-eslint/ban-ts-comment': 'off',
      'no-prototype-builtins': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      'no-void': ['error', { allowAsStatement: true }],
      'no-useless-constructor': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/restrict-plus-operands': 'off'
    }
  },
  {
    // Tests and the obsidian stub run under happy-dom, where Obsidian's
    // createEl/createDiv/createSvg helpers don't exist.
    files: ['src/**/*.test.ts', 'src/__mocks__/**'],
    rules: {
      'obsidianmd/prefer-create-el': 'off'
    }
  },
  {
    // Transforms operate on a DOMParser document, which has no window of its
    // own. `doc.createElementNS(...)` already targets that document; the
    // rule's suggested `doc.win.createSvg(...)` would fall back to the global
    // window, and the helper doesn't exist in the test environment.
    files: ['src/pipeline/transforms/**'],
    rules: {
      'obsidianmd/prefer-create-el': 'off'
    }
  }
]
