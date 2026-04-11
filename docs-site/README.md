# Agent Studio Documentation & Marketing Site

This folder contains the public website for Agent Studio—both marketing site and technical documentation—built with **VitePress**.

## Overview

The website is fully **responsive**, **dark-first**, and **GitHub Pages ready**. It lives separately from the extension source code to maintain independence in development, deployments, and scaling.

### What's in here

- **`docs/`**: Markdown pages organized into product (features, why, dashboard, visibility, FAQ, roadmap) and documentation (getting started, installation, quick start, core concepts, creating agents, architecture, contributing) sections
- **`docs/.vitepress/`**: VitePress configuration (nav, sidebar, theme)
- **`docs/public/`**: Static assets (SVG mark/logo)

### What's NOT in here

- Extension source code (`../src/`)
- WebView React app (`../webview/`)
- Extension build outputs (`../webview-dist/`)

These stay in the parent folder and are completely isolated from this site.

## Architecture

### Separation Strategy

```
agent-studio/
├── src/                  ← Extension code
├── webview/              ← React dashboard app
├── docs-site/            ← THIS FOLDER: Docs + marketing website
│   ├── package.json      ← Only VitePress dependency
│   ├── docs/
│   │   ├── index.md      ← Landing page
│   │   ├── features.md
│   │   ├── why-agent-studio.md
│   │   ├── ...
│   │   └── .vitepress/
│   │       ├── config.mts ← Nav structure, branding
│   │       └── theme/     ← Custom CSS design system
│   └── README.md         ← This file
└── .github/workflows/
    └── deploy-docs-site.yml ← Auto-deploy to GitHub Pages
```

### Why separate?

- **No shared dependencies**: VitePress (docs tool) has nothing to do with the extension
- **Faster CI/CD**: Docs can deploy without rebuilding the extension
- **Cleaner maintenance**: Different tools, different teams, different update cycles
- **Better scaling**: If docs grows (custom components, analytics, API), won't affect extension
- **GitHub Pages native**: VitePress builds a static site; GitHub Actions handles deploy automatically

## Local Development

### First time setup

```bash
cd docs-site
npm install
npm run docs:dev
```

Browser opens to `http://localhost:5173` (or similar) with **live reload enabled**. Edit markdown files; browser updates instantly.

### Common commands

```bash
# Start dev server
npm run docs:dev

# Build for production
npm run docs:build

# Preview production build locally
npm run docs:preview
```

### Editing Pages

Pages are in `docs/` as Markdown:

- `index.md` → Landing page at `/`
- `features.md` → `/features`
- `installation.md` → `/installation`
- etc.

Headers in markdown automatically generate table of contents and sidebar hierarchy.

**Example:**

```markdown
---
prev:
  text: Previous Page
  link: /previous-page
next:
  text: Next Page
  link: /next-page
---

# This is the page title

## Section 1

Content here...

## Section 2

More content...
```

## Design System

The site uses a **dark-first, modern SaaS aesthetic** with:

