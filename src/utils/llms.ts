import type { LandingApp } from '../data/landing';
import type { LinuxApp } from '../data/linux';
import type { OssProject } from '../data/oss';
import type { ProductPage } from '../data/product-pages';
import { cleanAppStoreDescription } from './app-description';
import { privacyUrlFor, supportPath, SUPPORT_EMAIL } from './app-links';
import { SITE, absoluteUrl, canonicalLink } from './site-url';
import { APP_STORE_DEVELOPER_URL } from './structured-data';

export interface LlmsPost {
  slug: string;
  body: string;
  data: {
    title: string;
    description: string;
    pubDate: Date;
    updatedDate?: Date;
    tags: string[];
  };
}

export interface LlmsSite {
  apps: LandingApp[];
  products: ProductPage[];
  linux: LinuxApp[];
  oss: OssProject[];
  posts: LlmsPost[];
}

/// The file name of a page's Markdown twin. llmstxt.org appends `.md` to a page's URL, and
/// `index.html.md` to one that ends in a slash, so `/flaccy/` is `/flaccy/index.html.md`.
/// The routes take it as a parameter because Astro folds an `index.html.md` file name into
/// its parent (`/flaccy.html.md`).
export const MARKDOWN_TWIN = 'index.html.md';

/// Where a page's Markdown twin lives.
export function markdownPath(pagePath: string): string {
  const trimmed = pagePath.replace(/^\/+|\/+$/g, '');
  return trimmed ? `/${trimmed}/${MARKDOWN_TWIN}` : `/${MARKDOWN_TWIN}`;
}

const day = (iso?: string | Date | null): string | undefined => {
  if (!iso) return undefined;
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString().slice(0, 10);
};

const oneLine = (text: string): string => text.replace(/\s+/g, ' ').trim();

/// Store text breaks paragraphs with single newlines, which Markdown would run together.
const paragraphs = (text: string): string =>
  text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n\n');

const bullet = (label: string, value?: string | null): string[] =>
  value ? [`- ${label}: ${value}`] : [];

/// The price as a person would say it: the download, then what the paid tiers cost.
export function priceSummary(app: LandingApp): string {
  const tiers = (app.content.pricing?.tiers ?? []).filter((tier) => tier.price);
  const download = app.price === 'Free' ? 'Free download' : `${app.price} download`;
  if (tiers.length === 0) return download;
  const paid = tiers.map((tier) => `${tier.name} ${tier.price}`).join(', ');
  return `${download}; in-app purchases: ${paid} (US prices)`;
}

function minimumOs(app: LandingApp): string | undefined {
  if (app.content.requires) return app.content.requires;
  if (!app.minimumOsVersion) return undefined;
  const os = app.platforms.some((p) => p === 'iPhone' || p === 'iPad')
    ? 'iOS'
    : app.platforms.includes('Mac')
      ? 'macOS'
      : undefined;
  return os ? `${os} ${app.minimumOsVersion} or later` : undefined;
}

