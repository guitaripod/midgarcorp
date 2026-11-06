import { describe, it, expect } from 'vitest';
import {
  SUPPORT_EMAIL,
  privacyUrlFor,
  supportMailto,
  supportPath,
} from '../../src/utils/app-links';
import { landingApps } from '../../src/data/landing';

describe('app links', () => {
  it('sends support to the one address', () => {
    expect(SUPPORT_EMAIL).toBe('marcus@midgarcorp.cc');
    expect(supportMailto('Pay Day')).toBe('mailto:marcus@midgarcorp.cc?subject=Pay%20Day');
  });

  it('gives every landing app a support page with a trailing slash', () => {
    for (const app of landingApps) {
      expect(supportPath(app.slug)).toBe(`/${app.slug}/support/`);
    }
  });

  it('finds a privacy policy for every landing app', () => {
    for (const app of landingApps) {
      expect(privacyUrlFor(app.slug), app.slug).toMatch(/^https:\/\/midgarcorp\.cc\//);
    }
    expect(privacyUrlFor('payday')).toBe('https://midgarcorp.cc/legal/pay-day/privacy/');
    expect(privacyUrlFor('nothing')).toBeUndefined();
  });
});