- **Colors**: Deep navy (#08101a), cyan accents (#6ce0ff), subtle gradients
- **Typography**: Clean, readable fonts with proper hierarchy
- **Components**: Cards, panels, chips, buttons, grids
- **Responsiveness**: Mobile → tablet → desktop (CSS Grid adapts automatically)

All styling lives in `docs/.vitepress/theme/custom.css` for consistency.

## Navigation Structure

### Product Section (Marketing)

- Home (landing page)
- Features (detailed capabilities)
- Why Agent Studio (problem/solution, use cases)
- Visual Dashboard (UI walkthrough)
- Tools, Skills & MCP (capability visibility)
- FAQ (common questions)
- Roadmap (future features)

### Documentation Section (Technical)

- Getting Started (first 5 minutes)
- Installation (setup guide)
- Quick Start (hands-on tutorial)
- Core Concepts (agents, workflows, tools, skills, MCP)
- Creating Agents (best practices, examples)
- Architecture (how Agent Studio works internally)
- Contributing (development guide, PR process)

This structure is defined in `docs/.vitepress/config.mts` under `nav` and `sidebar`.

## GitHub Pages Deployment

The site deploys automatically to GitHub Pages when you push to `main`.

### How it works

1. Push code to `main` branch (affects `docs-site/` folder)
2. GitHub Actions workflow (`.github/workflows/deploy-docs-site.yml`) triggers
3. Builds the site: `npm run docs:build`
4. Uploads to GitHub Pages
5. Live at `github.com/<owner>/<repo>/docs-site` (or custom domain)

### Manual base URL configuration

VitePress automatically computes the base URL for GitHub Pages. If you need to override:

```bash
# Local dev (no prefix)
DOCS_BASE=/ npm run docs:dev

# Manual prefix
DOCS_BASE=/custom-path/ npm run docs:build
```

The config reads `GITHUB_REPOSITORY` and `DOCS_BASE` env vars and sets the correct base path.

## Configuration Files

### `package.json`

```json
{
  "name": "agent-studio-docs-site",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "docs:dev": "vitepress dev .",
    "docs:build": "vitepress build .",
    "docs:preview": "vitepress preview ."
  },
  "dependencies": {
    "vitepress": "^1.6.3"
  }
}
```

Only VitePress. No plugin dependencies. Intentionally minimal.

### `docs/.vitepress/config.mts`

TypeScript configuration for VitePress:

- **Site metadata**: title, description, language
- **Navigation structure**: Product and Docs sections
- **Sidebar structure**: Hierarchical page list
- **Theme config**: Logo, search, footer, social links
- **Base URL logic**: GitHub Pages compatible URL computation

### `docs/.vitepress/theme/custom.css`

~400 lines of custom design CSS:

- CSS variables for colors, spacing, typography
- Component classes (`.as-card`, `.as-panel`, `.as-mock`, etc.)
- Responsive breakpoints (mobile, tablet, desktop)
- Hover states, animations, gradients

## Adding New Pages

1. Create a `.md` file in `docs/` folder
2. Add to `docs/.vitepress/config.mts` in `nav` and/or `sidebar`
3. Restart dev server (or let hot reload handle it)

**Example:** To add `/blog/my-post`:

```markdown
# File: docs/blog/my-post.md

---

prev:
text: Previous Page
link: /
next:
text: Next Page
link: /

---

# My Blog Post Title

Content here...
```

Then update config:

```typescript
{
  text: 'Blog',
  items: [
    { text: 'My Post', link: '/blog/my-post' }
  ]
}
```

## Environment Variables

- `GITHUB_REPOSITORY`: Set in GitHub Actions; used to compute base URL (e.g., `owner/repo-name`)
- `GITHUB_ACTIONS`: Set to `true` in GitHub Actions; signals we're building on CI
- `DOCS_BASE`: Optional override for base URL (e.g., `/custom-docs-path/`)

**Local development:** These are ignored. Base URL defaults to `/`.

## Troubleshooting

**Q: Dev server won't start**

- Ensure Node 16+: `node --version`
- Delete `node_modules` and reinstall: `rm -rf node_modules && npm install`

**Q: Changes not showing in browser**

- Save the file (Cmd/Ctrl+S)
- Check that you edited a `.md` file (not a config file)
- Restart dev server if needed

**Q: Build fails with "cannot find module"**

- Run `npm install` to ensure all deps are present
- Check that `vitepress` is in package.json

**Q: Site looks strange on GitHub Pages**

- Check that the base URL is correct in the built output
- Verify folder structure matches config
- Clear browser cache (Cmd/Ctrl+Shift+Delete)

## Contributing

See [Contributing Guide](../CONTRIBUTING.md) for how to help improve docs.

Docs improvements are especially welcome:

- Typo fixes
- Clarifications
- New examples
- Better diagrams

---

**Built with VitePress. Deployed to GitHub Pages. Loved by developers.**

## Preview the production build

```bash
cd docs-site
npm run docs:preview
```

## GitHub Pages deployment

A GitHub Actions workflow is included at `.github/workflows/deploy-docs-site.yml`.

By default, the VitePress `base` is derived from the GitHub repository name during CI and `/` in local development.

- If you deploy to `https://<user>.github.io/<repo>/`, the workflow should work as-is.
- If you use a custom domain, set the base explicitly in `docs/.vitepress/config.mts` or pass `DOCS_BASE=/` in the workflow.
