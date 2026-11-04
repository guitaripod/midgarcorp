import { describe, it, expect } from 'vitest';
import { isGitHubUsername } from '../../src/lib/github-username';

describe('github username check', () => {
  it('accepts real GitHub usernames', () => {
    for (const name of ['guitaripod', 'a', 'octo-cat', 'A1b2', 'x'.repeat(39)]) {
      expect(isGitHubUsername(name)).toBe(true);
    }
  });

  it('refuses anything that could reshape the api.github.com path', () => {
    for (const name of ['', '../../user', '..%2F..%2Fuser', 'a/b', 'a?b', 'a#b', '-lead', 'trail-', 'dou--ble', 'x'.repeat(40), 'sp ace']) {
      expect(isGitHubUsername(name)).toBe(false);
    }
  });
});
