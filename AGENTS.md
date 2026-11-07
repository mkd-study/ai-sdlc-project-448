# Repository Guidelines

## Project Structure & Module Organization

This browser-only access-policy simulator uses React, TypeScript, Mantine, and Vite.

- `src/domain/`: data types and pure access calculations.
- `src/app/`: application state, `useSimulator`, permission operations, localStorage, JSON import/export, and seed data.
- `src/components/`: React screens and controls.
- `src/main.tsx`: entry point and Mantine styles; no dedicated asset directory exists.
- Tests sit beside implementation files; `src/test-setup.ts` configures their environment.
- `docs/`: architecture and security requirements.
- `rules/`: ast-grep architecture rules; currently only a placeholder.
- `.github/workflows/`: CI, Hexlet checks, and GitHub Pages deployment.

## Build, Test, and Development Commands

Use Node.js 26 to match CI.

- `make setup`: install locked dependencies with `npm ci` and build.
- `npm run dev`: start Vite at `http://localhost:8080`.
- `npm run build`: type-check and generate `dist/`.
- `npm run preview`: serve the built application on port 8080.
- `npm test`: run all Vitest tests once.
- `npm run lint`: check code with Oxlint and formatting with Oxfmt.
- `npm run lint:fix`: apply formatting and automatic lint fixes.
- `make lint-arch`: scan `src/` using ast-grep rules.

## Coding Style & Architecture

Follow existing TypeScript style: two-space indentation, double quotes, semicolons, and explicit type imports. Use PascalCase for components and types, camelCase for functions and variables, and lowercase hyphenated module filenames where appropriate.

Before changing application code, read `docs/architecture.md`. Preserve `components → app → domain`: components import shared types and operations through `src/app/index.ts`. Keep access calculations centralized and pass calculation time explicitly.

## Testing Guidelines

Use Vitest with jsdom and React Testing Library. Name tests `*.test.ts` or `*.test.tsx`. Run a focused suite with `npm test -- src/domain/access.test.ts`. Cover changed behavior, including invalid imports and independent permission sources. No coverage percentage threshold is configured.

## Commit & Pull Request Guidelines

History uses short English subjects such as `Add starter files`; no Conventional Commits scheme is established. Write concise, action-oriented subjects. PRs should explain the behavior change, link relevant issues, report verification commands, and include screenshots for visible UI changes. Before submission, run build, tests, lint, and architecture checks. Preserve `.github/workflows/hexlet-check.yml` unchanged.

## Security Requirements

Before changing data handling or permissions, read `docs/security-requirements.md`. Keep configuration in the browser, validate imports completely before applying them, and preserve unrelated permissions and independent access sources.
