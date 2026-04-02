# NFR Funding Stats

Static dashboard for Research Council of Norway funding statistics, designed to ship as a GitHub Pages site with no server-side runtime. The current implementation uses React + Vite for the frontend, D3-backed SVG charts, and a Python script that generates static JSON assets for the browser.

## What is in the repository

- `src/`: React application, filters, KPI strip, choropleth, trend chart, and ranking panels
- `public/data/`: generated static JSON files used by the app
- `public/geo/`: county GeoJSON used by the choropleth
- `data/`: mock raw project records and the aggregation script
- `.github/workflows/deploy.yml`: GitHub Pages build and deployment workflow

## Required software

Install these tools before building or deploying:

- `git`
- `node` 20+ and `npm`
- `python3` 3.9+ and `uv` for the local Python environment and static data pipeline
- `gh` optional, for GitHub authentication and workflow inspection

### macOS with Homebrew

```sh
brew install git node python uv gh
```

### Verify the installation

```sh
git --version
node --version
npm --version
python3 --version
uv --version
gh --version
```

## Local setup

Clone the repository and install dependencies from the project root:

```sh
git clone <repo-url>
cd NFR-funding-stats
npm install
uv venv .venv
source .venv/bin/activate
```

Keep Python dependencies local to this repository. Prefer `.venv/` managed by `uv`, and do not install Python packages globally.

Regenerate the static JSON bundles from the mock raw dataset:

```sh
npm run data:build
```

Start the development server:

```sh
npm run dev
```

Create a production build:

```sh
npm run build
```

Preview the production bundle locally:

```sh
npm run preview
```

## Data pipeline

The default pipeline reads `data/mock_projects.json` and writes the generated assets to `public/data/`.

```sh
source .venv/bin/activate
python3 data/aggregate_funding.py --input data/mock_projects.json --output public/data
```

You can also point the script at a remote JSON source:

```sh
python3 data/aggregate_funding.py --source-url <json-endpoint> --output public/data
```

The generated files are:

- `summary.json`
- `funding_by_county.json`
- `funding_timeseries.json`
- `funding_by_dimension.json`
- `funding_cube.json`

## Deployment

Deployment is handled by GitHub Actions and GitHub Pages. Push to `main` to trigger the workflow in [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml). The Vite configuration sets the production base path for a project site, so the built app can be served from `/<repo-name>/`.

Enable GitHub Pages in the repository settings and use the GitHub Actions source.

## Notes

- The current dataset is mocked to unblock UI work.
- Institution totals reflect the registered project owner.
- Subject totals may overlap and should not be treated as additive across themes.
- County geometry is based on Kartverket data via `robhop/fylker-og-kommuner` under CC BY 4.0.
