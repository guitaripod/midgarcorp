# Deployment Guide for Midgar Corp Blog

This guide covers deploying your Astro blog to Cloudflare Pages with custom domain setup, environment variables, and monitoring.

## Prerequisites

- Node.js 20+ installed locally
- Git repository (GitHub, GitLab, or Bitbucket)
- Cloudflare account (free tier works)
- Custom domain (optional)

## Local Development Setup

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd midgarcorp
npm install
```

### 2. Environment Variables

Create a `.env` file for local development:

```bash
# .env
PUBLIC_SITE_URL=http://localhost:3000
PUBLIC_GA_ID=UA-XXXXXXXXX-X  # Optional: Google Analytics
```

### 3. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:3000` to see your blog.

### 4. Build Locally

```bash
npm run build
npm run preview  # Preview production build
```

## Cloudflare Pages Setup

### 1. Connect Repository

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Go to "Pages" → "Create a project"
3. Connect to Git provider (GitHub/GitLab/Bitbucket)
4. Select your repository
5. Grant necessary permissions

### 2. Configure Build Settings

Set the following build configuration:

- **Framework preset**: Astro
- **Build command**: `npm run build`
- **Build output directory**: `dist`
- **Root directory**: `/` (leave empty if at root)
- **Environment variables**: (see below)

### 3. Environment Variables

Add these in Cloudflare Pages settings:

```bash
NODE_VERSION=20
PUBLIC_SITE_URL=https://yourdomain.com
PUBLIC_GA_ID=UA-XXXXXXXXX-X  # Optional
```

### 4. Deploy

Click "Save and Deploy". First deployment may take 5-10 minutes.

## Custom Domain Configuration

### 1. Add Custom Domain

1. In Pages project → "Custom domains"
2. Click "Set up a custom domain"
3. Enter your domain (e.g., `blog.example.com`)
4. Follow DNS configuration instructions

### 2. DNS Settings

Add these records to your DNS:

```
Type    Name    Value
CNAME   @       <project-name>.pages.dev
CNAME   www     <project-name>.pages.dev
```

Or for apex domains:

```
Type    Name    Value
A       @       192.0.2.1
AAAA    @       2001:db8::1
```

### 3. SSL/TLS

Cloudflare automatically provisions SSL certificates. Ensure SSL/TLS mode is set to "Full" or "Full (strict)".

## Build Settings for Cloudflare

### Build Configuration

```toml
# wrangler.toml (optional, for advanced config)
name = "midgarcorp"
compatibility_date = "2024-01-25"

[site]
bucket = "./dist"

[env.production]
vars = { ENVIRONMENT = "production" }

[env.preview]
vars = { ENVIRONMENT = "preview" }
```

### Optimize Build Performance

1. **Enable Build Caching**: Cloudflare Pages caches dependencies between builds
2. **Use `.gitignore`**: Exclude `node_modules/`, `dist/`, `.env`
3. **Minimize Build Steps**: Combine commands where possible

### Post-Build Commands

Add to `package.json`:

```json
{
  "scripts": {
    "build": "astro build && npm run postbuild",
    "postbuild": "npm run build:search && npm run optimize:images",
    "build:search": "pagefind --source dist",
    "optimize:images": "node scripts/optimize-images.js"
  }
}
```

## Monitoring and Analytics

### 1. Cloudflare Analytics

Built-in analytics available in Pages dashboard:
- Page views
- Unique visitors
- Top pages
- Geographic data

### 2. Web Analytics (Privacy-Focused)

Add Cloudflare Web Analytics:

```html
<!-- Add to BaseHead.astro -->
<script defer src='https://static.cloudflareinsights.com/beacon.min.js' 
        data-cf-beacon='{"token": "YOUR_TOKEN"}'></script>
```

### 3. Real User Monitoring

Monitor Core Web Vitals:

```javascript
// Add to your layout
if ('web-vitals' in window) {
  window['web-vitals'].getCLS(console.log);
  window['web-vitals'].getFID(console.log);
  window['web-vitals'].getLCP(console.log);
}
```

## Deployment Workflows

### Manual Deployment

```bash
# Build locally
npm run build

# Deploy using Wrangler CLI
npm install -g wrangler
wrangler pages deploy dist --project-name=midgarcorp
```

### Automatic Deployments

Cloudflare Pages automatically deploys:
- **Production**: On push to main branch
- **Preview**: On pull requests

### Branch Deployments

Configure branch deployments in Pages settings:
- Production branch: `main`
- Preview branches: Include `dev`, `staging`, feature branches

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Check Node version matches `NODE_VERSION` env var
   - Ensure all dependencies are in `package.json`
   - Check build logs for specific errors

2. **404 Errors**
   - Verify `_redirects` file for SPA routing
   - Check file paths are correct
   - Ensure `dist` folder contains built files

3. **Slow Builds**
   - Optimize images before commit
   - Use `.cloudflare/` cache directory
   - Minimize build-time operations

### Debug Commands

```bash
# Test build locally
npm run build

# Check for missing dependencies
npm ls

# Verify environment variables
env | grep PUBLIC_

# Test production build
npm run preview
```

## Performance Optimization

### 1. Enable Caching

Already configured in `_headers` file:
- Static assets: 1 year cache
- HTML: No cache (always fresh)
- Images: 1 day client, 1 year CDN

### 2. Enable Compression

Cloudflare automatically compresses:
- HTML, CSS, JS (Brotli/Gzip)
- Images (Polish feature)

### 3. Use Page Rules (Optional)

For advanced caching:
1. Go to Cloudflare Dashboard → Your domain
2. Page Rules → Create Page Rule
3. Add rules for specific paths

### 4. Monitor Performance

Use Cloudflare Observatory:
```bash
# Check your score
https://observatory.mozilla.org/analyze/yourdomain.com
```

## Security Best Practices

1. **Use Environment Variables**: Never commit secrets
2. **Enable DNSSEC**: In Cloudflare DNS settings
3. **Set Security Headers**: Already configured in `_headers`
4. **Enable Bot Protection**: In Cloudflare Security settings
5. **Regular Updates**: Keep dependencies updated

## Rollback Procedure

If deployment issues occur:

1. **Via Dashboard**: 
   - Pages → Your project → Deployments
   - Find previous working deployment
   - Click "Rollback to this deployment"

2. **Via Git**:
   ```bash
   git revert HEAD
   git push origin main
   ```

## Cost Considerations

Cloudflare Pages Free Tier includes:
- 500 builds per month
- Unlimited bandwidth
- Unlimited requests
- Custom domains
- SSL certificates

For most blogs, the free tier is sufficient.

## Support Resources

- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [Astro Deployment Guide](https://docs.astro.build/en/guides/deploy/cloudflare/)
- [Cloudflare Community](https://community.cloudflare.com/)
- [Project Issues](https://github.com/yourusername/midgarcorp/issues)