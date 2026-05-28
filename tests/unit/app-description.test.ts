import { describe, it, expect } from 'vitest';
import { cleanAppStoreDescription } from '../../src/utils/app-description';

describe('cleanAppStoreDescription', () => {
  it('strips a marketing headline before the first paragraph break', () => {
    const input =
      'Discover What Comes After Death Across World Cultures\n\nEver wondered what different religions believe happens after we die. App of the Dead transforms complex theological concepts into an engaging learning adventure.';
    expect(cleanAppStoreDescription(input)).toBe(
      'Ever wondered what different religions believe happens after we die. App of the Dead transforms complex theological concepts into an engaging learning adventure.'
    );
  });

  it('strips a colon-style branded headline', () => {
    const input =
      'Solar Beam: Your Window to the Universe\n\nEmbark on an interstellar journey with Solar Beam, the ultimate space exploration app.';
    expect(cleanAppStoreDescription(input)).toBe(
      'Embark on an interstellar journey with Solar Beam, the ultimate space exploration app.'
    );
  });

  it('drops bullet rows and ALL-CAPS section headers', () => {
    const input =
      'Pixie brings professional-grade image generation to your mobile device.\n\nKEY FEATURES\n• Real-time previews\n• Cloud sync across devices.';
    expect(cleanAppStoreDescription(input)).toBe(
      'Pixie brings professional-grade image generation to your mobile device.'
    );
  });

  it('joins multiple prose paragraphs with a space', () => {
    const input =
      'First sentence ends here. Continues with detail.\n\nSecond paragraph adds more context and finishes cleanly.';
    expect(cleanAppStoreDescription(input)).toBe(
      'First sentence ends here. Continues with detail. Second paragraph adds more context and finishes cleanly.'
    );
  });

  it('returns a single-line description unchanged', () => {
    const input = "Master the World's Flags. Think you know your flags.";
    expect(cleanAppStoreDescription(input)).toBe(input);
  });

  it('falls back to the original segments when everything looks like a headline', () => {
    const input = 'Short Title One\n\nShort Title Two';
    expect(cleanAppStoreDescription(input)).toBe('Short Title One Short Title Two');
  });

  it('handles empty input', () => {
    expect(cleanAppStoreDescription('')).toBe('');
  });
});
