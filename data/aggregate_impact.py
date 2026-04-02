from __future__ import annotations

import argparse
import json
import os
import re
import time
import unicodedata
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen


OPENALEX_API_URL = "https://api.openalex.org/institutions"
OPENALEX_DOCS_URL = "https://docs.openalex.org/"
OPENALEX_SOURCE_LABEL = "OpenAlex institutions API"
DEFAULT_OUTPUT_DIR = "public/data/impact"

CURRENT_COUNTIES = {
    "03": "Oslo",
    "11": "Rogaland",
    "15": "Møre og Romsdal",
    "18": "Nordland",
    "31": "Østfold",
    "32": "Akershus",
    "33": "Buskerud",
    "34": "Innlandet",
    "39": "Vestfold",
    "40": "Telemark",
    "42": "Agder",
    "46": "Vestland",
    "50": "Trøndelag",
    "55": "Troms",
    "56": "Finnmark",
}

LEGACY_COUNTY_NAMES = {
    "Akershus": "Akershus",
    "Agder": "Agder",
    "Aust-Agder": "Agder",
    "Buskerud": "Buskerud",
    "Finnmark": "Finnmark",
    "Finnmark - Finnmárku - Finmarkku": "Finnmark",
    "Hedmark": "Innlandet",
    "Hordaland": "Vestland",
    "Innlandet": "Innlandet",
    "Møre og Romsdal": "Møre og Romsdal",
    "Nord-Trøndelag": "Trøndelag",
    "Nordland": "Nordland",
    "Nordland - Nordlánnda": "Nordland",
    "Oppland": "Innlandet",
    "Oslo": "Oslo",
    "Rogaland": "Rogaland",
    "Sogn og Fjordane": "Vestland",
    "Sør-Trøndelag": "Trøndelag",
    "Telemark": "Telemark",
    "Troms": "Troms",
    "Troms - Romsa - Tromssa": "Troms",
    "Troms og Finnmark": None,
    "Trøndelag": "Trøndelag",
    "Trøndelag - Trööndelage": "Trøndelag",
    "Vest-Agder": "Agder",
    "Vestfold": "Vestfold",
    "Vestfold og Telemark": None,
    "Vestland": "Vestland",
    "Viken": None,
    "Østfold": "Østfold",
}

CITY_TO_COUNTY = {
    "Alta": "Finnmark",
    "Arendal": "Agder",
    "As": "Akershus",
    "Asker": "Akershus",
    "Billingstad": "Akershus",
    "Bø": "Telemark",
    "Ålesund": "Møre og Romsdal",
    "Bergen": "Vestland",
    "Bodo": "Nordland",
    "Bodø": "Nordland",
    "Brumunddal": "Innlandet",
    "Drammen": "Buskerud",
    "Elverum": "Innlandet",
    "Førde": "Vestland",
    "Fredrikstad": "Østfold",
    "Fornebu": "Akershus",
    "Gjovik": "Innlandet",
    "Gjøvik": "Innlandet",
    "Grimstad": "Agder",
    "Halden": "Østfold",
    "Hamar": "Innlandet",
    "Harstad": "Troms",
    "Haugesund": "Rogaland",
    "Kjeller": "Akershus",
    "Kongsberg": "Buskerud",
    "Kristiansand": "Agder",
    "Levanger": "Trøndelag",
    "Lillehammer": "Innlandet",
    "Lillestrom": "Akershus",
    "Lillestrøm": "Akershus",
    "Molde": "Møre og Romsdal",
    "Moss": "Østfold",
    "Narvik": "Nordland",
    "Namsos": "Trøndelag",
    "Nesoddtangen": "Akershus",
    "Oslo": "Oslo",
    "Porsgrunn": "Telemark",
    "Sandnes": "Rogaland",
    "Sandvika": "Akershus",
    "Sarpsborg": "Østfold",
    "Sogndal": "Vestland",
    "Stavanger": "Rogaland",
    "Steinkjer": "Trøndelag",
    "Stjørdal": "Trøndelag",
    "Tananger": "Rogaland",
    "Tonsberg": "Vestfold",
    "Tromso": "Troms",
    "Tromsø": "Troms",
    "Trondheim": "Trøndelag",
    "Tønsberg": "Vestfold",
    "Volda": "Møre og Romsdal",
    "Lakselv": "Finnmark",
    "Myre": "Nordland",
}

