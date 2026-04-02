# Repository Guidelines

## Project Structure & Module Organization
This repository ships a static GitHub Pages dashboard for Research Council of Norway funding statistics. Core app code lives in `src/`, generated static assets in `public/data/`, map geometry in `public/geo/`, and the aggregation pipeline in `data/`. CI and deployment workflows live in `.github/workflows/`.

## Build, Test, and Development Commands
Run everything from the repository root:

```sh
npm install
npm run data:build
npm run data:build:mock
npm run dev
npm run build
```

For Python work, prefer `uv` and keep the environment inside this repository:

```sh
uv venv .venv
source .venv/bin/activate
```

`data/aggregate_funding.py` is stdlib-only today, so no extra Python packages are required.

## Local Environment Policy
Install tools and Python dependencies locally in this folder whenever possible. Prefer a project-local virtual environment at `.venv/` managed by `uv`. Do not install Python packages globally with `pip`, and do not create ad hoc environments outside the repository unless the user explicitly asks for a shared `micromamba` environment under the home directory. Minimize writes outside the repo; if a command would use a global cache or system path, prefer a repo-local alternative.

## Deployment Constraint
The dashboard must remain deployable as a static GitHub Pages site. Keep Vite’s production base path aligned with the GitHub repo name `NFR-funding-dashboard`, and avoid any design that requires a backend or server-side runtime. GitHub Actions is the canonical deployment path.

## Coding Style & Naming Conventions
Use ASCII by default. Follow the existing React + plain CSS style already present in `src/`. Keep data-contract field names stable across `data/aggregate_funding.py` and the frontend helpers in `src/lib/dashboard.js`; most regressions in this repo come from mismatches between generated JSON and UI expectations.

## Testing Guidelines
Validate changes with `npm run data:build` and `npm run build`. If you touch deployment, inspect `.github/workflows/ci.yml` and `.github/workflows/deploy.yml` together. If you change aggregation logic, verify totals in `summary.json`, `funding_by_county.json`, and the filtered UI still agree.

## Commit & Pull Request Guidelines
Recent history uses short imperative subjects. Keep commits focused, for example `Fix county ID mapping for live data` or `Add GitHub Pages CI workflow`. Pull requests should include:

- a brief summary of the change
- the data source or contract affected
- screenshots for UI changes
- the commands run locally (`npm run data:build`, `npm run build`)

## Data Notes
Preserve the caveats already documented in [inital-research.md](/Users/filippo/Projects/Github/NFR-funding-stats/inital-research.md): institution counts reflect the project owner, thematic categories may overlap, and the dashboard currently uses project start year rather than annual disbursement.
