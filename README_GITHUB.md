# Z R Engineering & Construction Group — Website Source

This is the complete application source: public website, owner admin editor, client portal, API routes, database schema/migration, logo, safety documents, and assets. The source files are at the repository root.

## Technology
- Node.js 22.13+, pnpm 11
- React 19, Vinext / Next.js-style App Router, TypeScript, Vite
- Drizzle ORM with Cloudflare D1 (`DB`) and R2 (`BUCKET`)
- Cloudflare Workers / Wrangler build integration

## Local preview
1. Install Node.js 22.13 or later.
2. In this folder, run `corepack enable`.
3. Run `corepack pnpm install --frozen-lockfile`.
4. Run `corepack pnpm dev`.

## Important before deploying outside the current Sites host
GitHub stores the code; GitHub Pages cannot run this app's server-side API routes, admin editor, client portal, database, or uploads. The current app expects Cloudflare Worker bindings named `DB` and `BUCKET`. Its admin/client login also uses ChatGPT Sites authentication headers and sign-in routes. A new host needs equivalent database/file storage and a replacement login provider before the admin editor and client portal will work there.

The `lib/auth.ts` file contains the owner account allowlist. Keep this repository **Private**. Do not commit passwords, API tokens, `.env` files, or client records.

## Main areas
- Public website: `public/website.html`
- Owner admin page: `app/admin/page.tsx`, `components/editor.tsx`
- Client portal: `app/portal/page.tsx`, `components/portal-dashboard.tsx`
- API routes: `app/api/`
- Database: `db/`, `drizzle/`
- Public assets and safety manuals: `public/`, `downloads/`
