declare module '@vitejs/plugin-react' {
  import type { PluginOption } from 'vite';

  interface ReactPluginOptions {
    include?: string | RegExp | Array<string | RegExp>;
    exclude?: string | RegExp | Array<string | RegExp>;
    jsxImportSource?: string;
    jsxRuntime?: 'classic' | 'automatic';
    babel?: unknown;
    fastRefresh?: boolean;
  }

  export default function react(options?: ReactPluginOptions): PluginOption;
}
