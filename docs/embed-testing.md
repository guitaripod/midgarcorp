# Testing Open Graph Embeds

## Current Setup
- Default OG image: `/og-image.svg` (1200x630 terminal-themed design)
- Fallback HTML preview: `/og-preview.html` (can be screenshot for PNG)
- Enhanced meta tags with dimensions and alt text

## How to Test

### 1. Force Cache Refresh
Add `?v=2` or `?refresh=true` to your URL when testing:
```
https://yoursite.com?v=2
```

### 2. Platform Debuggers
- **Facebook**: https://developers.facebook.com/tools/debug/
  - Enter URL and click "Scrape Again"
  
- **LinkedIn**: https://www.linkedin.com/post-inspector/
  - Enter URL and click "Inspect"
  
- **Twitter**: https://cards-dev.twitter.com/validator
  - Enter URL to preview

### 3. Multi-Platform Preview
- **Metatags.io**: https://metatags.io/
  - Shows all platforms at once
  - Real-time preview

## SVG Support Issues

Some platforms may not support SVG for Open Graph images. If you encounter issues:

### Option 1: Generate PNG from SVG
```bash
# Using ImageMagick
convert public/og-image.svg public/og-image.png

# Using rsvg-convert
rsvg-convert -w 1200 -h 630 public/og-image.svg > public/og-image.png
```

### Option 2: Screenshot the HTML Preview
1. Open `/og-preview.html` in browser
2. Set viewport to 1200x630
3. Take screenshot
4. Save as `/public/og-image.png`

### Option 3: Use Vercel OG Image Generation
Consider using Vercel's @vercel/og for dynamic image generation.

## After Creating PNG
Update `src/components/BaseHead.astro`:
```astro
image = '/og-image.png',  // Change from .svg to .png
```

## Testing Locally
```bash
npm run build
npm run preview
# Then test with debuggers using your preview URL
```