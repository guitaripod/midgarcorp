/// A standalone product page: software with its own page here that is not an App Store app.
export interface ProductPage {
  slug: string;
  name: string;
  seoTitle: string;
  metaDescription: string;
}

/// The title and description each product page renders, kept here so /llms.txt describes
/// the page in the page's own words.
export const PRODUCT_PAGES: ProductPage[] = [
  {
    slug: 'unrager',
    name: 'unrager',
    seoTitle: 'unrager — keep x.com, lose the rage',
    metaDescription:
      'A browser extension that takes the rage-bait out of your x.com timeline, judged by a model on your own computer. Free, open source, and nothing leaves your machine.',
  },
  {
    slug: 'blackwall',
    name: 'Blackwall',
    seoTitle: 'Blackwall: open models, ranked on one RTX PRO 6000',
    metaDescription:
      'Ranks open models on one RTX PRO 6000 Blackwell: speed and answer quality measured the same way each time, with 95% intervals on a live leaderboard.',
  },
  {
    slug: 'recview',
    name: 'recview',
    seoTitle: 'recview — review a screen recording the second it ends',
    metaDescription:
      'A GTK4 review window that opens when a capture stops: scrub on the GPU, trim, crop, export upload-ready H.264 or bin it. Built for gpu-screen-recorder.',
  },
  {
    slug: 'imago',
    name: 'imago',
    seoTitle: 'imago — archive Instagram profiles completely',
    metaDescription:
      'Agent-native CLI that archives every photo, video, and carousel slide from an Instagram profile. Drop a URL, walk away, watch for more weekly without duplicates.',
  },
  {
    slug: 'yoink',
    name: 'Yoink',
    seoTitle: 'Yoink — grab thumbnails and videos from YouTube',
    metaDescription:
      'A Chromium extension that adds a toolbar to every YouTube thumbnail: save the full-res thumbnail, or download the video in up to 4K, ready to post to X.',
  },
];

export function productPage(slug: string): ProductPage {
  const page = PRODUCT_PAGES.find((p) => p.slug === slug);
  if (!page) throw new Error(`No product page for ${slug}`);
  return page;
}
