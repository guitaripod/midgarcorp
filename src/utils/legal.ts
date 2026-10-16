import portfolio from '../generated/portfolio.json';

export const LEGAL_DOCUMENTS = ['privacy', 'terms'] as const;

export type LegalDocument = (typeof LEGAL_DOCUMENTS)[number];

export const LEGAL_LABELS: Record<LegalDocument, string> = {
  privacy: 'Privacy Policy',
  terms: 'Terms of Use',
};

export interface RegistryApp {
  slug: string;
  name: string;
}

export interface LegalPage {
  slug: string;
  name: string;
  doc: LegalDocument;
  label: string;
  html: string;
}

const legalFiles = import.meta.glob<string>('/src/content/legal/*/*.html', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** Splits a `/src/content/legal/<slug>/<doc>.html` key into its slug and document, or `null` for any other file. */
export function parseLegalKey(key: string): { slug: string; doc: LegalDocument } | null {
  const match = /\/src\/content\/legal\/([^/]+)\/([^/]+)\.html$/.exec(key);
  if (!match) {
    return null;
  }
  const doc = match[2];
  return isLegalDocument(doc) ? { slug: match[1], doc } : null;
}

/** True when the name is one of the documents every app's legal pages come in. */
export function isLegalDocument(value: string): value is LegalDocument {
  return (LEGAL_DOCUMENTS as readonly string[]).includes(value);
}

/**
 * Every legal page written in src/content/legal, paired with the registry name of its app.
 * Throws when a content folder names a slug the registry does not know.
 */
export function legalPagesFrom(files: Record<string, string>, apps: RegistryApp[]): LegalPage[] {
  const names = new Map(apps.map((app) => [app.slug, app.name]));
  const pages: LegalPage[] = [];
  for (const [key, html] of Object.entries(files)) {
    const parsed = parseLegalKey(key);
    if (!parsed) {
      continue;
    }
    const name = names.get(parsed.slug);
    if (name === undefined) {
      throw new Error(`${key}: "${parsed.slug}" is not a slug in registry/apps`);
    }
    pages.push({ slug: parsed.slug, name, doc: parsed.doc, label: LEGAL_LABELS[parsed.doc], html });
  }
  return pages.sort(
    (a, b) =>
      a.slug.localeCompare(b.slug) ||
      LEGAL_DOCUMENTS.indexOf(a.doc) - LEGAL_DOCUMENTS.indexOf(b.doc)
  );
}

/** The legal pages of the build, one per app and document, in slug order with privacy before terms. */
export function legalPages(): LegalPage[] {
  return legalPagesFrom(legalFiles, portfolio.apps);
}

/** The registry apps that have at least one legal page, in registry order, with the documents each has. */
export function legalApps(
  pages: LegalPage[] = legalPages()
): { slug: string; name: string; docs: LegalDocument[] }[] {
  return portfolio.apps
    .map((app) => ({
      slug: app.slug,
      name: app.name,
      docs: pages.filter((page) => page.slug === app.slug).map((page) => page.doc),
    }))
    .filter((app) => app.docs.length > 0);
}
