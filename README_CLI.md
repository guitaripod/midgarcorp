# Midgar Corp CLI (ct)

A Go-based CLI tool for managing build tasks for the Midgar Corp website.

## Installation

```bash
make build
```

This will create a `ct` binary in the project root.

## Commands

- `ct fetch-appstore` - Fetch latest App Store data for all apps
- `ct fetch-github` - Fetch latest GitHub repository data
- `ct prebuild` - Run all pre-build tasks (App Store, GitHub, OG image generation)
- `ct postbuild` - Run post-build optimizations (Pagefind search index)
- `ct help` - Show help message

## Usage in Build Process

The CLI is integrated into the npm build scripts:

```bash
npm run build  # Uses ./ct prebuild && astro build && ./ct postbuild
```

## Development

The CLI is structured as follows:

```
cmd/ct/main.go           # Main entry point
internal/
  appstore/fetch.go      # App Store data fetching
  github/fetch.go        # GitHub data fetching
  build/
    prebuild.go          # Pre-build orchestration
    postbuild.go         # Post-build tasks
```

## CI/CD

The GitHub Actions workflow automatically builds the ct binary before running the build process.

## Notes

- The Go implementation is more performant than the Node.js scripts
- Error handling is improved - individual fetch failures don't break the build
- The CLI can be extended with additional commands as needed