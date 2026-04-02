# Implementation Plan: NFR Funding Statistics Dashboard

## Summary

Build a static React + Vite dashboard for GitHub Pages that visualizes Research Council of Norway funding data with a county-level choropleth, annual trend chart, and ranked breakdowns by institution, funding scheme, and subject field. Develop against mocked static JSON first, then swap in regenerated data assets from the Python pipeline.

## Technical decisions

- Frontend stack: React + Vite, plain CSS, D3-backed SVG visualizations
- Deployment target: GitHub Pages via GitHub Actions artifact deployment
- Geography: county level only in v1
- Runtime model: static assets only, no backend, no client-side API dependency in production
- Data strategy: Python pipeline writes deterministic JSON files into `public/data/`

## Implementation details

### Frontend shell

- App header with project context, latest year, and deployment model
- Shared filter bar for year, county, institution, funding scheme, and subject field
- KPI strip for funding, project count, county coverage, and average grant
- Dashboard sections for county map, yearly trend, and ranked category views

### Visualizations

- D3 SVG county choropleth backed by a committed schematic county GeoJSON
- SVG line chart for annual funding totals
- Ranked bar views for institutions, schemes, and subjects
- Filter interactions update all views from the same static data cube

### Data pipeline

- Input: mock raw project records now, remote JSON endpoint later
- Output files:
  - `summary.json`
  - `funding_by_county.json`
  - `funding_timeseries.json`
  - `funding_by_dimension.json`
  - `funding_cube.json`
- Domain caveats remain explicit: project owner attribution for institutions and overlap risk for thematic totals

### Deployment and docs

- GitHub Actions installs dependencies, regenerates static data, builds the site, and deploys the Pages artifact
- `README.md` documents installation, local development, data generation, build, preview, and deployment steps

## Verification

- `npm run data:build` regenerates the expected JSON files
- `npm run build` creates a working static bundle in `dist/`
- Local preview renders the Pages-compatible build correctly
- Filters update the choropleth, trend chart, and rankings consistently
