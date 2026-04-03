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

LEGAL_NAME_ALIASES = {
    "universitetet i oslo": "university of oslo",
    "norges teknisk naturvitenskapelige universitet ntnu": (
        "norwegian university of science and technology"
    ),
    "universitetet i bergen": "university of bergen",
    "universitetet i tromso norges arktiske universitet": (
        "uit the arctic university of norway"
    ),
    "institutt for energiteknikk sti": "institute for energy technology",
    "nibio norsk institutt for biookonomi": "norwegian institute of bioeconomy research",
    "norges miljo og biovitenskapelige universitet nmbu": (
        "norwegian university of life sciences"
    ),
    "simula research laboratory as": "simula research laboratory",
    "oslo universitetssykehus hf": "oslo university hospital",
    "havforskningsinstituttet": "norwegian institute of marine research",
    "norsk institutt for vannforskning sti": "norwegian institute for water research",
    "stiftelsen norsk institutt for naturforskning nina": (
        "norwegian institute for nature research"
    ),
    "folkehelseinstituttet": "norwegian institute of public health",
    "oslomet storbyuniversitetet": "oslomet oslo metropolitan university",
    "institutt for fredsforskning sti": "peace research institute oslo",
    "universitetet i stavanger": "university of stavanger",
    "stiftelsen norges geotekniske institutt": "norwegian geotechnical institute",
    "veterinaerinstituttet": "norwegian veterinary institute",
    "transportokonomisk institutt stiftelsen norsk senter for samferdselsforskning": (
        "institute of transport economics"
    ),
    "institutt for samfunnsforskning sti": "institute for social research",
    "norsk utenrikspolitisk institutt": "norwegian institute of international affairs",
    "forskningsstiftelsen nifu": (
        "nifu nordic institute for studies in innovation research and education"
    ),
    "chr michelsens institutt for videnskap og andsfrihet sti": (
        "chr michelsen institute"
    ),
    "universitetet i agder": "university of agder",
    "hogskulen pa vestlandet": "western norway university of applied sciences",
    "universitetet i sorost norge": "university of south eastern norway",
    "norges handelshoyskole": "norwegian school of economics",
    "stiftelsen norsk institutt for kulturminneforskning": (
        "norwegian institute for cultural heritage research"
    ),
    "meteorologisk institutt": "norwegian meteorological institute",
    "universitetssykehuset nord norge hf": "university hospital of north norway",
    "akershus universitetssykehus hf": "akershus university hospital",
    "forsvarets forskningsinstitutt": "norwegian defence research establishment",
    "norges geologiske undersokelse": "geological survey of norway",
    "vid vitenskapelige hogskole as": "vid specialized university",
    "trondelag forskning og utvikling as": "trondelag forskning og utvikling norway",
    "statens arbeidsmiljoinstitutt": "national institute of occupational health",
    "statistisk sentralbyra": "statistics norway",
    "dnv as": "dnv norway",
}

SHORT_NAME_ALLOWLIST = {
    "sintef": "sintef",
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
    "dnv": "dnv norway",
    "met": "norwegian meteorological institute",
    "unn": "university hospital of north norway",
    "ntnusamf": "norwegian university of science and technology",
    "ahus": "akershus university hospital",
    "ffi": "norwegian defence research establishment",
    "ngu": "geological survey of norway",
    "vid": "vid specialized university",
    "tfou": "trondelag forskning og utvikling norway",
    "stami": "national institute of occupational health",
    "ssb": "statistics norway",
}

BLOCKED_FUNDING_REASON = (
    "Ambiguous short-name match; excluded until audited against a direct OpenAlex mapping."
)

BLOCKED_FUNDING_LEGAL_NAMES = {
    "ge vingmed ultrasound as": BLOCKED_FUNDING_REASON,
    "ge healthcare as": BLOCKED_FUNDING_REASON,
    "ge healthcare as avd lindesnes": BLOCKED_FUNDING_REASON,
}

