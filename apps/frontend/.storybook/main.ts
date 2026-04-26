import type { StorybookConfig } from '@storybook/nextjs-vite';
import { mergeConfig } from 'vite';

// Bind to 127.0.0.1 so the dev/preview build does not rely on resolving
// the hostname "localhost" (broken on some setups when /etc/hosts or DNS
// no longer maps localhost → loopback).
const loopbackHost = '127.0.0.1';

const config: StorybookConfig = {
  stories: [
    // "../stories/**/*.mdx",
    '../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)',
  ],
  addons: [
    '@chromatic-com/storybook',
    '@storybook/addon-vitest',
    '@storybook/addon-a11y',
    '@storybook/addon-docs',
    '@storybook/addon-onboarding',
  ],
  framework: '@storybook/nextjs-vite',
  staticDirs: ['../public'],
  async viteFinal(viteConfig) {
    return mergeConfig(viteConfig, {
      server: { host: loopbackHost },
      preview: { host: loopbackHost },
    });
  },
};
export default config;
