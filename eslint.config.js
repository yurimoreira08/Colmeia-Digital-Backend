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
      // Camada legada SQLite/pg sem uso pelas rotas (item B8 do relatório).
      // Será removida; até lá não vale a pena adequá-la ao lint.
      'src/data/database.ts',
      'src/data/migrations.ts',
      'src/data/seeds.ts',
      'src/controllers/migration.controller.ts',
      'src/restore-to-supabase.ts',
      'src/test-db-connection.ts',
      'src/check-git.ts',
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