BLOCKED_FUNDING_SHORT_NAMES = {
    "ge": BLOCKED_FUNDING_REASON,
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

    return lookup


def resolve_impact_institution(
    funding_row: dict[str, Any],
    impact_lookup: dict[str, dict[str, Any]],
    audit_candidate_lookup: dict[str, dict[str, Any]],
) -> tuple[dict[str, Any] | None, str | None, dict[str, Any] | None]:
    legal_name = normalize_name(
        funding_row.get("institutionLegalName") or funding_row.get("institutionName")
    )
    short_name = normalize_name(
        funding_row.get("institutionShortName") or funding_row.get("institutionName")
    )

    if legal_name in impact_lookup:
        return impact_lookup[legal_name], "legal_name_exact", None

    alias_target = LEGAL_NAME_ALIASES.get(legal_name)
    normalized_alias_target = normalize_name(alias_target) if alias_target else ""
    if normalized_alias_target in impact_lookup:
        return impact_lookup[normalized_alias_target], "legal_name_alias", None

    blocked_reason = (
        BLOCKED_FUNDING_LEGAL_NAMES.get(legal_name)
        or BLOCKED_FUNDING_SHORT_NAMES.get(short_name)
    )
    if blocked_reason:
        candidate = audit_candidate_lookup.get(short_name) or audit_candidate_lookup.get(legal_name)
        return None, None, {
            "candidateOpenAlexId": candidate.get("id") if candidate else None,
            "candidateOpenAlexName": candidate.get("name") if candidate else None,
            "countyId": funding_row.get("countyId"),
            "fundingNok": funding_row.get("totalFundingNok", 0),
            "institutionLegalName": (
                funding_row.get("institutionLegalName")
                or funding_row.get("institutionName")
                or "Ukjent prosjektansvarlig"
            ),
            "institutionShortName": (
                funding_row.get("institutionShortName")
                or funding_row.get("institutionName")
                or "Ukjent prosjektansvarlig"
            ),
            "reason": blocked_reason,
        }

    allowlist_target = SHORT_NAME_ALLOWLIST.get(short_name)
    normalized_allowlist_target = normalize_name(allowlist_target) if allowlist_target else ""
    if normalized_allowlist_target in impact_lookup:
        return impact_lookup[normalized_allowlist_target], "short_name_allowlist", None

    return None, None, None


def build_audit_candidate_lookup(
    impact_institutions: list[dict[str, Any]]
) -> dict[str, dict[str, Any]]:
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


def round_metric(value: float) -> float:
    rounded = round(float(value), 6)
    return 0.0 if abs(rounded) < 1e-9 else rounded


def allocate_metric_by_funding(
    rows: list[dict[str, Any]],
    metric_key: str,
    total_metric: float,
) -> None:
    total_funding = sum(row["fundingNok"] for row in rows)

    if total_funding <= 0 or total_metric <= 0:
        for row in rows:
            row[metric_key] = 0.0
        return

    remaining_metric = float(total_metric)
    sorted_rows = sorted(
        rows,
        key=lambda item: (
            item.get("countyId") or "",
            item.get("countyName") or "",
            item["institutionId"],
        ),
    )

    for index, row in enumerate(sorted_rows):
        if index == len(sorted_rows) - 1:
            allocation = remaining_metric
        else:
            allocation = round_metric(total_metric * safe_ratio(row["fundingNok"], total_funding))
            remaining_metric = round_metric(remaining_metric - allocation)

        row[metric_key] = round_metric(allocation)


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
    institution_cube: list[dict[str, Any]],
    overlap_years: list[int]
) -> list[dict[str, Any]]:
    year_totals = {
        year: {"citationCount": 0.0, "fundingNok": 0, "paperCount": 0.0, "year": year}
        for year in overlap_years
    }

    for row in institution_cube:
        current = year_totals.get(row["year"])

        if current is None:
            continue

        current["fundingNok"] += row["fundingNok"]
        current["paperCount"] += row["paperCount"]
        current["citationCount"] += row["citationCount"]

    timeseries = []
    for year in overlap_years:
        current = year_totals[year]
        paper_count = round_metric(current["paperCount"])
        citation_count = round_metric(current["citationCount"])
        funding_nok = current["fundingNok"]
        timeseries.append(
            {
                "citationCount": citation_count,
                "citationsPerMnok": citations_per_mnok(citation_count, funding_nok),
                "fundingNok": funding_nok,
                "paperCount": paper_count,
                "papersPerMnok": papers_per_mnok(paper_count, funding_nok),
                "year": year,
            }
        )

    return timeseries


