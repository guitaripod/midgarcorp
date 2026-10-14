type SortKey = 'recent' | 'releases' | 'stars' | 'name';

interface BenchState {
  form: string;
  lang: string;
  sort: SortKey;
}

const SORTERS: Record<SortKey, (a: HTMLElement, b: HTMLElement) => number> = {
  recent: (a, b) => Number(b.dataset.updated) - Number(a.dataset.updated),
  releases: (a, b) => Number(b.dataset.releases) - Number(a.dataset.releases),
  stars: (a, b) => Number(b.dataset.stars) - Number(a.dataset.stars),
  name: (a, b) => (a.dataset.name ?? '').localeCompare(b.dataset.name ?? ''),
};

const benchState = new WeakMap<HTMLElement, BenchState>();

const stateFor = (bench: HTMLElement): BenchState => {
  let state = benchState.get(bench);
  if (!state) {
    state = { form: 'all', lang: 'all', sort: 'recent' };
    benchState.set(bench, state);
  }
  return state;
};

/// Hides cards the filters exclude, reorders the rest and updates the count line.
function paintBench(bench: HTMLElement): void {
  const grid = bench.querySelector<HTMLElement>('[data-bench-grid]');
  if (!grid) return;
  const state = stateFor(bench);
  const cards = [...grid.querySelectorAll<HTMLElement>('[data-linux-card]')];

  const visible = cards.filter((card) => {
    const show =
      (state.form === 'all' || card.dataset.form === state.form) &&
      (state.lang === 'all' || card.dataset.lang === state.lang);
    card.hidden = !show;
    return show;
  });

  [...cards].sort(SORTERS[state.sort]).forEach((card) => grid.appendChild(card));

  const count = bench.querySelector<HTMLElement>('[data-bench-count]');
  if (count) count.textContent = `showing ${visible.length} of ${cards.length}`;
  const empty = bench.querySelector<HTMLElement>('[data-bench-empty]');
  if (empty) empty.hidden = visible.length > 0;
}

function handleFilterClick(chip: HTMLElement): void {
  const bench = chip.closest<HTMLElement>('[data-bench]');
  const kind = chip.dataset.filterKind;
  if (!bench || (kind !== 'form' && kind !== 'lang')) return;
  stateFor(bench)[kind] = chip.dataset.filterValue ?? 'all';
  bench.querySelectorAll<HTMLElement>(`[data-filter-kind="${kind}"]`).forEach((other) => {
    other.setAttribute('aria-pressed', String(other === chip));
  });
  paintBench(bench);
}

/// Wires the bench: delegated clicks for the filter chips, a change handler for the
/// sort menu, and reveals the controls that only make sense with JavaScript.
export function initLinuxBench(): void {
  document.querySelectorAll<HTMLElement>('[data-bench-controls]').forEach((controls) => {
    controls.hidden = false;
  });

  document.addEventListener('click', (event) => {
    const chip = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-filter-kind]');
    if (chip) handleFilterClick(chip);
  });

  document.addEventListener('change', (event) => {
    const select = event.target;
    if (!(select instanceof HTMLSelectElement) || !select.matches('[data-bench-sort]')) return;
    const bench = select.closest<HTMLElement>('[data-bench]');
    if (!bench) return;
    stateFor(bench).sort = select.value as SortKey;
    paintBench(bench);
  });
}
