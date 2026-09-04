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
    /*
     Only rules outside the obsidianmd recommended set are relaxed here. The
     community plugin scorecard lints with that set and ignores this file, so
     turning any of its rules off locally only hides scorecard findings.
    */
    rules: {
      'no-new': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { args: 'none' }],
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      'no-void': ['error', { allowAsStatement: true }],
      'no-useless-constructor': 'off'
    }
  }
]
