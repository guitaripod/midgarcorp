export interface CatalogProp {
  name: string;
  optional: boolean;
  source: string;
  set?: string;
}

export interface CatalogNumeric {
  name: string;
  min: number;
  max: number;
  integer: boolean;
}

export interface CatalogEvent {
  name: string;
  purpose: string;
  unique: string;
  cohort: boolean;
  reserved: boolean;
  props: CatalogProp[];
  numeric: CatalogNumeric[];
}

export interface SignalsCatalog {
  uniqueness: Record<string, string>;
  dimensions: Record<string, string[]>;
  events: CatalogEvent[];
}

export interface CatalogMetric {
  id: string;
  title: string;
  purpose: string;
  unit: string;
  source: string;
  grain: string;
  caveat: string;
}

export interface MetricsCatalog {
  metrics: CatalogMetric[];
}

export interface PropView {
  name: string;
  optional: boolean;
  summary: string;
  values: string[];
}

export interface EventView {
  name: string;
  purpose: string;
  sent: string;
  reserved: boolean;
  cohort: boolean;
  props: PropView[];
  numeric: { name: string; summary: string }[];
}

export interface MetricView {
  id: string;
  title: string;
  purpose: string;
  unit: string;
  grain: string;
  source: string;
  caveat: string;
  published: boolean;
}

/// A set longer than this is described instead of listed, so the country list stays out of the page.
export const LISTED_VALUES_MAX = 12;

const SOURCE_PROPS: Record<string, string> = {
  products: "One of the product ids in Midgar's registry, such as a subscription or credit pack.",
  apps: "One of Midgar's apps, by its registry name or App Store id.",
};

const SET_PROPS: Record<string, string> = {
  storefront: 'The App Store country as a two-letter code. It is the store, not a location.',
};

const SOURCE_LABELS: Record<string, string> = {
  signals: 'usage counts',
  ledger: 'the purchase ledger',
  mako: 'the AI service',
  derived: 'other metrics',
  appstore: 'App Store reports',
};

/// What one prop is allowed to hold, in words and, for a short closed set, the values themselves.
export function propView(prop: CatalogProp, dimensions: Record<string, string[]>): PropView {
  const base = { name: prop.name, optional: prop.optional };
  if (prop.source === 'set' && prop.set) {
    const values = dimensions[prop.set] ?? [];
    if (values.length > LISTED_VALUES_MAX) {
      const note = SET_PROPS[prop.set] ?? 'One value from a fixed list.';
      return { ...base, summary: `${note} ${values.length} values are allowed.`, values: [] };
    }
    return { ...base, summary: 'One of', values };
  }
  return {
    ...base,
    summary: SOURCE_PROPS[prop.source] ?? 'One value from a fixed list.',
    values: [],
  };
}

/// A measurement's allowed range as a sentence.
function numericSummary(entry: CatalogNumeric): string {
  const kind = entry.integer ? 'a whole number' : 'a number';
  return `${kind} from ${entry.min.toLocaleString('en-US')} to ${entry.max.toLocaleString('en-US')}`;
}

/// A sentence with its first letter in capitals.
export function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/// Every event of the signals catalog as the page shows it: purpose, how often one install may send it, its props.
export function eventViews(catalog: SignalsCatalog): EventView[] {
  return catalog.events.map((event) => ({
    name: event.name,
    purpose: event.purpose,
    sent: capitalise((catalog.uniqueness[event.unique] ?? event.unique).replace(/`/g, '')),
    reserved: event.reserved,
    cohort: event.cohort,
    props: event.props.map((prop) => propView(prop, catalog.dimensions)),
    numeric: event.numeric.map((entry) => ({ name: entry.name, summary: numericSummary(entry) })),
  }));
}

/// Every metric of the metrics catalog except the App Store report figures (which come from Apple, not the apps), flagged when the public numbers on the page use it.
export function metricViews(catalog: MetricsCatalog, publishedIds: string[]): MetricView[] {
  const published = new Set(publishedIds);
  return catalog.metrics
    .filter((metric) => metric.source !== 'appstore')
    .map((metric) => ({
      id: metric.id,
      title: metric.title,
      purpose: metric.purpose,
      unit: metric.unit,
      grain: metric.grain,
      source: SOURCE_LABELS[metric.source] ?? metric.source,
      caveat: metric.caveat,
      published: published.has(metric.id),
    }));
}
