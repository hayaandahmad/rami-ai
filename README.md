# rami-ai

Rami is a multi-document guided AI assistant that helps MODEE Business Analysts create professional documents through structured interviews, human review, and document generation.

## Stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — redirects to `/workspace`.

## Demo scope

Frontend-only management demo with three pages:

1. Document Workspace
2. Guided Document Interview
3. Review and Generate

Mock data only. No backend, authentication, AI, database, or APIs.

## Project structure

```text
src/
├── app/                  # Next.js App Router routes
├── layouts/              # AppShell and shared layout
├── views/                # Page components (imported by routes)
├── components/           # Reusable UI components
├── data/                 # Mock data and constants
├── types/                # TypeScript types
├── hooks/                # Custom hooks
├── utils/                # Utilities
└── styles/               # Global styles and design tokens
```
