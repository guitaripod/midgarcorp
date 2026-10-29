import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import signalsCatalog from '../../src/generated/signals-catalog.json';
import metricsCatalog from '../../src/generated/metrics-catalog.json';
import stats from '../../src/data/open-stats.json';
import { landingApps } from '../../src/data/landing';
import { nameFromSlug, openAppFor, sample, statsApps } from '../../src/data/open';
import {
  LISTED_VALUES_MAX,
  eventViews,
  metricViews,
  type MetricsCatalog,
  type SignalsCatalog,
} from '../../src/lib/open-catalog';
import { appsWithData } from '../../src/lib/open-stats.mjs';

const siteRoot = resolve(process.cwd());
const dist = `${siteRoot}/dist/`;
const registryGenerated = resolve(siteRoot, '../../registry/generated');
const monorepo = existsSync(resolve(registryGenerated, 'signals-catalog.json'));

const signals = signalsCatalog as unknown as SignalsCatalog;
const metrics = metricsCatalog as unknown as MetricsCatalog;

function mainText(file: string): string {
  const html = readFileSync(`${dist}${file}`, 'utf8');
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.querySelector('main')?.textContent ?? '';
}

describe('catalog copies', () => {
  it.skipIf(!monorepo)('match the registry files byte for byte in a monorepo checkout', () => {
    for (const name of ['signals-catalog.json', 'metrics-catalog.json']) {
      const copy = readFileSync(resolve(siteRoot, 'src/generated', name));
      expect(copy.equals(readFileSync(resolve(registryGenerated, name))), name).toBe(true);
    }
  });
});

describe('event views', () => {
  const views = eventViews(signals);

  it('list every event of the catalog in its order', () => {
    expect(views.map((view) => view.name)).toEqual(signals.events.map((event) => event.name));
    expect(views.length).toBeGreaterThan(10);
  });

  it('carry the purpose and say how often an install may send the event', () => {
    for (const [index, view] of views.entries()) {
      expect(view.purpose).toBe(signals.events[index].purpose);
      expect(view.sent.length, view.name).toBeGreaterThan(0);
      expect(view.sent.charAt(0), view.name).toBe(view.sent.charAt(0).toUpperCase());
      expect(view.sent, view.name).not.toContain('`');
    }
  });

  it('flag the events no app sends yet', () => {
    const reserved = signals.events.filter((event) => event.reserved).map((event) => event.name);
    expect(views.filter((view) => view.reserved).map((view) => view.name)).toEqual(reserved);
  });

  it('list a short closed set and describe a long one without printing it', () => {
    const placement = views.find((view) => view.name === 'paywall.view')?.props[0];
    expect(placement?.values).toEqual(signals.dimensions.placement);
    const storefront = views
      .find((view) => view.name === 'portal_open')
      ?.props.find((prop) => prop.name === 'storefront');
    expect(signals.dimensions.storefront.length).toBeGreaterThan(LISTED_VALUES_MAX);
    expect(storefront?.values).toEqual([]);
    expect(storefront?.optional).toBe(true);
    expect(storefront?.summary).toContain(String(signals.dimensions.storefront.length));
  });

  it('describe measurements with their allowed range', () => {
    const daily = views.find((view) => view.name === 'metrics.daily');
    expect(daily?.numeric.map((entry) => entry.name)).toContain('coldLaunchMs');
    expect(daily?.numeric[0].summary).toMatch(/^a number from 0 to /);
    const diagnostics = views.find((view) => view.name === 'metrics.diagnostics');
    expect(diagnostics?.numeric[0].summary).toMatch(/^a whole number from 0 to /);
  });
});

describe('metric views', () => {
  it('list every metric of the catalog but the App Store report ones and flag the published ones', () => {
    const views = metricViews(metrics, ['wau', 'purchases']);
    expect(views.map((view) => view.id)).toEqual(
      metrics.metrics.filter((metric) => metric.source !== 'appstore').map((metric) => metric.id)
    );
    expect(views.find((view) => view.id === 'wau')?.published).toBe(true);
    expect(views.find((view) => view.id === 'dau')?.published).toBe(false);
    expect(views.find((view) => view.id === 'sales')?.published).toBe(false);
  });
});