INSTITUTION_OVERRIDES = {
    "norwegian university of science and technology": "Trøndelag",
    "ntnu": "Trøndelag",
    "university of oslo": "Oslo",
    "uio": "Oslo",
    "university of bergen": "Vestland",
    "uib": "Vestland",
    "university of stavanger": "Rogaland",
    "uis": "Rogaland",
    "uit the arctic university of norway": "Troms",
    "uit": "Troms",
    "norwegian university of life sciences": "Akershus",
    "nmbu": "Akershus",
    "oslo university hospital": "Oslo",
    "ous": "Oslo",
    "oslo metropolitan university": "Oslo",
    "oslomet": "Oslo",
    "simula research laboratory": "Oslo",
    "simula": "Oslo",
    "sintef": "Trøndelag",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Fetch Norwegian publication and citation impact data from OpenAlex."
    )
    parser.add_argument(
        "--api-key",
        default=os.environ.get("OPENALEX_API_KEY"),
        help="OpenAlex API key. Defaults to OPENALEX_API_KEY."
    )
    parser.add_argument(
        "--mailto",
        default=os.environ.get("OPENALEX_EMAIL"),
        help="Optional email for OpenAlex's polite pool. Defaults to OPENALEX_EMAIL."
    )
    parser.add_argument(
        "--country-code",
        default="NO",
        help="Two-letter country code to fetch institutions for. Defaults to NO."
    )
    parser.add_argument(
        "--output",
        default=DEFAULT_OUTPUT_DIR,
        help=f"Directory where static impact JSON files will be written. Defaults to {DEFAULT_OUTPUT_DIR}."
    )
    parser.add_argument(
        "--per-page",
        type=int,
        default=200,
        help="Number of institutions per page. OpenAlex allows up to 200."
    )
    parser.add_argument(
        "--max-pages",
        type=int,
        help="Optional page limit for testing."
    )
    parser.add_argument(
        "--min-works",
        type=int,
        default=1,
        help="Minimum lifetime works_count for institutions to include."
    )
    return parser.parse_args()


def clean_text(value: Any) -> str:
    return " ".join(str(value or "").split())


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFD", clean_text(value))
    normalized = "".join(
        character
        for character in normalized
        if unicodedata.category(character) != "Mn"
    )
    normalized = normalized.lower()
    normalized = re.sub(r"[^a-z0-9]+", "-", normalized).strip("-")
    return normalized


def ascii_fold(value: str) -> str:
    normalized = unicodedata.normalize("NFD", clean_text(value))
    normalized = "".join(
        character
        for character in normalized
        if unicodedata.category(character) != "Mn"
    )
    return normalized


def normalize_county_name(name: str) -> str | None:
    if not name:
        return None

    if name in LEGACY_COUNTY_NAMES:
        return LEGACY_COUNTY_NAMES[name]

    short_name = name.split(" - ")[0]
    if short_name in LEGACY_COUNTY_NAMES:
        return LEGACY_COUNTY_NAMES[short_name]

    if short_name in CURRENT_COUNTIES.values():
        return short_name

    return None


def county_tuple_from_name(name: str | None) -> tuple[str, str] | None:
    current_name = normalize_county_name(clean_text(name))

    if not current_name:
        return None

    for county_id, county_name in CURRENT_COUNTIES.items():
        if county_name == current_name:
            return county_id, county_name

    return None


def extract_openalex_key(value: str) -> str:
    path = urlparse(value).path.rstrip("/")
    return path.split("/")[-1] if path else value


def build_headers() -> dict[str, str]:
    return {
        "Accept": "application/json",
        "User-Agent": "NFR-funding-dashboard/1.0 (+local static data pipeline)",
    }


