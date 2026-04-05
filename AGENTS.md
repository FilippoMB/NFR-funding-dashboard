# Repository Guidelines

## Project Structure & Deployment
This repository ships a static GitHub Pages dashboard for Research Council of Norway funding statistics. Core app code lives in `src/`, generated JSON bundles in `public/data/`, Norway county geometry in `public/geo/`, and the aggregation pipeline in `data/`. CI and Pages deployment live in `.github/workflows/`.

The local folder is `NFR-funding-stats`, but the deployed GitHub repo/base path is `NFR-funding-dashboard`. Keep Vite's production base path aligned with the repo name in `vite.config.js`; do not introduce any backend or server-side runtime.

## Build, Test, and Development Commands
Run everything from the repository root:

```sh
npm install
npm run data:build
npm run impact:build
npm run efficiency:build
npm run dev
npm run build
```

For Python work, prefer `uv` and keep the environment inside this repository:

```sh
uv venv .venv
source .venv/bin/activate
```

All three Python data scripts are stdlib-only today.

## Local Environment Policy
Install tools and Python dependencies locally in this folder whenever possible. Prefer a project-local virtual environment at `.venv/` managed by `uv`. Do not install Python packages globally with `pip`, and do not create ad hoc environments outside the repository unless the user explicitly asks for a shared `micromamba` environment under the home directory. Minimize writes outside the repo; if a command would use a global cache or system path, prefer a repo-local alternative.

## Data Retrieval & Dataset Construction
`data/aggregate_funding.py` is the canonical funding pipeline. With no `--input`, it downloads the official Forskningsradet `soknader2` CSV from the `Forskningsradet/open-data` GitHub dataset URL. It also accepts local CSV or JSON input for debugging. Records are kept only when they have a positive grant amount, a resolvable year, a resolvable county, and a project ID. County resolution prefers municipality code, then county code, then county name, with legacy county mappings folded into current counties. Year resolution prefers `prosjektstart`, then `soknadsdato`, then `sokstart`. Institution names come from `kortnavn` with fallback to `prosjektansvarlig_navn`, so institution counts represent the registered project owner. The script writes `summary.json`, county totals, timeseries, top-dimension aggregates, `funding_cube.json`, and `funding_institution_cube.json` to `public/data/`.

`data/aggregate_impact.py` builds the impact dataset directly from the OpenAlex institutions API for `country_code:NO`. It paginates with cursors, requests `counts_by_year`, `summary_stats`, IDs, and geography, and honors `OPENALEX_API_KEY` and `OPENALEX_EMAIL` when set. County mapping is deterministic: explicit institution overrides first, then `geo.region`, then `geo.city`. Only non-empty yearly rows between 1990 and the current year are kept, so the output is limited by OpenAlex's `counts_by_year` window rather than lifetime counts. The script writes `summary.json`, `by_county.json`, `by_institution.json`, `institutions.json`, `timeseries.json`, `institution_cube.json`, and `unmapped_institutions.json` to `public/data/impact/`.

`data/aggregate_efficiency.py` joins the committed funding and impact outputs; it does not call remote APIs itself. The overlap window is the intersection of funding years and impact years. Institution matching is strict and ordered: exact legal-name match, explicit legal-name alias, then audited short-name allowlist. Ambiguous short-name matches are intentionally excluded and written to `blocked_funding_institutions.json`; unmatched funding rows are written to `unmatched_funding_institutions.json`. When one matched institution has funding in multiple counties in the same year, OpenAlex paper and citation counts are allocated across those county rows in proportion to funding share. The script writes the efficiency summary, county/institution rankings, `institution_cube.json`, timeseries, and the blocked/unmatched audit files to `public/data/efficiency/`.

## Coding Style & Naming Conventions
Use ASCII by default. Follow the existing React + plain CSS style already present in `src/`. Keep data-contract field names stable across `data/aggregate_funding.py` and the frontend helpers in `src/lib/dashboard.js`; most regressions in this repo come from mismatches between generated JSON and UI expectations.

## Testing Guidelines
Validate changes with the relevant pipeline steps and `npm run build`. If you touch deployment, inspect `.github/workflows/ci.yml` and `.github/workflows/deploy.yml` together.

If you change funding aggregation or any funding-facing UI contract, run `npm run data:build` and verify `public/data/summary.json`, `funding_cube.json`, and `funding_institution_cube.json`.

If you change impact or efficiency logic, run `npm run impact:build`, `npm run efficiency:build`, and `npm run build`, then verify the generated `summary.json` and cube files in `public/data/impact/` and `public/data/efficiency/` still match the UI filters. CI currently rebuilds only the funding dataset plus the production bundle, so impact/efficiency regressions are easy to miss unless you regenerate them locally.

## Commit & Pull Request Guidelines
Recent history uses short imperative subjects. Keep commits focused, for example `Fix county ID mapping for live data` or `Add GitHub Pages CI workflow`. Pull requests should include:

- a brief summary of the change
- the data source or contract affected
- screenshots for UI changes
- the commands run locally (`npm run data:build`, `npm run impact:build`, `npm run efficiency:build`, `npm run build`)
