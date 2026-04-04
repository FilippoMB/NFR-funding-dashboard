from __future__ import annotations

import argparse
import csv
import json
import re
import unicodedata
from collections import defaultdict
from datetime import datetime, timezone
from io import TextIOWrapper
from pathlib import Path
from typing import Any, Iterable
from urllib.request import urlopen

from county_utils import CURRENT_COUNTIES, county_tuple_from_code, county_tuple_from_name


OFFICIAL_SOURCE_URL = (
    "https://raw.githubusercontent.com/Forskningsradet/open-data/main/"
    "datasets/soknader2/dataset.csv"
)
OFFICIAL_SOURCE_PAGE = (
    "https://github.com/Forskningsradet/open-data/tree/main/datasets/soknader2"
)
OFFICIAL_SOURCE_LABEL = "Forskningsrådet open data"
RAW_RECORD_KEYS = {
    "prosjektnummer",
    "tildelt_belop",
    "kommunenummer",
    "fylkenummer",
    "fylke",
    "prosjektstart",
    "soknadsdato",
    "sokstart",
    "prosjektansvarlig_navn",
    "kortnavn",
}
AGGREGATED_RECORD_KEYS = {
    "allocated_nok",
    "year",
    "county_id",
    "county_name",
    "institution_id",
    "institution_name",
    "institution_short_name",
    "institution_legal_name",
    "scheme_id",
    "scheme_name",
    "subject_id",
    "subject_name",
    "project_count",
}
AGGREGATED_REQUIRED_KEYS = {"allocated_nok", "year", "county_name"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Aggregate NFR funding records into static dashboard JSON files."
    )
    parser.add_argument(
        "--input",
        help="Optional local JSON or CSV file. If omitted, the official CSV feed is used."
    )
    parser.add_argument(
        "--source-url",
        default=OFFICIAL_SOURCE_URL,
        help="Remote CSV URL to use when --input is omitted."
    )
    parser.add_argument(
        "--output",
        default="public/data",
        help="Directory where static dashboard JSON files will be written."
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


def parse_float(value: Any) -> float:
    text = clean_text(value).replace("\u00a0", "").replace(" ", "")

    if not text:
        return 0.0

    return float(text.replace(",", "."))


def parse_year(value: Any) -> int | None:
    text = clean_text(value)

    if not text:
        return None

    match = re.search(r"(19|20)\d{2}", text)

    if not match:
        return None

    year = int(match.group(0))
    current_year = datetime.now(timezone.utc).year

    if 1990 <= year <= current_year + 1:
        return year

    return None


def county_tuple_from_identifier(identifier: str) -> tuple[str, str] | None:
    county = county_tuple_from_code(identifier)

    if county:
        return county

    county = county_tuple_from_name(identifier)

    if county:
        return county

    normalized_identifier = slugify(identifier)
    for county_id, county_name in CURRENT_COUNTIES.items():
        if slugify(county_name) == normalized_identifier:
            return county_id, county_name

    return None


def detect_record_format(record: dict[str, Any]) -> str:
    has_raw_keys = any(key in record for key in RAW_RECORD_KEYS)
    has_aggregated_keys = any(key in record for key in AGGREGATED_RECORD_KEYS)

    if has_raw_keys and has_aggregated_keys:
        raise ValueError(
            "Ambiguous record format: found both raw funding fields and aggregated JSON fields."
        )

    if has_raw_keys:
        return "raw"

    if has_aggregated_keys:
        missing_keys = sorted(AGGREGATED_REQUIRED_KEYS - record.keys())

        if missing_keys:
            raise ValueError(
                "Aggregated JSON record is missing required fields: "
                + ", ".join(missing_keys)
            )

        return "aggregated"

    raise ValueError(
        "Unrecognized record format: expected either official funding fields or aggregated JSON fields."
    )


def resolve_county(record: dict[str, Any]) -> tuple[str, str] | None:
    municipality_code = re.sub(r"\D", "", clean_text(record.get("kommunenummer")))

    if len(municipality_code) >= 4:
        county = county_tuple_from_code(municipality_code[:2])

        if county:
            return county

    county = county_tuple_from_code(record.get("fylkenummer", ""))

    if county:
        return county

    return county_tuple_from_name(clean_text(record.get("fylke")))


def resolve_year(record: dict[str, Any]) -> int | None:
    for key in ("prosjektstart", "soknadsdato", "sokstart"):
        year = parse_year(record.get(key))

        if year is not None:
            return year

    return None


def resolve_institution(record: dict[str, Any]) -> tuple[str, str]:
    short_name = clean_text(record.get("kortnavn"))
    full_name = clean_text(record.get("prosjektansvarlig_navn"))
    institution_name = short_name or full_name or "Ukjent prosjektansvarlig"
    return slugify(institution_name), institution_name


def resolve_scheme(record: dict[str, Any]) -> tuple[str, str]:
    for key in ("hovedaktivitet", "aktivitet", "virkemiddel", "soknadstype"):
        value = clean_text(record.get(key))

        if value:
            return slugify(value), value

    return "ukjent-ordning", "Ukjent ordning"


def resolve_subject(record: dict[str, Any]) -> tuple[str, str]:
    for key in ("fagomraade", "fag", "fagdisiplin"):
        value = clean_text(record.get(key))

        if value:
            return slugify(value), value

    return "ukjent-fagomrade", "Ukjent fagområde"


def normalize_record(record: dict[str, Any]) -> dict[str, Any] | None:
    record_format = detect_record_format(record)

    if record_format == "aggregated":
        amount = parse_float(record.get("allocated_nok"))
        year = parse_year(record.get("year"))
        county_name = clean_text(record.get("county_name"))
        institution_name = clean_text(record.get("institution_name"))
        institution_short_name = (
            clean_text(record.get("institution_short_name"))
            or institution_name
        )
        institution_legal_name = (
            clean_text(record.get("institution_legal_name"))
            or institution_name
        )
        scheme_name = clean_text(record.get("scheme_name"))
        subject_name = clean_text(record.get("subject_name"))

        if amount <= 0 or year is None or not county_name:
            return None

        county = (
            county_tuple_from_identifier(clean_text(record.get("county_id")))
            or county_tuple_from_name(county_name)
        )

        if county is None:
            return None

        return {
            "countyId": county[0],
            "countyName": county[1],
            "id": clean_text(record.get("id")),
            "institutionId": clean_text(record.get("institution_id")) or slugify(institution_name),
            "institutionName": institution_name or "Ukjent prosjektansvarlig",
            "institutionShortName": institution_short_name or "Ukjent prosjektansvarlig",
            "institutionLegalName": institution_legal_name or "Ukjent prosjektansvarlig",
            "projectCount": int(record.get("project_count", 1)),
            "schemeId": clean_text(record.get("scheme_id")) or slugify(scheme_name),
            "schemeName": scheme_name or "Ukjent ordning",
            "subjectId": clean_text(record.get("subject_id")) or slugify(subject_name),
            "subjectName": subject_name or "Ukjent fagområde",
            "title": clean_text(record.get("title")) or f"Prosjekt {record.get('id', '')}",
            "totalFundingNok": int(round(amount)),
            "year": year
        }

    allocated_amount = parse_float(record.get("tildelt_belop"))

    if allocated_amount <= 0:
        return None

    county = resolve_county(record)
    year = resolve_year(record)

    if county is None or year is None:
        return None

    institution_id, institution_name = resolve_institution(record)
    institution_short_name = clean_text(record.get("kortnavn")) or institution_name
    institution_legal_name = clean_text(record.get("prosjektansvarlig_navn")) or institution_name
    scheme_id, scheme_name = resolve_scheme(record)
    subject_id, subject_name = resolve_subject(record)
    project_id = clean_text(record.get("prosjektnummer"))

    if not project_id:
        return None

    return {
        "countyId": county[0],
        "countyName": county[1],
        "id": project_id,
        "institutionId": institution_id,
        "institutionName": institution_name,
        "institutionShortName": institution_short_name,
        "institutionLegalName": institution_legal_name,
        "projectCount": 1,
        "schemeId": scheme_id,
        "schemeName": scheme_name,
        "subjectId": subject_id,
        "subjectName": subject_name,
        "title": clean_text(record.get("prosjekttittel")) or f"Prosjekt {project_id}",
        "totalFundingNok": int(round(allocated_amount)),
        "year": year
    }


def sort_options(items: set[tuple[str, str]]) -> list[dict[str, str]]:
    return [
        {"id": item_id, "label": label}
        for item_id, label in sorted(items, key=lambda entry: entry[1].lower())
    ]


def aggregate(
    normalized_records: list[dict[str, Any]],
    source_label: str,
    skipped_records: int
) -> dict[str, Any]:
    core_aggregates: dict[tuple[Any, ...], dict[str, Any]] = {}
    institution_slice_aggregates: dict[tuple[Any, ...], dict[str, Any]] = {}
    county_aggregates: dict[tuple[str, str], dict[str, Any]] = defaultdict(
        lambda: {"projectCount": 0, "totalFundingNok": 0}
    )
    timeseries_aggregates: dict[int, dict[str, Any]] = defaultdict(
        lambda: {"projectCount": 0, "totalFundingNok": 0}
    )
    dimension_totals = {
        "institutions": defaultdict(lambda: {"projectCount": 0, "totalFundingNok": 0}),
        "schemes": defaultdict(lambda: {"projectCount": 0, "totalFundingNok": 0}),
        "subjects": defaultdict(lambda: {"projectCount": 0, "totalFundingNok": 0})
    }

    county_options: set[tuple[str, str]] = set()
    scheme_options: set[tuple[str, str]] = set()
    subject_options: set[tuple[str, str]] = set()
    years = sorted({record["year"] for record in normalized_records})

    for record in normalized_records:
        county_options.add((record["countyId"], record["countyName"]))
        scheme_options.add((record["schemeId"], record["schemeName"]))
        subject_options.add((record["subjectId"], record["subjectName"]))

        core_key = (
            record["year"],
            record["countyId"],
            record["countyName"],
            record["schemeId"],
            record["schemeName"],
            record["subjectId"],
            record["subjectName"]
        )
        core_current = core_aggregates.get(core_key)

        if core_current is None:
            core_current = {
                "countyId": record["countyId"],
                "projectCount": 0,
                "schemeId": record["schemeId"],
                "subjectId": record["subjectId"],
                "totalFundingNok": 0,
                "year": record["year"]
            }
            core_aggregates[core_key] = core_current

        core_current["projectCount"] += record["projectCount"]
        core_current["totalFundingNok"] += record["totalFundingNok"]

        institution_key = (
            record["year"],
            record["countyId"],
            record["schemeId"],
            record["subjectId"],
            record["institutionId"],
            record["institutionName"],
            record["institutionShortName"],
            record["institutionLegalName"],
        )
        institution_current = institution_slice_aggregates.get(institution_key)

        if institution_current is None:
            institution_current = {
                "countyId": record["countyId"],
                "countyName": record["countyName"],
                "institutionId": record["institutionId"],
                "institutionName": record["institutionName"],
                "institutionShortName": record["institutionShortName"],
                "institutionLegalName": record["institutionLegalName"],
                "projectCount": 0,
                "schemeId": record["schemeId"],
                "subjectId": record["subjectId"],
                "totalFundingNok": 0,
                "year": record["year"]
            }
            institution_slice_aggregates[institution_key] = institution_current

        institution_current["projectCount"] += record["projectCount"]
        institution_current["totalFundingNok"] += record["totalFundingNok"]

        county_key = (record["countyId"], record["countyName"])
        county_aggregates[county_key]["projectCount"] += record["projectCount"]
        county_aggregates[county_key]["totalFundingNok"] += record["totalFundingNok"]

        timeseries_aggregates[record["year"]]["projectCount"] += record["projectCount"]
        timeseries_aggregates[record["year"]]["totalFundingNok"] += record["totalFundingNok"]

        for bucket_name, id_key, label_key in (
            ("institutions", "institutionId", "institutionName"),
            ("schemes", "schemeId", "schemeName"),
            ("subjects", "subjectId", "subjectName")
        ):
            bucket_id = record[id_key]
            dimension_totals[bucket_name][bucket_id]["id"] = bucket_id
            dimension_totals[bucket_name][bucket_id]["label"] = record[label_key]
            dimension_totals[bucket_name][bucket_id]["projectCount"] += record["projectCount"]
            dimension_totals[bucket_name][bucket_id]["totalFundingNok"] += record["totalFundingNok"]

    records = sorted(
        core_aggregates.values(),
        key=lambda record: (
            record["year"],
            record["countyId"],
            record["schemeId"],
            record["subjectId"]
        )
    )
    institution_records = sorted(
        institution_slice_aggregates.values(),
        key=lambda record: (
            record["year"],
            record["institutionName"],
            record["countyId"],
            record["schemeId"],
            record["subjectId"]
        )
    )
    total_funding = sum(record["totalFundingNok"] for record in normalized_records)
    total_projects = sum(record["projectCount"] for record in normalized_records)

    return {
        "funding_by_county": sorted(
            (
                {
                    "countyId": county_id,
                    "countyName": county_name,
                    "projectCount": values["projectCount"],
                    "totalFundingNok": values["totalFundingNok"]
                }
                for (county_id, county_name), values in county_aggregates.items()
            ),
            key=lambda item: item["totalFundingNok"],
            reverse=True
        ),
        "funding_by_dimension": {
            dimension: sorted(
                values.values(),
                key=lambda item: item["totalFundingNok"],
                reverse=True
            )[:6]
            for dimension, values in dimension_totals.items()
        },
        "funding_institution_cube": institution_records,
        "funding_cube": records,
        "funding_timeseries": [
            {
                "projectCount": values["projectCount"],
                "totalFundingNok": values["totalFundingNok"],
                "year": year
            }
            for year, values in sorted(timeseries_aggregates.items())
        ],
        "summary": {
            "filters": {
                "counties": sort_options(county_options),
                "schemes": sort_options(scheme_options),
                "subjects": sort_options(subject_options),
                "years": years
            },
            "latestYear": years[-1] if years else None,
            "notes": [
                "Institution counts reflect the registered project owner, not collaborators.",
                "Subject totals can overlap across themes and should not be summed as independent buckets.",
                "Funding scheme in this dashboard is based on Forskningsrådet's hovedaktivitet field.",
                "Year in this dashboard is based on project start year because the source exposes total grant per project, not annual disbursement."
            ],
            "projectCount": total_projects,
            "recordCountSkipped": skipped_records,
            "source": {
                "label": source_label,
                "officialPage": OFFICIAL_SOURCE_PAGE
            },
            "totalFundingNok": total_funding
        }
    }


def write_output(output_dir: Path, payload: dict[str, Any]) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)

    for file_name, key in (
        ("summary.json", "summary"),
        ("funding_by_county.json", "funding_by_county"),
        ("funding_timeseries.json", "funding_timeseries"),
        ("funding_by_dimension.json", "funding_by_dimension"),
        ("funding_institution_cube.json", "funding_institution_cube"),
        ("funding_cube.json", "funding_cube")
    ):
        output_path = output_dir / file_name
        output_path.write_text(
            json.dumps(
                payload[key],
                ensure_ascii=False,
                separators=(",", ":"),
                sort_keys=True
            )
            + "\n",
            encoding="utf-8"
        )


