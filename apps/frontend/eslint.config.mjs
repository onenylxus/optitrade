import storybook from 'eslint-plugin-storybook';
import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import baseConfig from '../../eslint.config.mjs';

const eslintConfig = defineConfig([
  // Ignore directory patterns
  globalIgnores(['.next/**', 'out/**', 'build/**', 'storybook-static/**', 'next-env.d.ts']),

  // Base config
  ...baseConfig,

  // Next.js
  ...nextVitals,
  ...nextTs,
  {
    settings: {
      react: { version: '19' },
    },
  },

  // Storybook
  ...storybook.configs['flat/recommended'],
]);

export default eslintConfig;