describe('apps on the page', () => {
  it('finds a landing page under either spelling of a slug', () => {
    expect(openAppFor('pay-day').href).toBe('/payday/');
    expect(openAppFor('solar-beam').name).toBe('Solar Beam');
    expect(openAppFor('psywave').href).toBe('/psywave/');
  });

  it('falls back to the slug for an app with no landing page', () => {
    expect(openAppFor('living-dex')).toEqual({
      slug: 'living-dex',
      name: 'Living Dex',
      href: null,
      icon: null,
    });
    expect(nameFromSlug('master-of-flags')).toBe('Master Of Flags');
  });

  it('gives every app of the snapshot a name and, when it has one, an icon on disk', () => {
    expect(statsApps).toEqual(appsWithData(stats as never));
    for (const slug of statsApps) {
      const app = openAppFor(slug);
      expect(app.name, slug).toBeTruthy();
      if (app.icon) expect(existsSync(`${siteRoot}/public${app.icon}`), app.icon).toBe(true);
    }
    expect(landingApps.length).toBeGreaterThan(0);
  });
});

describe('built /open page', () => {
  const built = existsSync(`${dist}open/index.html`);
  const html = () => readFileSync(`${dist}open/index.html`, 'utf8');
  const has = (text: string, needle: string) => text.includes(needle);

  it('exists in the build', () => {
    expect(built).toBe(true);
  });

  it.skipIf(!built)('lists every event of the signals catalog', () => {
    const text = mainText('open/index.html');
    for (const event of signals.events) {
      expect(has(text, event.name), event.name).toBe(true);
      expect(has(text, event.purpose), event.name).toBe(true);
    }
  });

  it.skipIf(!built)(
    'defines every metric of the metrics catalog but the App Store report ones',
    () => {
      const text = mainText('open/index.html');
      for (const metric of metrics.metrics.filter((entry) => entry.source !== 'appstore')) {
        expect(has(text, metric.title), metric.id).toBe(true);
        expect(has(text, metric.purpose), metric.id).toBe(true);
      }
    }
  );

  it.skipIf(!built)('shows hidden values as "<10" and not as an error', () => {
    const text = mainText('open/index.html');
    expect(has(text, '<10')).toBe(true);
    expect(has(html(), '&lt;10')).toBe(true);
    expect(/NaN|undefined|\[object Object\]/.test(text)).toBe(false);
  });

  it.skipIf(!built)('names the apps that have data, with their landing pages', () => {
    const text = mainText('open/index.html');
    for (const slug of statsApps) {
      const app = openAppFor(slug);
      expect(has(text, app.name), slug).toBe(true);
      if (app.href) expect(has(html(), `href="${app.href}"`), slug).toBe(true);
    }
  });

  it.skipIf(!built)('says the data is a sample only while the snapshot is one', () => {
    expect(has(mainText('open/index.html'), 'sample numbers')).toBe(sample);
    if (sample) expect(has(mainText('open/index.html'), stats.rules.note)).toBe(true);
  });

  it.skipIf(!built)('explains the privacy rules and links the open code', () => {
    const text = mainText('open/index.html');
    expect(has(text, 'Counts, not people')).toBe(true);
    expect(has(text, 'No identifier leaves a device')).toBe(true);
    expect(has(text, `Anything under ${stats.rules.min_count}`)).toBe(true);
    expect(
      has(
        html(),
        'https://github.com/guitaripod/midgarcorp/blob/master/src/generated/signals-catalog.json'
      )
    ).toBe(true);
    expect(has(html(), 'github.com/guitaripod/midgar-platform')).toBe(false);
    expect(
      has(html(), 'https://github.com/guitaripod/MidgarKit/tree/master/Sources/MidgarCore/Signals')
    ).toBe(true);
  });

  it.skipIf(!built)('notes that Master of Flags sends no usage counts', () => {
    const text = mainText('open/index.html');
    expect(has(text, 'Master of Flags sends no usage counts')).toBe(true);
    expect(has(text, "Apple's Kids Category")).toBe(true);
  });

  it.skipIf(!built)('uses no em dash', () => {
    expect(has(mainText('open/index.html'), String.fromCharCode(0x2014))).toBe(false);
  });

  it.skipIf(!built)('marks tables and charts for assistive technology', () => {
    expect(has(html(), '<caption class="sr-only">')).toBe(true);
    expect(has(html(), 'role="img"')).toBe(true);
    expect(/<th[^>]*scope="col"/.test(html())).toBe(true);
    expect(/<th[^>]*scope="row"/.test(html())).toBe(true);
    expect(has(html(), '(hidden: fewer than')).toBe(true);
  });

  it.skipIf(!built)('is in the footer and header navigation, active only on its own page', () => {
    const page = html();
    expect(has(page, 'href="/open"')).toBe(true);
    expect(/>\s*5:open\*\s*<\/a>/.test(page)).toBe(true);
    expect(/>\s*4:oss\s*<\/a>/.test(page)).toBe(true);
    const oss = readFileSync(`${dist}opensource/index.html`, 'utf8');
    expect(/>\s*4:oss\*\s*<\/a>/.test(oss)).toBe(true);
    expect(/>\s*5:open\s*<\/a>/.test(oss)).toBe(true);
  });
});
