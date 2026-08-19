import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['lib/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // The build script is plain Node ESM (no import of node:console/URL needed).
    files: ['build.mjs'],
    languageOptions: { globals: { console: 'readonly', process: 'readonly', URL: 'readonly' } },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // Iron rule 2 machine boundary (P2-b review item 1, landed P2-c): every
    // @deepseek-ai VALUE import outside the adapter single point is an error —
    // the official wire/service coupling must live in src/adapters/upstream.ts
    // only (a stray value import would also break the browser bundle's externals
    // contract). Type-only imports stay allowed: they are the sanctioned
    // composition faces (framework props/slot types — erased at build, zero
    // runtime coupling; the P2-b ruling treats framework-injected faces as
    // composition surface, not official calls). Enforced through the
    // typescript-eslint extension of the builtin no-restricted-imports (already
    // a devDependency — its allowTypeImports option is what makes the boundary
    // expressible; no new devDeps).
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/adapters/**'],
    rules: {
      '@typescript-eslint/no-restricted-imports': ['error', {
        patterns: [{
          group: ['@deepseek-ai/*', '@deepseek-ai/**'],
          allowTypeImports: true,
          message: 'Iron rule 2: @deepseek-ai value imports live only in src/adapters/upstream.ts (official-domain single touchpoint); type-only imports are allowed.',
        }],
      }],
    },
  },
  {
    // Iron rule 4 machine discipline (P2-f): user-visible Chinese copy may not
    // live in component files — it belongs in src/client/locale.ts (the zh
    // dictionary is the key-set source of truth; en is compile-checked against
    // it). AST-scoped by construction: no-restricted-syntax matches literal
    // EXPRESSIONS only, so comments (including Chinese documentation) are
    // never flagged. Non-copy CJK that stays legitimate: none today — the
    // locale dictionary file itself is exempt as the single owner.
    files: ['src/client/**/*.{ts,tsx}'],
    ignores: ['src/client/locale.ts'],
    rules: {
      'no-restricted-syntax': ['error',
        {
          selector: 'Literal[value=/[\\u4e00-\\u9fff]/]',
          message: 'Iron rule 4: Chinese copy lives only in src/client/locale.ts (register it in the bc namespace dictionary).',
        },
        {
          selector: 'TemplateElement[value.raw=/[\\u4e00-\\u9fff]/]',
          message: 'Iron rule 4: Chinese copy lives only in src/client/locale.ts (register it in the bc namespace dictionary).',
        },
      ],
    },
  },
)