/// One app's landing page as Markdown: the facts an assistant is asked about first
/// (what it does, where it runs, what it costs, where to get it), then the page's copy.
export function appMarkdown(app: LandingApp): string {
  const c = app.content;
  const onAppStore = app.trackId > 0 && app.status !== 'review';
  const privacy = privacyUrlFor(app.slug);
  const languages = app.languages?.length
    ? [...new Set(app.languages.map((code) => code.toUpperCase()))].join(', ')
    : undefined;
  const lines: string[] = [
    `# ${app.name}`,
    '',
    `> ${oneLine(c.metaDescription)}`,
    '',
    ...bullet('Page', absoluteUrl(`/${app.slug}/`)),
    `- Developer: Midgar Oy (${SITE}/)`,
    ...bullet('Platforms', app.platforms.join(', ')),
    ...bullet('Category', app.category),
    ...bullet('Price', priceSummary(app)),
    ...bullet(
      'Current version',
      app.version
        ? `${app.version}${app.currentVersionReleaseDate ? ` (released ${day(app.currentVersionReleaseDate)})` : ''}`
        : undefined
    ),
    ...bullet('Requires', minimumOs(app)),
    ...bullet(
      'App Store rating',
      app.ratingCount > 0
        ? `${app.rating.toFixed(1)} out of 5 from ${app.ratingCount} rating${app.ratingCount === 1 ? '' : 's'}`
        : undefined
    ),
    ...bullet('Age rating', app.contentRating),
    ...bullet('Languages', languages),
    ...bullet('First released', day(app.releaseDate)),
    ...bullet('App Store', onAppStore ? app.appStoreUrl : undefined),
    ...bullet('Mac App Store', c.macAppStoreUrl),
    ...bullet('Source code', app.githubUrl),
    ...bullet('Support', absoluteUrl(supportPath(app.slug))),
    ...bullet('Privacy policy', privacy),
    '',
    `## ${c.heroHeadline}`,
    '',
    oneLine(c.heroSubhead),
  ];

  if (c.highlights.length) {
    lines.push('', '## Highlights', '', ...c.highlights.map((h) => `- ${oneLine(h)}`));
  }

  lines.push('', '## Features');
  for (const feature of c.features) {
    lines.push('', `### ${feature.title}`, '', oneLine(feature.body));
  }

  if (c.howItWorks?.length) {
    lines.push('', '## How it works', '');
    c.howItWorks.forEach((step, index) => {
      lines.push(`${index + 1}. **${step.step}**: ${oneLine(step.body)}`);
    });
  }

  if (c.install) {
    lines.push('', `## ${c.install.title}`, '', oneLine(c.install.intro));
    c.install.steps.forEach((step, index) => {
      lines.push('', `${index + 1}. **${step.title}**: ${oneLine(step.body)}`);
      if (step.code?.length) lines.push('', '```sh', ...step.code, '```');
      if (step.note) lines.push('', `   ${oneLine(step.note)}`);
    });
  }

  lines.push('', '## Pricing', '');
  if (c.pricing) {
    const { free, premium, tiers, footnote } = c.pricing;
    lines.push(
      `**${free.title}** (${free.price}):`,
      ...free.items.map((item) => `- ${oneLine(item)}`),
      '',
      `**${premium.title}** (${premium.price}):`,
      ...premium.items.map((item) => `- ${oneLine(item)}`),
      ''
    );
    for (const tier of tiers) {
      lines.push(`- ${tier.name}: ${tier.price}${tier.note ? ` (${tier.note})` : ''}`);
    }
    lines.push('', oneLine(footnote));
  } else {
    lines.push(oneLine(c.pricingNote));
  }

  if (c.trustNote) lines.push('', oneLine(c.trustNote));

  lines.push('', '## FAQ');
  for (const item of c.faq) {
    lines.push('', `### ${item.q}`, '', oneLine(item.a));
  }

  if (app.releaseNotes && app.version) {
    lines.push('', `## What's new in ${app.version}`, '', paragraphs(app.releaseNotes));
  }

  if (!c.hideAbout && app.description) {
    lines.push(
      '',
      '## App Store description',
      '',
      cleanAppStoreDescription(app.description).trim()
    );
  }

  lines.push(
    '',
    '## Contact',
    '',
    `Questions and support: ${SUPPORT_EMAIL}. More apps by Midgar Oy: ${SITE}/apps/ and ${APP_STORE_DEVELOPER_URL}.`
  );

  return `${lines.join('\n')}\n`;
}

/// A blog post as Markdown: its MDX source is already Markdown, so it goes out as written
/// under a header that says where it lives and when it was written.
export function postMarkdown(post: LlmsPost): string {
  const updated = day(post.data.updatedDate);
  return [
    `# ${post.data.title}`,
    '',
    `> ${oneLine(post.data.description)}`,
    '',
    `- Page: ${absoluteUrl(`/blog/${post.slug}/`)}`,
    '- Author: guitaripod (Midgar Oy)',
    `- Published: ${day(post.data.pubDate)}`,
    ...(updated ? [`- Updated: ${updated}`] : []),
    ...(post.data.tags.length ? [`- Tags: ${post.data.tags.join(', ')}`] : []),
    '',
    post.body.trim(),
    '',
  ].join('\n');
}