def fetch_json(url: str, max_attempts: int = 5) -> dict[str, Any]:
    last_error: Exception | None = None

    for attempt in range(1, max_attempts + 1):
        try:
            request = Request(url, headers=build_headers())
            with urlopen(request, timeout=60) as response:
                return json.load(response)
        except HTTPError as error:
            last_error = error

            if error.code in (429, 500, 502, 503, 504) and attempt < max_attempts:
                retry_after = error.headers.get("Retry-After")
                delay = int(retry_after) if retry_after and retry_after.isdigit() else attempt * 2
                time.sleep(delay)
                continue

            raise
        except URLError as error:
            last_error = error

            if attempt < max_attempts:
                time.sleep(attempt * 2)
                continue

            raise

    raise RuntimeError(f"Failed to fetch {url}: {last_error}")


def build_request_url(args: argparse.Namespace, cursor: str) -> str:
    params = {
        "cursor": cursor,
        "filter": f"country_code:{args.country_code}",
        "per-page": str(args.per_page),
        "select": ",".join(
            (
                "id",
                "display_name",
                "display_name_acronyms",
                "geo",
                "ids",
                "counts_by_year",
                "works_count",
                "cited_by_count",
                "summary_stats",
            )
        ),
    }

    if args.api_key:
        params["api_key"] = args.api_key

    if args.mailto:
        params["mailto"] = args.mailto

    return f"{OPENALEX_API_URL}?{urlencode(params)}"


def iter_institutions(args: argparse.Namespace) -> list[dict[str, Any]]:
    institutions: list[dict[str, Any]] = []
    cursor = "*"
    pages_fetched = 0

    while cursor:
        url = build_request_url(args, cursor)
        payload = fetch_json(url)
        results = payload.get("results", [])

        for institution in results:
            if int(institution.get("works_count") or 0) < args.min_works:
                continue

            institutions.append(institution)

        pages_fetched += 1

        if args.max_pages and pages_fetched >= args.max_pages:
            break

        cursor = payload.get("meta", {}).get("next_cursor")

    return institutions


def resolve_institution_county(institution: dict[str, Any]) -> tuple[str | None, str | None, str | None]:
    display_name = clean_text(institution.get("display_name"))
    display_key = slugify(display_name).replace("-", " ")
    acronym_values = institution.get("display_name_acronyms") or []
    acronym = clean_text(acronym_values[0]) if acronym_values else ""
    acronym_key = slugify(acronym).replace("-", " ") if acronym else ""

    for override_key in filter(None, (display_key, acronym_key)):
        county_name = INSTITUTION_OVERRIDES.get(override_key)

        if county_name:
            county = county_tuple_from_name(county_name)
            if county:
                return county[0], county[1], "institution_override"

    geo = institution.get("geo") or {}
    region = clean_text(geo.get("region"))
    region_county = county_tuple_from_name(region)

    if region_county:
        return region_county[0], region_county[1], "geo.region"

    city = clean_text(geo.get("city"))
    folded_city = ascii_fold(city)
    city_county_name = CITY_TO_COUNTY.get(city) or CITY_TO_COUNTY.get(folded_city)

    if city_county_name:
        city_county = county_tuple_from_name(city_county_name)
        if city_county:
            return city_county[0], city_county[1], "geo.city"

    return None, None, None


def normalize_institution(institution: dict[str, Any]) -> dict[str, Any]:
    institution_id = extract_openalex_key(clean_text(institution.get("id")))
    institution_name = clean_text(institution.get("display_name")) or institution_id
    county_id, county_name, mapping_source = resolve_institution_county(institution)
    counts_by_year = institution.get("counts_by_year") or []
    geo = institution.get("geo") or {}
    summary_stats = institution.get("summary_stats") or {}
    ids = institution.get("ids") or {}

    year_rows = []
    paper_count_window = 0
    citation_count_window = 0

    for item in counts_by_year:
        year = item.get("year")
        works_count = int(item.get("works_count") or 0)
        cited_by_count = int(item.get("cited_by_count") or 0)

        if not isinstance(year, int):
            continue

        current_year = datetime.now(timezone.utc).year
        if year < 1990 or year > current_year:
            continue

        if works_count == 0 and cited_by_count == 0:
            continue

        paper_count_window += works_count
        citation_count_window += cited_by_count
        year_rows.append(
            {
                "citationCount": cited_by_count,
                "countyId": county_id,
                "countyName": county_name,
                "institutionId": institution_id,
                "institutionName": institution_name,
                "paperCount": works_count,
                "year": year,
            }
        )

    year_rows.sort(key=lambda item: item["year"])

    return {
        "city": clean_text(geo.get("city")),
        "citationCount": citation_count_window,
        "citationCountLifetime": int(institution.get("cited_by_count") or 0),
        "citationsPerPaper": (
            citation_count_window / paper_count_window if paper_count_window else 0.0
        ),
        "countryCode": clean_text(geo.get("country_code")),
        "countyId": county_id,
        "countyName": county_name,
        "hIndex": int(summary_stats.get("h_index") or 0),
        "i10Index": int(summary_stats.get("i10_index") or 0),
        "id": institution_id,
        "mappingSource": mapping_source,
        "name": institution_name,
        "openalexId": clean_text(institution.get("id")),
        "paperCount": paper_count_window,
        "region": clean_text(geo.get("region")),
        "ror": clean_text(ids.get("ror")),
        "twoYearMeanCitedness": float(summary_stats.get("2yr_mean_citedness") or 0.0),
        "worksCountLifetime": int(institution.get("works_count") or 0),
        "yearlyMetrics": year_rows,
    }


