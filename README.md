# Midgar Corp - A Fast, Minimal Blog Built with Astro

A modern, performant blog built with Astro and optimized for Cloudflare Pages deployment. Features include bionic reading, dark mode, full-text search, and advanced syntax highlighting.

## Features

### Reading Experience
- **Bionic Reading**: Toggle-able feature that bolds the first 40% of each word
- **Reading Progress**: Visual indicator showing scroll progress
- **Reading Time**: Automatic calculation based on content length
- **Table of Contents**: Auto-generated from headings with scroll tracking
- **Font Size Controls**: Adjustable text size (S/M/L) with localStorage persistence
- **Dark/Light Mode**: System preference detection with manual toggle

### Content Features
- **MDX Support**: Write content in Markdown with embedded components
- **Syntax Highlighting**: 100+ languages supported via Shiki
- **Code Block Features**:
  - Copy button with feedback
  - Line highlighting
  - Filename display
  - Language indicators
- **Mermaid Diagrams**: Render diagrams from markdown
- **Image Optimization**: Automatic WebP conversion and lazy loading

### Navigation & Organization
- **Full-Text Search**: Powered by Pagefind
- **Tag System**: Categorize posts with multiple tags
- **Related Posts**: Automatically suggest similar content
- **Archive Page**: Chronological listing grouped by year
- **RSS Feed**: Full content feed for readers

### Performance
- **Zero JS by Default**: JavaScript only loaded when needed
- **Static Generation**: Pre-built pages for instant loading
- **Asset Optimization**: Compressed images and minified code
- **Smart Prefetching**: Preload pages on hover
- **Lighthouse Score**: 95+ on all metrics

## Quick Start

### Prerequisites
- Node.js 20+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/guitaripod/midgarcorp.git
cd midgarcorp

# Install dependencies
npm install

# Start development server
npm run dev
```

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm test            # Run unit tests
npm run test:ui     # Run tests with UI
```

## Project Structure

```
midgarcorp/
├── src/
│   ├── components/      # Astro components
│   ├── layouts/         # Page layouts
│   ├── pages/           # Route pages
│   ├── content/         # Blog posts (MDX)
│   ├── styles/          # Global styles
│   └── utils/           # Utility functions
├── public/              # Static assets
├── tests/               # Test files
└── scripts/             # Build scripts
```

## Writing Posts

Create a new `.mdx` file in `src/content/blog/`:

```mdx
---
title: 'Your Post Title'
description: 'A brief description'
pubDate: 2024-01-30
tags: ['tag1', 'tag2']
---

Your content here...

## Code Examples

```javascript
console.log('Hello, world!');
```
```

### Frontmatter Options

- `title` (required): Post title
- `description` (required): Brief description for SEO
- `pubDate` (required): Publication date
- `updatedDate` (optional): Last update date
- `tags` (optional): Array of tags
- `image` (optional): Cover image URL
- `draft` (optional): Set to `true` to hide from production
- `series` (optional): Group related posts

## Configuration

### Site Configuration

Edit `src/consts.ts`:

```typescript
export const SITE_TITLE = 'Your Blog Name';
export const SITE_DESCRIPTION = 'Your blog description';
```

### Astro Configuration

Modify `astro.config.mjs` for:
- Site URL
- Integrations
- Markdown processing
- Build options

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

### Quick Deploy to Cloudflare Pages

1. Fork this repository
2. Create a Cloudflare Pages project
3. Connect your GitHub repository
4. Use these build settings:
   - Build command: `npm run build`
   - Build output: `dist`
   - Environment variables: `NODE_VERSION=20`

## Customization

### Styling

- Edit `src/styles/global.css` for global styles
- Modify `tailwind.config.mjs` for theme customization
- Component styles use Tailwind classes

### Components

Key components to customize:
- `Header.astro`: Navigation and site title
- `Footer.astro`: Footer content
- `BaseHead.astro`: SEO and meta tags

### Features Toggle

Enable/disable features in components:
- Bionic Reading: Remove `<BionicToggle />` from `BlogPost.astro`
- Search: Remove `<Search />` from `Header.astro`
- Dark Mode: Remove `<ThemeToggle />` from `Header.astro`

## Performance

### Build Optimization

The blog includes several optimization scripts:
- Image optimization
- HTML minification
- Asset compression
- Bundle size checking

### Monitoring

- Use Cloudflare Analytics for traffic data
- Monitor Core Web Vitals
- Check Lighthouse scores regularly

## Testing

### Unit Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Test Coverage

- Bionic reading transformation
- Reading time calculation
- Table of contents generation
- Related posts algorithm

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is open source and available under the [MIT License](LICENSE).

## Acknowledgments

- Built with [Astro](https://astro.build)
- Deployed on [Cloudflare Pages](https://pages.cloudflare.com)
- Search powered by [Pagefind](https://pagefind.app)
- Syntax highlighting by [Shiki](https://shiki.matsu.io)

## Support

- [Documentation](./DEPLOYMENT.md)
- [Issue Tracker](https://github.com/guitaripod/midgarcorp/issues)
- [Discussions](https://github.com/guitaripod/midgarcorp/discussions)
