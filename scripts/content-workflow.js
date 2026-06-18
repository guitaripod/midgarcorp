export const meta = {
  name: 'landing-content',
  description: 'Author + adversarially review SEO marketing content for each Midgar app landing page',
  phases: [
    { title: 'Author', detail: 'one agent per app, grounded in repo + store listing' },
    { title: 'Review', detail: 'adversarial SEO/accuracy/voice pass, returns final content' },
  ],
}

const FACTS = args.factsPath
const APPS = args.apps

const VOICE = `
BRAND VOICE (Midgar / guitaripod — a solo indie engineer who ships polished Apple apps):
- Calm, precise, confident. Concrete over hype. Second person ("you") where natural.
- Lead with the user's problem and the outcome, not the technology. Technology is proof, not the pitch.
- NO AI-slop words: "unleash", "seamless", "elevate", "revolutionary", "game-changer", "in today's world",
  "harness the power", "dive in", "supercharge", "effortlessly", "cutting-edge", "robust", "delve".
- NO empty superlatives ("the best", "#1", "world-class"). Apple rejects unverifiable superlatives in copy.
- Be honest and specific: real numbers, real features, real privacy posture. Never invent capabilities.
- Sentences short. Active voice. No exclamation-mark spam. It should read like a thoughtful maker wrote it.
`

const RULES = `
SEO + CORRECTNESS RULES:
- seoTitle <= 60 chars, contains the app's primary keyword + a benefit. Format like "AppName — Primary Benefit".
- metaDescription 140-160 chars, compelling, contains 1-2 target keywords naturally, ends with a soft CTA.
- keywords: 6-12 lowercase search phrases people actually type (long-tail included). No brand-stuffing.
- features: 4-6 items. title = 2-4 words. body = 1-2 sentences of concrete benefit. glyph = ONE unicode
  symbol fitting a terminal aesthetic (e.g. ◊ ◈ ✦ ▰ ⬡ ◉ ✶ ⌗ ⎈ ❖ ▲ ⊹). Distinct glyph per feature.
- howItWorks: EXACTLY 3 steps. step = 1-2 words (imperative). body = 1 sentence.
- faq: 5-8 real questions a buyer/searcher asks (price/subscription, privacy/data, offline, platforms,
  how it works, refunds/trial). Answers honest + specific, 1-3 sentences. These power FAQ rich snippets.
- screenshotCaptions: for EACH device key present in the app's screenshots, return an array of short
  human captions (3-7 words) in the SAME ORDER as the screenshots array. Describe what the screen shows.
- pricingNote: ONE honest sentence describing the pricing model (free / one-time / subscription / credits).
- accentColor: a hex color that suits the app's brand (you may keep the provided primaryColor).
- Ground EVERY claim in the app's real description + repo. If unsure a feature exists, omit it.
- For apps with status "review": write as a live product (present tense). Do not say "coming soon" in copy.
`

const CONTENT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['seoTitle', 'metaDescription', 'keywords', 'heroHeadline', 'heroSubhead', 'accentColor',
    'highlights', 'features', 'howItWorks', 'faq', 'screenshotCaptions', 'ctaLine', 'pricingNote'],
  properties: {
    seoTitle: { type: 'string' },
    metaDescription: { type: 'string' },
    keywords: { type: 'array', items: { type: 'string' }, minItems: 6, maxItems: 12 },
    heroHeadline: { type: 'string' },
    heroSubhead: { type: 'string' },
    accentColor: { type: 'string' },
    highlights: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 4 },
    features: {
      type: 'array', minItems: 4, maxItems: 6,
      items: {
        type: 'object', additionalProperties: false, required: ['title', 'body', 'glyph'],
        properties: { title: { type: 'string' }, body: { type: 'string' }, glyph: { type: 'string' } },
      },
    },
    howItWorks: {
      type: 'array', minItems: 3, maxItems: 3,
      items: {
        type: 'object', additionalProperties: false, required: ['step', 'body'],
        properties: { step: { type: 'string' }, body: { type: 'string' } },
      },
    },
    faq: {
      type: 'array', minItems: 5, maxItems: 8,
      items: {
        type: 'object', additionalProperties: false, required: ['q', 'a'],
        properties: { q: { type: 'string' }, a: { type: 'string' } },
      },
    },
    screenshotCaptions: { type: 'object', additionalProperties: { type: 'array', items: { type: 'string' } } },
    ctaLine: { type: 'string' },
    pricingNote: { type: 'string' },
  },
}