def aggregate(institutions: list[dict[str, Any]], source_label: str) -> dict[str, Any]:
    normalized_institutions = [normalize_institution(item) for item in institutions]
    filtered_institutions = [item for item in normalized_institutions if item["paperCount"] > 0]

    years = sorted(
        {
            row["year"]
            for institution in filtered_institutions
            for row in institution["yearlyMetrics"]
        }
    )

    county_totals: dict[tuple[str, str], dict[str, Any]] = defaultdict(
        lambda: {"citationCount": 0, "institutionIds": set(), "paperCount": 0}
    )
    year_totals: dict[int, dict[str, int]] = defaultdict(
        lambda: {"citationCount": 0, "paperCount": 0}
    )
    institution_cube: list[dict[str, Any]] = []

    for institution in filtered_institutions:
        for year_row in institution["yearlyMetrics"]:
            institution_cube.append(year_row)
            year_totals[year_row["year"]]["paperCount"] += year_row["paperCount"]
            year_totals[year_row["year"]]["citationCount"] += year_row["citationCount"]

            if institution["countyId"] and institution["countyName"]:
                key = (institution["countyId"], institution["countyName"])
                county_totals[key]["paperCount"] += year_row["paperCount"]
                county_totals[key]["citationCount"] += year_row["citationCount"]
                county_totals[key]["institutionIds"].add(institution["id"])

    institutions_by_impact = sorted(
        (
            {
                "citationCount": institution["citationCount"],
                "citationsPerPaper": institution["citationsPerPaper"],
                "countyId": institution["countyId"],
                "countyName": institution["countyName"],
                "hIndex": institution["hIndex"],
                "i10Index": institution["i10Index"],
                "id": institution["id"],
                "label": institution["name"],
                "mappingSource": institution["mappingSource"],
                "paperCount": institution["paperCount"],
                "ror": institution["ror"],
                "twoYearMeanCitedness": institution["twoYearMeanCitedness"],
                "worksCountLifetime": institution["worksCountLifetime"],
                "citationCountLifetime": institution["citationCountLifetime"],
            }
            for institution in filtered_institutions
        ),
        key=lambda item: (item["citationCount"], item["paperCount"], item["label"]),
        reverse=True,
    )

    unmapped_institutions = sorted(
        (
            {
                "city": institution["city"],
                "citationCount": institution["citationCount"],
                "id": institution["id"],
                "label": institution["name"],
                "paperCount": institution["paperCount"],
                "region": institution["region"],
                "ror": institution["ror"],
            }
            for institution in filtered_institutions
            if not institution["countyId"]
        ),
        key=lambda item: (item["paperCount"], item["citationCount"], item["label"]),
        reverse=True,
    )

    paper_count_total = sum(item["paperCount"] for item in institutions_by_impact)
    citation_count_total = sum(item["citationCount"] for item in institutions_by_impact)
    mapped_paper_count = sum(
        item["paperCount"] for item in institutions_by_impact if item["countyId"]
    )
    mapped_citation_count = sum(
        item["citationCount"] for item in institutions_by_impact if item["countyId"]
    )

    return {
        "summary": {
            "filters": {
                "counties": [
                    {"id": county_id, "label": county_name}
                    for county_id, county_name in CURRENT_COUNTIES.items()
                ],
                "years": years,
            },
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "institutionCount": len(institutions_by_impact),
            "institutionCountMapped": sum(1 for item in institutions_by_impact if item["countyId"]),
            "institutionCountUnmapped": sum(1 for item in institutions_by_impact if not item["countyId"]),
            "latestYear": years[-1] if years else None,
            "notes": [
                "OpenAlex institution counts_by_year covers the last ten years only; totals in this dataset are limited to that window.",
                "Citation counts reflect citations received in each year by works affiliated with the institution, not citations to papers published in that same year.",
                "Regional totals are derived from institution geography in OpenAlex and may require manual overrides for some organizations.",
            ],
            "paperCount": paper_count_total,
            "citationCount": citation_count_total,
            "mappedPaperCount": mapped_paper_count,
            "mappedCitationCount": mapped_citation_count,
            "mappingCoverageByPapers": (
                mapped_paper_count / paper_count_total if paper_count_total else 0.0
            ),
            "mappingCoverageByCitations": (
                mapped_citation_count / citation_count_total if citation_count_total else 0.0
            ),
            "source": {
                "label": source_label,
                "officialPage": OPENALEX_DOCS_URL,
            },
        },
        "by_county": sorted(
            (
                {
                    "citationCount": values["citationCount"],
                    "citationsPerPaper": (
                        values["citationCount"] / values["paperCount"]
                        if values["paperCount"]
                        else 0.0
                    ),
                    "countyId": county_id,
                    "countyName": county_name,
                    "institutionCount": len(values["institutionIds"]),
                    "paperCount": values["paperCount"],
                }
                for (county_id, county_name), values in county_totals.items()
            ),
            key=lambda item: (item["citationCount"], item["paperCount"], item["countyName"]),
            reverse=True,
        ),
        "by_institution": institutions_by_impact,
        "institutions": sorted(
            (
                {
                    "city": institution["city"],
                    "countyId": institution["countyId"],
                    "countyName": institution["countyName"],
                    "hIndex": institution["hIndex"],
                    "i10Index": institution["i10Index"],
                    "id": institution["id"],
                    "mappingSource": institution["mappingSource"],
                    "name": institution["name"],
                    "openalexId": institution["openalexId"],
                    "paperCount": institution["paperCount"],
                    "citationCount": institution["citationCount"],
                    "region": institution["region"],
                    "ror": institution["ror"],
                    "twoYearMeanCitedness": institution["twoYearMeanCitedness"],
                    "worksCountLifetime": institution["worksCountLifetime"],
                    "citationCountLifetime": institution["citationCountLifetime"],
                }
                for institution in filtered_institutions
            ),
            key=lambda item: item["name"].lower(),
        ),
        "timeseries": [
            {
                "citationCount": values["citationCount"],
                "citationsPerPaper": (
                    values["citationCount"] / values["paperCount"]
                    if values["paperCount"]
                    else 0.0
                ),
                "paperCount": values["paperCount"],
                "year": year,
            }
            for year, values in sorted(year_totals.items())
        ],
        "institution_cube": sorted(
            institution_cube,
            key=lambda item: (
                item["year"],
                item["institutionName"].lower(),
                item["countyId"] or "",
            ),
        ),
        "unmapped_institutions": unmapped_institutions,
    }


def write_output(output_dir: Path, payload: dict[str, Any]) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)

    for file_name, key in (
        ("summary.json", "summary"),
        ("by_county.json", "by_county"),
        ("by_institution.json", "by_institution"),
        ("institutions.json", "institutions"),
        ("timeseries.json", "timeseries"),
        ("institution_cube.json", "institution_cube"),
        ("unmapped_institutions.json", "unmapped_institutions"),
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
    institutions = iter_institutions(args)
    aggregated_payload = aggregate(institutions, OPENALEX_SOURCE_LABEL)
    write_output(Path(args.output), aggregated_payload)


if __name__ == "__main__":
    main()
