# NFR Funding Dashboard

Static dashboard for exploring Research Council of Norway funding by Norwegian county, institution, scheme, subject, and year, with additional views on impact (number of publications and citations) and efficiency (number of publications per MNOK).

The website is available at [https://filippomb.github.io/NFR-funding-dashboard/](https://filippomb.github.io/NFR-funding-dashboard/).

## Data

- Funding data comes from the Research Council of Norway open dataset [`soknader2`](https://github.com/Forskningsradet/open-data/tree/main/datasets/soknader2). The pipeline downloads the CSV, normalizes counties to the current county structure, resolves project year, and aggregates the data into static JSON for the dashboard.
- Impact data comes from [OpenAlex](https://docs.openalex.org/). The pipeline fetches Norwegian institutions, uses institution yearly publication and citation counts, maps institutions to counties, and writes county-, institution-, and year-level aggregates.
- Efficiency data is derived by joining the funding and OpenAlex datasets over their shared year range. Institution matches are audited, and papers per MNOK are computed from the matched records.

## Commands

Install dependencies once:

```sh
npm install
uv venv .venv
source .venv/bin/activate
```

Refresh the datasets:

```sh
source .venv/bin/activate
npm run data:build
export OPENALEX_API_KEY=<your-openalex-key>
export OPENALEX_EMAIL=<your-email>
npm run impact:build
npm run efficiency:build
```

Run and debug locally:

```sh
npm run dev
```

Create a production build and preview it locally:

```sh
PAGES_REPOSITORY_NAME=NFR-funding-dashboard npm run build
npm run preview
```

## Deploy

GitHub Actions is the deployment path. To publish the site:

```sh
git add public/data README.md AGENTS.md
git commit -m "Refresh dashboard data and docs"
git push origin main
```

Pushes to `main` trigger [`.github/workflows/deploy.yml`](/Users/filippo/Projects/Github/NFR-funding-stats/.github/workflows/deploy.yml), which builds the site and deploys it to GitHub Pages.