def iter_json_records(path: Path) -> Iterable[dict[str, Any]]:
    payload = json.loads(path.read_text(encoding="utf-8"))

    if isinstance(payload, list):
        yield from payload
        return

    if isinstance(payload, dict):
        for key in ("records", "results", "items", "projects", "data"):
            value = payload.get(key)
            if isinstance(value, list):
                yield from value
                return

    raise ValueError("Could not find a list of records in the provided JSON payload.")


def iter_csv_records_from_local(path: Path) -> Iterable[dict[str, Any]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        yield from csv.DictReader(handle)


def iter_csv_records_from_url(url: str) -> Iterable[dict[str, Any]]:
    with urlopen(url) as response:
        text_stream = TextIOWrapper(response, encoding="utf-8-sig", newline="")
        yield from csv.DictReader(text_stream)


def load_records(args: argparse.Namespace) -> tuple[Iterable[dict[str, Any]], str]:
    if args.input:
        input_path = Path(args.input)
        suffix = input_path.suffix.lower()

        if suffix == ".json":
            return iter_json_records(input_path), str(input_path)

        if suffix == ".csv":
            return iter_csv_records_from_local(input_path), str(input_path)

        raise ValueError(f"Unsupported input format: {input_path.suffix}")

    return iter_csv_records_from_url(args.source_url), OFFICIAL_SOURCE_LABEL


def main() -> None:
    args = parse_args()
    source_records, source_label = load_records(args)
    normalized_records: list[dict[str, Any]] = []
    skipped_records = 0

    for index, record in enumerate(source_records, start=1):
        try:
            normalized = normalize_record(record)
        except ValueError as error:
            raise ValueError(f"Invalid record at position {index} from {source_label}: {error}") from error

        if normalized is None:
            skipped_records += 1
            continue

        normalized_records.append(normalized)

    aggregated_payload = aggregate(
        normalized_records=normalized_records,
        source_label=source_label,
        skipped_records=skipped_records
    )
    write_output(Path(args.output), aggregated_payload)


if __name__ == "__main__":
    main()
