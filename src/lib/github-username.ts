/**
 * True for a string GitHub accepts as a username: 1 to 39 letters, digits or single hyphens, not starting or ending
 * with a hyphen. Anything else is refused before it can reshape the api.github.com path that carries the server token.
 */
export function isGitHubUsername(value: string): boolean {
  return /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/.test(value);
}
