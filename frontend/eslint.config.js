// Flat config for ESLint v9. The old .eslintrc.cjs is intentionally removed
// — keeping both around makes ESLint silently ignore the legacy file.
import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

export default [
  // Don't lint generated output.
  { ignores: ['dist', 'coverage', 'node_modules', 'eslint.config.js'] },

  js.configs.recommended,

  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // TypeScript handles undefined-symbol errors itself and understands type-
      // only references (RequestInit, React.ReactElement, etc.) that ESLint's
      // built-in no-undef cannot see.
      'no-undef': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },

  // Tests have looser rules — they often need any-typed mocks and helper-only modules.
  {
    files: ['src/test/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'react-refresh/only-export-components': 'off',
    },
  },

  // These files intentionally co-locate a Provider plus a hook / helper that
  // are tightly coupled. Splitting them would move the HMR boundary without
  // improving correctness.
  {
    files: [
      'src/auth/AuthContext.tsx',
      'src/components/RootErrorBoundary.tsx',
      'src/components/Toaster.tsx',
    ],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
];