/// Items as a sentence lists them: "a, b and c".
const listOf = (items: string[]): string =>
  items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items.at(-1)}` : (items[0] ?? '');

const APP_STORE_PLATFORMS = ['iPhone', 'iPad', 'Mac', 'Apple Watch', 'Apple TV', 'Vision Pro'];

/// True when a project's homepage is an app or product page already listed in its own section.
function hasOwnPage(site: LlmsSite, homepageUrl: string | null): boolean {
  if (!homepageUrl) return false;
  const url = canonicalLink(homepageUrl);
  return [...site.apps.map((app) => app.slug), ...site.products.map((p) => p.slug)].some(
    (slug) => url === absoluteUrl(`/${slug}/`)
  );
}

const appLine = (app: LandingApp): string =>
  `- [${app.name}](${SITE}${markdownPath(app.slug)}): ${oneLine(app.content.metaDescription)} Runs on ${app.platforms.join(', ')}. ${priceSummary(app)}.`;

/// A sentence that ends like one, so the facts appended after it read as their own.
const sentence = (text: string): string => {
  const line = oneLine(text);
  return /[.!?]$/.test(line) ? line : `${line}.`;
};

const linuxLine = (app: LinuxApp): string => {
  const page = app.homepageUrl ? canonicalLink(app.homepageUrl) : app.githubUrl;
  return `- [${app.name}](${page}): ${sentence(app.description)} ${app.formLabel}, ${app.language}. Install: \`${app.install.primary.command}\``;
};

const productLine = (product: ProductPage): string =>
  `- [${product.name}](${absoluteUrl(`/${product.slug}/`)}): ${oneLine(product.metaDescription)}`;

const ossLine = (project: OssProject): string =>
  `- [${project.name}](${project.githubUrl}): ${sentence(project.description)}${project.language ? ` ${project.language}.` : ''}`;

const postLine = (post: LlmsPost): string =>
  `- [${post.data.title}](${SITE}${markdownPath(`blog/${post.slug}`)}): ${oneLine(post.data.description)}`;

/// The /llms.txt index (llmstxt.org): who Midgar is, then every app, tool, project and post
/// with a link an agent can fetch, the least essential links last under "Optional".
export function llmsIndex(site: LlmsSite): string {
  const platforms = APP_STORE_PLATFORMS.filter((platform) =>
    site.apps.some((app) => app.platforms.includes(platform))
  );
  return [
    '# Midgar Corp',
    '',
    `> Midgar Corp (legal name Midgar Oy) is an independent software studio in Finland run by the developer guitaripod. It makes ${site.apps.length} apps on the App Store for ${listOf(platforms)}, ${site.linux.length} Linux apps and command-line tools, and ${site.oss.length} open-source projects.`,
    '',
    `Every App Store app has a page at ${SITE}/<app>/ with its features, pricing, FAQ, support and privacy policy; each app and post below links to the Markdown version of its page (the page URL plus \`index.html.md\`). The apps are published on the App Store by Midgar Oy: ${APP_STORE_DEVELOPER_URL}. Support for any app: ${SUPPORT_EMAIL}.`,
    '',
    `## Apps for ${listOf(platforms)}`,
    '',
    ...site.apps.map(appLine),
    '',
    '## Linux tools and browser extensions',
    '',
    ...site.products.map(productLine),
    ...site.linux.filter((app) => !hasOwnPage(site, app.homepageUrl)).map(linuxLine),
    '',
    '## Writing',
    '',
    ...site.posts.map(postLine),
    '',
    '## Optional',
    '',
    `- [All apps](${SITE}/apps/): every App Store app with its latest release`,
    `- [Linux apps and tools](${SITE}/linux/): install commands for every Linux tool`,
    `- [Open source](${SITE}/opensource/): every open-source project, ranked by the work behind it`,
    ...site.oss.slice(0, 20).map(ossLine),
    `- [Midgar in the open](${SITE}/open/): the apps' downloads, sales and usage, published`,
    `- [Engineering services](${SITE}/services/): hire guitaripod`,
    `- [Privacy policies and terms](${SITE}/legal/)`,
    `- [Profiles](${SITE}/links/): GitHub, X, YouTube, Twitch`,
    `- [Blog RSS feed](${SITE}/rss.xml)`,
    '',
  ].join('\n');
}

/// /llms-full.txt: the index followed by every app page in full, for an agent that wants
/// the whole catalogue in one fetch. Blog posts stay as links; they are long and on topic
/// only when asked about.
export function llmsFull(site: LlmsSite): string {
  return [llmsIndex(site), ...site.apps.map(appMarkdown)].join('\n---\n\n');
}