function authorPrompt(app) {
  return `You are writing the marketing landing page copy for ONE Apple App Store app: "${app.slug}".

Working directory is /Users/marcus/Dev. Do this grounding work FIRST:
1. Read ${FACTS} and find the object whose slug == "${app.slug}". Study its full App Store
   "description", category, price, status, platforms, rating, keywords, and the "screenshots" object
   (note each device key and the per-screenshot "label" order — your screenshotCaptions must match that order).
2. Explore the app's source repo at: ${app.repo}
   Read README / DESIGN / docs and skim key source to learn REAL features, the pricing/credit model,
   privacy/offline posture, and what makes it good. Do not invent anything not supported here.
${app.blog ? `3. Read the existing article for extra context (do not copy it): ${app.blog}` : ''}

${VOICE}
${RULES}

${app.pricing ? `\nAUTHORITATIVE PRICING (verified from the live App Store — this OVERRIDES any conflicting\nwording in the store description or repo):\n${app.pricing}\nEvery pricing mention (pricingNote, highlights, FAQ, hero) MUST be consistent with this.\n` : ''}
Now produce the structured landing-page content for "${app.slug}". Make it genuinely excellent and
specific to THIS app — distinct from every other app. Return ONLY the structured object.`
}

function reviewPrompt(app, draft) {
  return `You are a ruthless senior SEO editor + Apple App Store copy reviewer. Improve the landing-page
content for the app "${app.slug}". Here is the draft:

${JSON.stringify(draft, null, 2)}

Verify against the source of truth: read ${FACTS} (object slug=="${app.slug}") and, if any claim looks
unsupported, check the repo at ${app.repo}. Then FIX every problem and return the corrected content object.

${app.pricing ? `AUTHORITATIVE PRICING (verified from the live App Store — OVERRIDES the store description/repo):\n${app.pricing}\nReject and rewrite ANY pricing wording (pricingNote, highlights, FAQ, hero) that conflicts with this.\n` : ''}
Hard checks:
- Accuracy: remove/repair any feature, number, or privacy/pricing claim not supported by the description/repo.
- SEO: seoTitle <=60 chars with primary keyword + benefit; metaDescription 140-160 chars, keyword-rich, soft CTA;
  keywords are real long-tail search phrases (no brand stuffing).
- Voice: kill every AI-slop word and empty superlative (${'see the banned list'}); short, concrete, active.
- App Store policy: no unverifiable superlatives, no competitor disparagement, pricing claims must match reality.
- screenshotCaptions keys + array lengths must match the app's screenshots object exactly, same order.
- faq questions are ones people actually search; answers honest and specific.
Return ONLY the final corrected structured object (same schema). Do not add commentary.`
}

const results = await pipeline(
  APPS,
  (app) => agent(authorPrompt(app), {
    label: `author:${app.slug}`, phase: 'Author', schema: CONTENT_SCHEMA, effort: 'high',
  }).then((content) => ({ app, content })),
  ({ app, content }) => {
    if (!content) return null
    return agent(reviewPrompt(app, content), {
      label: `review:${app.slug}`, phase: 'Review', schema: CONTENT_SCHEMA, effort: 'high',
    }).then((final) => ({ slug: app.slug, content: final || content }))
  },
)

return results.filter(Boolean)
