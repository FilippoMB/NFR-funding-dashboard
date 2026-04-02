from __future__ import annotations

import argparse
import json
import re
import unicodedata
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


DEFAULT_OUTPUT_DIR = "public/data/efficiency"
DEFAULT_FUNDING_DIR = "public/data"
DEFAULT_IMPACT_DIR = "public/data/impact"
DEFAULT_MIN_FUNDING_NOK = 10_000_000
DEFAULT_MIN_PAPER_COUNT = 10

MANUAL_INSTITUTION_ALIASES = {
    "uio": "university of oslo",
    "ntnu": "norwegian university of science and technology",
    "uib": "university of bergen",
    "uit": "uit the arctic university of norway",
    "ife": "institute for energy technology",
    "norce": "norce research as",
    "nibio": "norwegian institute of bioeconomy research",
    "nmbu": "norwegian university of life sciences",
    "simula": "simula research laboratory",
    "ous": "oslo university hospital",
    "hi": "norwegian institute of marine research",
    "niva": "norwegian institute for water research",
    "nina": "norwegian institute for nature research",
    "fhi": "norwegian institute of public health",
    "oslomet": "oslomet oslo metropolitan university",
    "prio": "peace research institute oslo",
    "uis": "university of stavanger",
    "ngi": "norwegian geotechnical institute",
    "vi": "norwegian veterinary institute",
    "tøi": "institute of transport economics",
    "toi": "institute of transport economics",
    "isf": "institute for social research",
    "nupi": "norwegian institute of international affairs",
    "nifu": "nifu nordic institute for studies in innovation research and education",
    "cmi": "chr michelsen institute",
    "fafo": "fafo foundation",
    "uia": "university of agder",
    "hvl": "western norway university of applied sciences",
    "hioa": "oslomet oslo metropolitan university",
    "usn": "university of south eastern norway",
    "nhh": "norwegian school of economics",
    "niku": "norwegian institute for cultural heritage research",
    "dnv": "det norske veritas",
    "met": "norwegian meteorological institute",
    "unn": "university hospital of north norway",
    "ntnusamf": "norwegian university of science and technology",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Join funding and OpenAlex impact data into an efficiency dataset."
    )
    parser.add_argument(
        "--funding-dir",
        default=DEFAULT_FUNDING_DIR,
        help=f"Directory containing funding JSON files. Defaults to {DEFAULT_FUNDING_DIR}."
    )
    parser.add_argument(
        "--impact-dir",
        default=DEFAULT_IMPACT_DIR,
        help=f"Directory containing impact JSON files. Defaults to {DEFAULT_IMPACT_DIR}."
    )
    parser.add_argument(
        "--output",
        default=DEFAULT_OUTPUT_DIR,
        help=f"Directory where efficiency JSON files will be written. Defaults to {DEFAULT_OUTPUT_DIR}."
    )
    parser.add_argument(
        "--min-funding-nok",
        type=int,
        default=DEFAULT_MIN_FUNDING_NOK,
        help="Minimum overlapping funding required for an institution to be ranking-eligible."
    )
    parser.add_argument(
        "--min-paper-count",
        type=int,
        default=DEFAULT_MIN_PAPER_COUNT,
        help="Minimum overlapping paper count required for an institution to be ranking-eligible."
    )
    return parser.parse_args()


def clean_text(value: Any) -> str:
    return " ".join(str(value or "").split())


def normalize_name(value: str) -> str:
    normalized = unicodedata.normalize("NFD", clean_text(value))
    normalized = "".join(
        character
        for character in normalized
        if unicodedata.category(character) != "Mn"
    )
    normalized = normalized.lower()
    normalized = re.sub(r"[^a-z0-9]+", " ", normalized).strip()
    return normalized


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def safe_ratio(numerator: float, denominator: float) -> float:
    return numerator / denominator if denominator > 0 else 0.0


def papers_per_mnok(paper_count: float, funding_nok: float) -> float:
    return safe_ratio(paper_count, funding_nok / 1_000_000)


def citations_per_mnok(citation_count: float, funding_nok: float) -> float:
    return safe_ratio(citation_count, funding_nok / 1_000_000)


