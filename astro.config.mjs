import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwind from '@astrojs/tailwind';
import cloudflare from '@astrojs/cloudflare';
import { readFileSync, readdirSync } from 'node:fs';
import { isIndexable, lastmodByPath, postDates, withLastmod } from './src/lib/sitemap.mjs';

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));

/// The dated records each page is built from, gathered once for the sitemap's lastmod.
function sitemapDates() {
  const live = readJson('./src/data/landing-live.json');
  const apps = readJson('./src/data/landing-facts.json').apps.map((app) => ({
    ...app,
    ...(live[String(app.trackId)] ?? {}),
  }));
  const blogDir = new URL('./src/content/blog/', import.meta.url);
  const posts = readdirSync(blogDir)
    .filter((name) => /\.mdx?$/.test(name))
    .map((name) => ({
      slug: name.replace(/\.mdx?$/, ''),
      ...postDates(readFileSync(new URL(name, blogDir), 'utf8')),
    }))
    .filter((post) => !post.draft);
  const open = readJson('./src/data/open-stats.json');
  return lastmodByPath({
    apps,
    posts,
    linux: readJson('./src/data/linux-apps.json').apps,
    oss: readJson('./src/data/opensource.json').projects,
    blackwall: readJson('./src/data/blackwall.json').generated,
    open: open.rules?.note?.startsWith('SAMPLE DATA') ? undefined : open.generated_at,
  });
}

const lastmods = sitemapDates();

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
    sitemap({
      filter: isIndexable,
      serialize: (item) => withLastmod(item, lastmods),
    }),
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
});