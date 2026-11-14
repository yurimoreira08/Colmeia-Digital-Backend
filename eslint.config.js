// @ts-check
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist/',
      'node_modules/',
      'backups/',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      // Variáveis descartadas de propósito (ex.: `{ passwordHash: _passwordHash, ...rest }`).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      // O código existente usa `any` em controllers e repositories (item B1).
      // Fica como aviso até a migração para tipos e Zod; código novo não deve usar `any`.
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
);