def aggregate_efficiency_by_county(
    institution_cube: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    county_totals: dict[str, dict[str, Any]] = defaultdict(
        lambda: {
            "citationCount": 0.0,
            "countyId": None,
            "countyName": "",
            "fundingNok": 0,
            "institutionIds": set(),
            "paperCount": 0.0,
        }
    )

    for row in institution_cube:
        county_id = row.get("countyId")

        if not county_id:
            continue

        current = county_totals[county_id]
        current["countyId"] = county_id
        current["countyName"] = row.get("countyName", current["countyName"])
        current["fundingNok"] += row["fundingNok"]
        current["paperCount"] += row["paperCount"]
        current["citationCount"] += row["citationCount"]
        current["institutionIds"].add(row["institutionId"])

    by_county = []
    for current in county_totals.values():
        paper_count = round_metric(current["paperCount"])
        citation_count = round_metric(current["citationCount"])
        funding_nok = current["fundingNok"]
        by_county.append(
            {
                "citationCount": citation_count,
                "citationsPerMnok": citations_per_mnok(citation_count, funding_nok),
                "countyId": current["countyId"],
                "countyName": current["countyName"],
                "fundingNok": funding_nok,
                "institutionCount": len(current["institutionIds"]),
                "paperCount": paper_count,
                "papersPerMnok": papers_per_mnok(paper_count, funding_nok),
            }
        )

    by_county.sort(key=lambda item: item["papersPerMnok"], reverse=True)
    return by_county


def aggregate_institutions(
    funding_institution_cube: list[dict[str, Any]],
    impact_institution_cube: list[dict[str, Any]],
    impact_institutions: list[dict[str, Any]],
    overlap_years: set[int],
    min_funding_nok: int,
    min_paper_count: int
) -> tuple[
    list[dict[str, Any]],
    list[dict[str, Any]],
    list[dict[str, Any]],
    list[dict[str, Any]],
]:
    impact_lookup = build_impact_lookup(impact_institutions)
    audit_candidate_lookup = build_audit_candidate_lookup(impact_institutions)

    funding_joined: dict[str, dict[str, Any]] = {}
    unmatched_funding: dict[str, dict[str, Any]] = defaultdict(
        lambda: {"counties": set(), "fundingNok": 0}
    )
    blocked_funding: dict[str, dict[str, Any]] = {}
    impact_by_institution_year: dict[str, dict[str, float]] = defaultdict(
        lambda: {"citationCount": 0.0, "paperCount": 0.0}
    )

    for row in funding_institution_cube:
        if row["year"] not in overlap_years:
            continue

        impact_institution, matched_by, blocked_record = resolve_impact_institution(
            row,
            impact_lookup,
            audit_candidate_lookup,
        )

        if blocked_record is not None:
            blocked_key = (
                f"{blocked_record['institutionShortName']}::"
                f"{blocked_record['institutionLegalName']}"
            )
            current = blocked_funding.get(blocked_key)

            if current is None:
                current = {
                    "candidateOpenAlexId": blocked_record["candidateOpenAlexId"],
                    "candidateOpenAlexName": blocked_record["candidateOpenAlexName"],
                    "countyIds": set(),
                    "fundingNok": 0,
                    "institutionLegalName": blocked_record["institutionLegalName"],
                    "institutionShortName": blocked_record["institutionShortName"],
                    "reason": blocked_record["reason"],
                }
                blocked_funding[blocked_key] = current

            current["fundingNok"] += blocked_record["fundingNok"]
            if blocked_record["countyId"]:
                current["countyIds"].add(blocked_record["countyId"])
            continue

        if impact_institution is None:
            unmatched = unmatched_funding[
                row.get("institutionLegalName") or row["institutionName"]
            ]
            unmatched["fundingNok"] += row["totalFundingNok"]
            unmatched["counties"].add(row["countyId"])
            continue

        key = f"{impact_institution['id']}::{row['year']}::{row['countyId']}"
        current = funding_joined.get(key)

        if current is None:
            current = {
                "citationCount": 0,
                "citationsPerMnok": 0.0,
                "countyId": row["countyId"],
                "countyName": row.get("countyName"),
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
        impact_by_institution_year[key]["paperCount"] += row["paperCount"]
        impact_by_institution_year[key]["citationCount"] += row["citationCount"]

    rows_by_institution_year: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in funding_joined.values():
        rows_by_institution_year[f"{row['institutionId']}::{row['year']}"].append(row)

    for key, rows in rows_by_institution_year.items():
        impact_row = impact_by_institution_year.get(key, {})
        allocate_metric_by_funding(rows, "paperCount", impact_row.get("paperCount", 0.0))
        allocate_metric_by_funding(rows, "citationCount", impact_row.get("citationCount", 0.0))

    institution_cube = sorted(
        (
            {
                **row,
                "citationCount": round_metric(row["citationCount"]),
                "citationsPerMnok": citations_per_mnok(row["citationCount"], row["fundingNok"]),
                "paperCount": round_metric(row["paperCount"]),
                "papersPerMnok": papers_per_mnok(row["paperCount"], row["fundingNok"]),
            }
            for row in funding_joined.values()
            if row["fundingNok"] > 0
        ),
        key=lambda item: (
            item["year"],
            item["institutionName"].lower(),
            item["countyId"] or "",
        ),
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
                "countyIds": set(),
                "fundingNok": 0,
                "id": row["institutionId"],
                "label": row["institutionName"],
                "matchedBy": row["matchedBy"],
                "paperCount": 0,
                "papersPerMnok": 0.0,
                "primaryCountyFundingNok": 0,
            }
            institution_aggregates[row["institutionId"]] = current

        current["fundingNok"] += row["fundingNok"]
        current["paperCount"] += row["paperCount"]
        current["citationCount"] += row["citationCount"]
        if row.get("countyId"):
            current["countyIds"].add(row["countyId"])
        if row["fundingNok"] > current["primaryCountyFundingNok"]:
            current["countyId"] = row["countyId"]
            current["countyName"] = row["countyName"]
            current["primaryCountyFundingNok"] = row["fundingNok"]

    for current in institution_aggregates.values():
        current["paperCount"] = round_metric(current["paperCount"])
        current["citationCount"] = round_metric(current["citationCount"])
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
        current["countyIds"] = sorted(current["countyIds"])
        current.pop("primaryCountyFundingNok", None)

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

    blocked_funding_institutions = sorted(
        (
            {
                **values,
                "countyIds": sorted(values["countyIds"]),
            }
            for values in blocked_funding.values()
        ),
        key=lambda item: item["fundingNok"],
        reverse=True,
    )

    return (
        by_institution,
        institution_cube,
        unmatched_funding_institutions,
        blocked_funding_institutions,
    )


def write_output(output_dir: Path, payload: dict[str, Any]) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)

    for file_name, key in (
        ("summary.json", "summary"),
        ("by_county.json", "by_county"),
        ("by_institution.json", "by_institution"),
        ("institution_cube.json", "institution_cube"),
        ("timeseries.json", "timeseries"),
        ("blocked_funding_institutions.json", "blocked_funding_institutions"),
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

    by_institution, institution_cube, unmatched_funding_institutions, blocked_funding_institutions = aggregate_institutions(
        funding_institution_cube=funding_institution_cube,
        impact_institution_cube=impact_institution_cube,
        impact_institutions=impact_institutions,
        overlap_years=overlap_year_set,
        min_funding_nok=args.min_funding_nok,
        min_paper_count=args.min_paper_count,
    )
    by_county = aggregate_efficiency_by_county(institution_cube)
    timeseries = aggregate_efficiency_timeseries(institution_cube, overlap_years)

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
                "Institution joins use exact legal-name matches, explicit legal-name aliases, and an audited short-name allowlist.",
                "Ambiguous short-name matches are excluded from efficiency outputs until they are manually audited.",
                "Institution-year outputs are allocated across matched funding counties in proportion to each county row's share of funding.",
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
        "blocked_funding_institutions": blocked_funding_institutions,
        "institution_cube": institution_cube,
        "timeseries": timeseries,
        "unmatched_funding_institutions": unmatched_funding_institutions,
    }

    write_output(Path(args.output), payload)


if __name__ == "__main__":
    main()