def build_impact_lookup(impact_institutions: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    lookup: dict[str, dict[str, Any]] = {}

    def register(key: str, institution: dict[str, Any]) -> None:
      normalized_key = normalize_name(key)

      if not normalized_key:
          return

      existing = lookup.get(normalized_key)
      if existing is None or institution.get("paperCount", 0) > existing.get("paperCount", 0):
          lookup[normalized_key] = institution

    for institution in impact_institutions:
        register(institution.get("name", ""), institution)

        for acronym in institution.get("acronyms") or []:
            register(acronym, institution)

    return lookup


def resolve_impact_institution(
    funding_name: str,
    impact_lookup: dict[str, dict[str, Any]]
) -> tuple[dict[str, Any] | None, str | None]:
    normalized_funding_name = normalize_name(funding_name)

    if normalized_funding_name in impact_lookup:
        return impact_lookup[normalized_funding_name], "normalized_name"

    alias_target = MANUAL_INSTITUTION_ALIASES.get(normalized_funding_name)
    if alias_target and alias_target in impact_lookup:
        return impact_lookup[alias_target], "manual_alias"

    return None, None


def aggregate_funding_by_county(
    funding_cube: list[dict[str, Any]],
    overlap_years: set[int]
) -> dict[str, dict[str, Any]]:
    county_totals: dict[str, dict[str, Any]] = defaultdict(
        lambda: {"countyName": "", "fundingNok": 0}
    )

    for row in funding_cube:
        if row["year"] not in overlap_years:
            continue

        county = county_totals[row["countyId"]]
        county["countyId"] = row["countyId"]
        county["countyName"] = row.get("countyName", county["countyName"])
        county["fundingNok"] += row["totalFundingNok"]

    return county_totals


def aggregate_impact_by_county(
    impact_cube: list[dict[str, Any]],
    overlap_years: set[int]
) -> dict[str, dict[str, Any]]:
    county_totals: dict[str, dict[str, Any]] = defaultdict(
        lambda: {"citationCount": 0, "countyName": "", "paperCount": 0}
    )
    county_institutions: dict[str, set[str]] = defaultdict(set)

    for row in impact_cube:
        if row["year"] not in overlap_years or not row.get("countyId"):
            continue

        county = county_totals[row["countyId"]]
        county["countyId"] = row["countyId"]
        county["countyName"] = row.get("countyName", county["countyName"])
        county["paperCount"] += row["paperCount"]
        county["citationCount"] += row["citationCount"]
        county_institutions[row["countyId"]].add(row["institutionId"])

    for county_id, institutions in county_institutions.items():
        county_totals[county_id]["institutionCount"] = len(institutions)

    return county_totals


def aggregate_efficiency_timeseries(
    funding_cube: list[dict[str, Any]],
    impact_cube: list[dict[str, Any]],
    overlap_years: list[int]
) -> list[dict[str, Any]]:
    funding_by_year = defaultdict(int)
    impact_by_year = defaultdict(lambda: {"citationCount": 0, "paperCount": 0})

    for row in funding_cube:
        if row["year"] in overlap_years:
            funding_by_year[row["year"]] += row["totalFundingNok"]

    for row in impact_cube:
        if row["year"] in overlap_years:
            impact_by_year[row["year"]]["paperCount"] += row["paperCount"]
            impact_by_year[row["year"]]["citationCount"] += row["citationCount"]

    return [
        {
            "citationCount": impact_by_year[year]["citationCount"],
            "citationsPerMnok": citations_per_mnok(
                impact_by_year[year]["citationCount"],
                funding_by_year[year]
            ),
            "fundingNok": funding_by_year[year],
            "paperCount": impact_by_year[year]["paperCount"],
            "papersPerMnok": papers_per_mnok(
                impact_by_year[year]["paperCount"],
                funding_by_year[year]
            ),
            "year": year,
        }
        for year in overlap_years
    ]


def aggregate_institutions(
    funding_institution_cube: list[dict[str, Any]],
    impact_institution_cube: list[dict[str, Any]],
    impact_institutions: list[dict[str, Any]],
    overlap_years: set[int],
    min_funding_nok: int,
    min_paper_count: int
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    impact_lookup = build_impact_lookup(impact_institutions)

    funding_joined: dict[str, dict[str, Any]] = {}
    unmatched_funding: dict[str, dict[str, Any]] = defaultdict(
        lambda: {"counties": set(), "fundingNok": 0}
    )

    for row in funding_institution_cube:
        if row["year"] not in overlap_years:
            continue

        impact_institution, matched_by = resolve_impact_institution(
            row["institutionName"],
            impact_lookup
        )

        if impact_institution is None:
            unmatched = unmatched_funding[row["institutionName"]]
            unmatched["fundingNok"] += row["totalFundingNok"]
            unmatched["counties"].add(row["countyId"])
            continue

        key = f"{impact_institution['id']}::{row['year']}"
        current = funding_joined.get(key)

        if current is None:
            current = {
                "citationCount": 0,
                "citationsPerMnok": 0.0,
                "countyId": impact_institution.get("countyId") or row["countyId"],
                "countyName": impact_institution.get("countyName") or row.get("countyName"),
                "fundingNok": 0,
                "id": impact_institution["id"],
                "institutionId": impact_institution["id"],
                "institutionName": impact_institution["name"],
                "matchedBy": matched_by,
                "paperCount": 0,
                "papersPerMnok": 0.0,
                "year": row["year"],
            }
            funding_joined[key] = current

        current["fundingNok"] += row["totalFundingNok"]

    for row in impact_institution_cube:
        if row["year"] not in overlap_years:
            continue

        key = f"{row['institutionId']}::{row['year']}"
        current = funding_joined.get(key)

        if current is None:
            continue

        current["paperCount"] += row["paperCount"]
        current["citationCount"] += row["citationCount"]

    institution_cube = sorted(
        (
            {
                **row,
                "citationsPerMnok": citations_per_mnok(row["citationCount"], row["fundingNok"]),
                "papersPerMnok": papers_per_mnok(row["paperCount"], row["fundingNok"]),
            }
            for row in funding_joined.values()
            if row["fundingNok"] > 0
        ),
        key=lambda item: (item["year"], item["institutionName"].lower()),
    )

    institution_aggregates: dict[str, dict[str, Any]] = {}
    for row in institution_cube:
        current = institution_aggregates.get(row["institutionId"])

        if current is None:
            current = {
                "citationCount": 0,
                "citationsPerMnok": 0.0,
                "countyId": row["countyId"],
                "countyName": row["countyName"],
                "fundingNok": 0,
                "id": row["institutionId"],
                "label": row["institutionName"],
                "matchedBy": row["matchedBy"],
                "paperCount": 0,
                "papersPerMnok": 0.0,
            }
            institution_aggregates[row["institutionId"]] = current

        current["fundingNok"] += row["fundingNok"]
        current["paperCount"] += row["paperCount"]
        current["citationCount"] += row["citationCount"]

    for current in institution_aggregates.values():
        current["papersPerMnok"] = papers_per_mnok(
            current["paperCount"],
            current["fundingNok"]
        )
        current["citationsPerMnok"] = citations_per_mnok(
            current["citationCount"],
            current["fundingNok"]
        )
        current["rankingEligible"] = (
            current["fundingNok"] >= min_funding_nok
            and current["paperCount"] >= min_paper_count
        )

    by_institution = sorted(
        institution_aggregates.values(),
        key=lambda item: (
            item["papersPerMnok"],
            item["paperCount"],
            -item["fundingNok"],
            item["label"],
        ),
        reverse=True,
    )

    unmatched_funding_institutions = sorted(
        (
            {
                "countyIds": sorted(values["counties"]),
                "fundingNok": values["fundingNok"],
                "label": name,
            }
            for name, values in unmatched_funding.items()
        ),
        key=lambda item: item["fundingNok"],
        reverse=True,
    )

    return by_institution, institution_cube, unmatched_funding_institutions


def write_output(output_dir: Path, payload: dict[str, Any]) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)

    for file_name, key in (
        ("summary.json", "summary"),
        ("by_county.json", "by_county"),
        ("by_institution.json", "by_institution"),
        ("institution_cube.json", "institution_cube"),
        ("timeseries.json", "timeseries"),
        ("unmatched_funding_institutions.json", "unmatched_funding_institutions"),
    ):
        (output_dir / file_name).write_text(
            json.dumps(
                payload[key],
                ensure_ascii=False,
                separators=(",", ":"),
                sort_keys=True,
            )
            + "\n",
            encoding="utf-8",
        )


def main() -> None:
    args = parse_args()
    funding_dir = Path(args.funding_dir)
    impact_dir = Path(args.impact_dir)

    funding_summary = read_json(funding_dir / "summary.json")
    funding_cube = read_json(funding_dir / "funding_cube.json")
    funding_institution_cube = read_json(funding_dir / "funding_institution_cube.json")

    impact_summary = read_json(impact_dir / "summary.json")
    impact_institution_cube = read_json(impact_dir / "institution_cube.json")
    impact_institutions = read_json(impact_dir / "institutions.json")

    overlap_years = sorted(
        set(funding_summary["filters"]["years"]) & set(impact_summary["filters"]["years"])
    )
    overlap_year_set = set(overlap_years)

    funding_by_county = aggregate_funding_by_county(funding_cube, overlap_year_set)
    impact_by_county = aggregate_impact_by_county(impact_institution_cube, overlap_year_set)
    by_institution, institution_cube, unmatched_funding_institutions = aggregate_institutions(
        funding_institution_cube=funding_institution_cube,
        impact_institution_cube=impact_institution_cube,
        impact_institutions=impact_institutions,
        overlap_years=overlap_year_set,
        min_funding_nok=args.min_funding_nok,
        min_paper_count=args.min_paper_count,
    )

    county_ids = sorted(set(funding_by_county.keys()) | set(impact_by_county.keys()))
    by_county = []
    for county_id in county_ids:
        funding_row = funding_by_county.get(county_id, {})
        impact_row = impact_by_county.get(county_id, {})
        funding_nok = funding_row.get("fundingNok", 0)
        paper_count = impact_row.get("paperCount", 0)
        citation_count = impact_row.get("citationCount", 0)
        by_county.append(
            {
                "citationCount": citation_count,
                "citationsPerMnok": citations_per_mnok(citation_count, funding_nok),
                "countyId": county_id,
                "countyName": funding_row.get("countyName") or impact_row.get("countyName"),
                "fundingNok": funding_nok,
                "institutionCount": impact_row.get("institutionCount", 0),
                "paperCount": paper_count,
                "papersPerMnok": papers_per_mnok(paper_count, funding_nok),
            }
        )

    by_county.sort(key=lambda item: item["papersPerMnok"], reverse=True)

    timeseries = aggregate_efficiency_timeseries(
        funding_cube=funding_cube,
        impact_cube=impact_institution_cube,
        overlap_years=overlap_years,
    )

    matched_institutions = [item for item in by_institution if item["fundingNok"] > 0]
    matched_eligible = [item for item in by_institution if item["rankingEligible"]]
    total_funding_nok = sum(item["fundingNok"] for item in matched_institutions)
    total_paper_count = sum(item["paperCount"] for item in matched_institutions)
    total_citation_count = sum(item["citationCount"] for item in matched_institutions)

    payload = {
        "summary": {
            "filters": {
                "counties": funding_summary["filters"]["counties"],
                "years": overlap_years,
            },
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "latestYear": overlap_years[-1] if overlap_years else None,
            "matchedInstitutionCount": len(matched_institutions),
            "rankingEligibleInstitutionCount": len(matched_eligible),
            "minFundingNokForRanking": args.min_funding_nok,
            "minPaperCountForRanking": args.min_paper_count,
            "notes": [
                "Efficiency is defined as published papers divided by funding in MNOK over the overlapping funding/OpenAlex year window.",
                "The current efficiency dataset uses only years present in both sources.",
                "Institution joins combine exact normalized-name matches, OpenAlex acronyms, and a curated alias table for major Norwegian institutions.",
                "Ranking eligibility requires both a minimum funding level and a minimum paper count to reduce small-denominator distortions.",
            ],
            "overlapYearStart": overlap_years[0] if overlap_years else None,
            "paperCount": total_paper_count,
            "citationCount": total_citation_count,
            "fundingNok": total_funding_nok,
            "papersPerMnok": papers_per_mnok(total_paper_count, total_funding_nok),
            "citationsPerMnok": citations_per_mnok(total_citation_count, total_funding_nok),
            "source": {
                "funding": funding_summary["source"]["label"],
                "impact": impact_summary["source"]["label"],
                "label": "Joined funding + OpenAlex efficiency dataset",
            },
        },
        "by_county": by_county,
        "by_institution": by_institution,
        "institution_cube": institution_cube,
        "timeseries": timeseries,
        "unmatched_funding_institutions": unmatched_funding_institutions,
    }

    write_output(Path(args.output), payload)


if __name__ == "__main__":
    main()
