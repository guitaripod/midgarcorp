import { describe, it, expect } from 'vitest';
import {
  MARKDOWN_TWIN,
  appMarkdown,
  llmsFull,
  llmsIndex,
  markdownPath,
  postMarkdown,
  priceSummary,
} from '../../src/utils/llms';
import { landingApps } from '../../src/data/landing';
import { linuxApps } from '../../src/data/linux';
import { ossProjects } from '../../src/data/oss';
import { PRODUCT_PAGES } from '../../src/data/product-pages';

const post = {
  slug: 'building-clis-in-go',
  body: '## Why Go\n\nBecause.\n',
  data: {
    title: 'Building CLIs in Go',
    description: 'A guide.',
    pubDate: new Date('2024-01-20'),
    tags: ['go', 'cli'],
  },
};

const site = {
  apps: landingApps,
  products: PRODUCT_PAGES,
  linux: linuxApps,
  oss: ossProjects,
  posts: [post],
};

describe('llms', () => {
  it('puts each Markdown twin at the page URL plus index.html.md', () => {
    expect(MARKDOWN_TWIN).toBe('index.html.md');
    expect(markdownPath('')).toBe('/index.html.md');
    expect(markdownPath('flaccy')).toBe('/flaccy/index.html.md');
    expect(markdownPath('/blog/x/')).toBe('/blog/x/index.html.md');
  });

  it('follows the llms.txt shape: one H1, a summary quote, then H2 link lists', () => {
    const index = llmsIndex(site);
    const lines = index.split('\n');
    expect(lines[0]).toBe('# Midgar Corp');
    expect(lines.filter((line) => line.startsWith('# '))).toHaveLength(1);
    expect(lines[2].startsWith('> ')).toBe(true);
    expect(lines.filter((line) => line.startsWith('## ')).at(-1)).toBe('## Optional');
    for (const app of landingApps) {
      expect(index).toContain(`(https://midgarcorp.cc/${app.slug}/index.html.md)`);
    }
    expect(index).toContain('(https://midgarcorp.cc/blog/building-clis-in-go/index.html.md)');
    for (const product of PRODUCT_PAGES) {
      expect(index).toContain(`(https://midgarcorp.cc/${product.slug}/)`);
    }
    expect(index).not.toContain('](https://midgarcorp.cc/):');
    expect(lines[2]).not.toContain('Linux,');
  });

  it('links every product page with its canonical trailing slash', () => {
    const urls = [...llmsIndex(site).matchAll(/\]\((https:\/\/midgarcorp\.cc[^)]*)\)/g)].map(
      (match) => match[1]
    );
    expect(urls.length).toBeGreaterThan(landingApps.length);
    for (const url of urls) expect(url).toMatch(/(\/|\.md|\.txt|\.xml)$/);
  });

  it('states what an assistant is asked about first for every app', () => {
    for (const app of landingApps) {
      const md = appMarkdown(app);
      expect(md.startsWith(`# ${app.name}\n`)).toBe(true);
      expect(md).toContain(`- Page: https://midgarcorp.cc/${app.slug}/`);
      expect(md).toContain(`- Platforms: ${app.platforms.join(', ')}`);
      expect(md).toContain(`- Price: ${priceSummary(app)}`);
      expect(md).toContain('## FAQ');
      for (const f of app.content.faq) expect(md).toContain(`### ${f.q}`);
    }
  });

  it('prices a free app with paid tiers by its tiers, not only the free download', () => {
    const flaccy = landingApps.find((app) => app.slug === 'flaccy')!;
    expect(priceSummary(flaccy)).toMatch(/^Free download; in-app purchases: .*\$/);
  });

  it('serves a post as its own Markdown under a dated header', () => {
    const md = postMarkdown(post);
    expect(md).toContain('# Building CLIs in Go');
    expect(md).toContain('- Page: https://midgarcorp.cc/blog/building-clis-in-go/');
    expect(md).toContain('- Published: 2024-01-20');
    expect(md).toContain('## Why Go');
  });

  it('carries every app page in full after the index', () => {
    const full = llmsFull(site);
    expect(full.startsWith(llmsIndex(site))).toBe(true);
    for (const app of landingApps) expect(full).toContain(appMarkdown(app));
  });
});
