import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwind from '@astrojs/tailwind';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  site: 'https://midgarcorp.cc',
  server: {
    host: true
  },
  integrations: [
    mdx({
      syntaxHighlight: 'shiki',
      shikiConfig: {
        theme: 'github-dark-dimmed',
        wrap: true,
      },
    }),
    sitemap(),
    tailwind(),
  ],
  output: 'hybrid',
  adapter: cloudflare({
    mode: 'directory',
  }),
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'hover',
  },
  markdown: {
    syntaxHighlight: 'shiki',
    shikiConfig: {
      theme: 'github-dark-dimmed',
      wrap: true,
      langs: [],
    },
  },
  vite: {
    optimizeDeps: {
      exclude: ['@pagefind/default-ui'],
    },
  },
});