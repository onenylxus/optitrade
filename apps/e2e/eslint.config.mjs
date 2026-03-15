import playwright from 'eslint-plugin-playwright';
import baseConfig from '../../eslint.config.mjs';

export default [
  // Base config
  ...baseConfig,

  // Playwright
  playwright.configs['flat/recommended'],
];
