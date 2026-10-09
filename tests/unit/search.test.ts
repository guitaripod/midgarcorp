import { describe, it, expect } from 'vitest';
import {
  searchKind,
  searchTitle,
  safeExcerpt,
  moveSelection,
  isSearchKind,
} from '../../src/utils/search';

const apps = ['solarbeam', 'crucible'];

describe('searchKind', () => {
  it('buckets blog posts, tools, apps and everything else', () => {
    expect(searchKind('/blog/building-clis-in-go/', apps)).toBe('post');
    expect(searchKind('/imago', apps)).toBe('tool');
    expect(searchKind('/linux/', apps)).toBe('tool');
    expect(searchKind('/solarbeam/', apps)).toBe('app');
    expect(searchKind('/crucible', apps)).toBe('app');
    expect(searchKind('/links', apps)).toBe('page');
    expect(searchKind('/', apps)).toBe('page');
  });

  it('does not match a slug that merely shares a prefix', () => {
    expect(searchKind('/solarbeams', apps)).toBe('page');
  });
});

describe('searchTitle', () => {
  it('strips the site suffix and the SEO tagline', () => {
    expect(searchTitle('Linux Apps & Tools | guitaripod')).toBe('Linux Apps & Tools');
    expect(searchTitle('Solar Beam — James Webb Telescope Gallery')).toBe('Solar Beam');
    expect(searchTitle('imago — archive Instagram profiles completely')).toBe('imago');
  });

  it('keeps hyphenated names and plain titles intact', () => {
    expect(searchTitle('Building CLIs in Go')).toBe('Building CLIs in Go');
    expect(searchTitle('Sign-in with Apple')).toBe('Sign-in with Apple');
  });
});

describe('safeExcerpt', () => {
  it('keeps mark tags and escapes everything else', () => {
    expect(safeExcerpt('a <mark>b</mark> <script>x</script> &')).toBe(
      'a <mark>b</mark> &lt;script&gt;x&lt;/script&gt; &amp;'
    );
  });
});

describe('moveSelection', () => {
  it('wraps in both directions and handles the empty list', () => {
    expect(moveSelection(-1, 1, 3)).toBe(0);
    expect(moveSelection(-1, -1, 3)).toBe(2);
    expect(moveSelection(2, 1, 3)).toBe(0);
    expect(moveSelection(0, -1, 3)).toBe(2);
    expect(moveSelection(0, 1, 0)).toBe(-1);
  });
});

describe('isSearchKind', () => {
  it('accepts only known kinds', () => {
    expect(isSearchKind('app')).toBe(true);
    expect(isSearchKind('nope')).toBe(false);
    expect(isSearchKind(undefined)).toBe(false);
  });
});
