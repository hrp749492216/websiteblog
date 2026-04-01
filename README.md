# hariramanpokhrel.com.np

Personal blog built with [Astro](https://astro.build/) — a static-first site with a serverless comment system.

## Architecture

- **Static pages** (SSG): Blog posts, tags, about, home — generated at build time via Astro
- **Serverless API**: `/api/comments` — Vercel serverless function for reading/writing comments
- **Database**: Vercel Postgres (Neon) for comment storage and rate limiting
- **Hosting**: Vercel

## Local Development

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env
# Edit .env with your Postgres connection string

# 3. Start dev server
npm run dev
```

The site runs at `http://localhost:4321`. Comments are disabled in dev mode unless `POSTGRES_URL` is set.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `blogpost_POSTGRES_URL` | Yes (prod) | Neon/Vercel Postgres connection string |
| `POSTGRES_URL` | Fallback | Alternative connection string |

## Commands

| Command | Action |
|---------|--------|
| `npm run dev` | Start dev server at localhost:4321 |
| `npm run build` | Build production site to `./dist/` |
| `npm run preview` | Preview production build locally |
| `npm run check` | Run Astro type checking |
| `npm run lint` | Lint source files with Biome |
| `npm run format` | Format source files with Biome |
| `npm test` | Run tests with Vitest |
| `npm run test:watch` | Run tests in watch mode |

## Project Structure

```
src/
  components/    # Reusable Astro components
  content/blog/  # Markdown/MDX blog posts
  layouts/       # Page layouts (Base, BlogPost, Page)
  lib/           # Database access layer
  pages/         # File-based routing
    api/         # Serverless API endpoints
    blog/        # Blog listing + individual posts
    tags/        # Tag listing + filtered views
  styles/        # Global CSS with design tokens
  utils/         # Helper functions
```

## Adding a Blog Post

Create a new `.md` or `.mdx` file in `src/content/blog/`:

```markdown
---
title: "My Post Title"
description: "A short description"
pubDate: 2026-03-31
tags: ["topic"]
featured: false
draft: false
---

Your content here.
```

## Deployment

Push to `main` — Vercel auto-deploys. Ensure the Postgres database is connected in the Vercel project settings.
