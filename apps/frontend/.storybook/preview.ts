import type { Preview } from '@storybook/nextjs-vite';
import { createElement, useEffect, type ReactNode } from 'react';
import { fontGeist } from '../lib/fonts';
import { cn } from '../lib/utils';
import '../app/globals.css';

const storybookFontGeist = cn(fontGeist, 'font-sans');

function StorybookFontProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const fontClasses = storybookFontGeist.split(' ').filter(Boolean);

    document.documentElement.classList.add(...fontClasses);
    document.body.classList.add(...fontClasses);

    return () => {
      document.documentElement.classList.remove(...fontClasses);
      document.body.classList.remove(...fontClasses);
    };
  }, []);

  return createElement('div', { className: storybookFontGeist }, children);
}

const preview: Preview = {
  decorators: [
    (Story) => createElement(StorybookFontProvider, undefined, createElement(Story, {})),
  ],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: 'todo',
    },
  },
};

export default preview;
