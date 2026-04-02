# NFR Funding Dashboard

Static GitHub Pages dashboard for Research Council of Norway funding statistics. The site is built with React + Vite and reads prebuilt JSON from `public/data/`; there is no backend runtime.

Repository: `https://github.com/FilippoMB/NFR-funding-dashboard`

## Project layout

- `src/`: React UI, filters, maps, charts, and formatting helpers
- `public/data/`: generated dashboard datasets committed for static hosting
- `public/geo/`: Norway county GeoJSON used by the choropleth
- `data/`: Python aggregation script plus mock input for offline testing
- `.github/workflows/`: CI validation and GitHub Pages deployment

## Required software

- `git`
- `node` 20+ and `npm`
- `python3` 3.9+ and `uv`
- `gh` optional but useful for authentication and workflow inspection

macOS/Homebrew:

```sh
brew install git node python uv gh
```

## Local setup

```sh
git clone https://github.com/FilippoMB/NFR-funding-dashboard.git
cd NFR-funding-dashboard
npm install
uv venv .venv
source .venv/bin/activate
```

Keep Python dependencies local to `.venv/`. Do not install Python packages globally.

## Daily development

Start the app locally:

```sh
npm run dev
```

Rebuild the real dataset from the official Forskningsrådet feed:

```sh
source .venv/bin/activate
npm run data:build
```

Rebuild from the checked-in mock input instead:

```sh
npm run data:build:mock
```

Build the first OpenAlex-based impact dataset:

```sh
export OPENALEX_API_KEY=<your-openalex-key>
export OPENALEX_EMAIL=<your-email>
npm run impact:build
```

Build the joined efficiency dataset used by the `Efficiency` mode:

```sh
npm run efficiency:build
```

Create a production build:

```sh
npm run build
```

Local Pages-style build preview for this repo:

```sh
PAGES_REPOSITORY_NAME=NFR-funding-dashboard npm run build
npm run preview
```

## Generated data

The Python pipeline writes:

- `summary.json`
- `funding_by_county.json`
- `funding_timeseries.json`
- `funding_by_dimension.json`
- `funding_cube.json`
- `funding_institution_cube.json`

`npm run data:build` pulls the official `soknader2` CSV and regenerates `public/data/`. Commit the updated JSON when the upstream dataset changes.

The OpenAlex impact prototype writes to `public/data/impact/`:

- `summary.json`
- `by_county.json`
- `by_institution.json`
- `institutions.json`
- `timeseries.json`
- `institution_cube.json`
- `unmapped_institutions.json`

This dataset is derived from OpenAlex institution `counts_by_year`, so it currently covers the last ten years only and uses institution geography to infer Norwegian counties.

The efficiency join writes to `public/data/efficiency/`:

- `summary.json`
- `by_county.json`
- `by_institution.json`
- `timeseries.json`
- `institution_cube.json`
- `unmatched_funding_institutions.json`

Efficiency is defined as published papers per MNOK of NFR funding over the overlap window shared by the funding and OpenAlex datasets. Institution rankings are thresholded to reduce small-denominator artifacts.

## GitHub and deployment

If this local repository was created before the GitHub repo existed, attach the remote once:

```sh
git remote add origin https://github.com/FilippoMB/NFR-funding-dashboard.git
```

Then push the current branch:

```sh
git push -u origin main
```

GitHub Actions handles both validation and deployment:

- [`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs data rebuild + production build on pushes and pull requests.
- [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) deploys `dist/` to GitHub Pages on pushes to `main`.

In the GitHub repository settings, enable Pages and choose `GitHub Actions` as the source. After that, every push to `main` will publish the site automatically.

## Maintenance checklist

When changing code:

```sh
npm run build
```

When refreshing the dataset:

```sh
npm run data:build
npm run impact:build
npm run efficiency:build
npm run build
git add public/data
```

Before pushing:

```sh
git status
git add .
git commit -m "Describe the change"
git push
```

## Data caveats

- Institution totals reflect the registered project owner.
- Subject totals may overlap and should not be summed as independent categories.
- The dashboard uses project start year, not annual disbursement year.
- Impact data comes from OpenAlex institution `counts_by_year`, not from NVA.
- Efficiency rankings use matched institutions only and compare papers per MNOK over the overlap years between funding and impact.
- County geometry is based on Kartverket-derived data via `robhop/fylker-og-kommuner` under CC BY 4.0.
