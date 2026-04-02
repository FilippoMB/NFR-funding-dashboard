# Repository Guidelines

## Project Structure & Module Organization
This repository is currently a planning workspace for a dashboard about Research Council of Norway funding statistics. The only checked-in project artifact is [inital-research.md](/Users/filippo/Projects/Github/NFR-funding-stats/inital-research.md), which captures product scope, data-source notes, and domain caveats. Keep early research notes in Markdown. If you add implementation work, create focused top-level directories such as `src/`, `data/`, `notebooks/`, or `tests/` instead of expanding the repository root.

## Build, Test, and Development Commands
Frontend and data commands should run from the repository root:

```sh
npm install
npm run data:build
npm run dev
npm run build
```

For Python work, prefer `uv` and keep the environment inside this repository:

```sh
uv venv .venv
source .venv/bin/activate
uv pip install -r requirements.txt
```

Do not rely on globally installed Python packages.

## Local Environment Policy
Install tools and Python dependencies locally in this folder whenever possible. Prefer a project-local virtual environment at `.venv/` managed by `uv`. Do not install Python packages globally with `pip`, and do not create ad hoc environments outside the repository unless the user explicitly asks for a shared `micromamba` environment under the home directory. Minimize writes outside the repo; if a command would use a global cache or system path, prefer a repo-local alternative.

## Deployment Constraint
The dashboard must be deployable as a static website on GitHub Pages. Prefer frameworks and build setups that emit static assets only, for example a prebuilt `dist/` or `build/` directory with no server-side runtime. Avoid designs that require backend rendering, long-running services, or private server infrastructure.

## Coding Style & Naming Conventions
Use clear, minimal Markdown for research documents: short sections, sentence-case headings where appropriate, and bullet lists for requirements or caveats. Prefer descriptive filenames such as `data-sources.md` or `municipality-mapping.py`. Use ASCII by default. If you add code, follow the formatter and linter native to that stack and document them here immediately.

## Testing Guidelines
Validate changes with `npm run build` and `npm run data:build`. Keep assumptions explicit, especially around county, institution, and subject-field aggregation. Any new Python logic should run inside `.venv/` and ship with either tests or a documented validation script.

## Commit & Pull Request Guidelines
Git history is not available in this workspace snapshot, so no repository-specific commit convention can be inferred. Use short imperative commit subjects such as `Add project databank parser` or `Document funding aggregation limits`. Pull requests should include:

- a brief summary of the change
- the data source or assumption affected
- sample output or screenshots for dashboard/UI work
- follow-up risks, especially if category totals may double-count funding

## Data Notes
Preserve the caveats already documented in [inital-research.md](/Users/filippo/Projects/Github/NFR-funding-stats/inital-research.md): institution counts reflect the project owner, and some thematic categories may overlap.
