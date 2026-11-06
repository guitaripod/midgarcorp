/** The one address people write to for help with any Midgar app, the same one every app shows. */
export const SUPPORT_EMAIL = 'marcus@midgarcorp.cc';

const SITE = 'https://midgarcorp.cc';

const PRIVACY_OVERRIDES: Record<string, string> = {
  crucible: `${SITE}/crucible/privacy/`,
  solarbeam: `${SITE}/solarbeam/privacy`,
  tailscode: `${SITE}/tailscode/privacy/`,
};

/** Landing slug to the registry slug its policy lives under at midgarcorp.cc/legal/<slug>/. */
const LEGAL_SLUGS: Record<string, string> = {
  appofthedead: 'app-of-the-dead',
  doublekick: 'double-kick',
  dreameater: 'dream-eater',
  embr: 'embr',
  flaccy: 'flaccy',
  helia: 'helia',
  livingdex: 'living-dex',
  masterofflags: 'master-of-flags',
  masterofinventory: 'master-of-inventory',
  payday: 'pay-day',
  pixiepocket: 'pixiepocket',
  psybeam: 'psybeam',
  psywave: 'psywave',
};

/** The app's privacy policy, or `undefined` when the site publishes none for that landing slug. */
export function privacyUrlFor(slug: string): string | undefined {
  if (PRIVACY_OVERRIDES[slug]) return PRIVACY_OVERRIDES[slug];
  const legal = LEGAL_SLUGS[slug];
  return legal ? `${SITE}/legal/${legal}/privacy/` : undefined;
}

/** The app's support page on the site, with the trailing slash canonical URLs use. */
export function supportPath(slug: string): string {
  return `/${slug}/support/`;
}

/** True when one of the app's price tiers renews: a period other than a one-time purchase. */
export function hasSubscription(tiers: { period?: string }[] | undefined): boolean {
  return (tiers ?? []).some((tier) => !!tier.period && tier.period !== 'one-time');
}

/** A `mailto:` link to support with the app's name as the subject. */
export function supportMailto(appName: string): string {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(appName)}`;
}
