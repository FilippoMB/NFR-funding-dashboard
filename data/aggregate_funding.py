from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path
from typing import Any
from urllib.request import urlopen


FIELD_ALIASES = {
    "allocated_nok": ["allocated_nok", "amount_nok", "grant_amount", "funding_nok"],
    "county_id": ["county_id", "countyId", "fylke_id"],
    "county_name": ["county_name", "county", "fylke", "countyName"],
    "id": ["id", "project_id", "projectId"],
    "institution_id": ["institution_id", "institutionId", "organisation_id"],
    "institution_name": ["institution_name", "institution", "organisation"],
    "scheme_id": ["scheme_id", "schemeId", "funding_scheme_id"],
    "scheme_name": ["scheme_name", "scheme", "funding_scheme"],
    "subject_id": ["subject_id", "subjectId", "field_id"],
    "subject_name": ["subject_name", "subject", "field_name"],
    "title": ["title", "project_title"],
    "year": ["year", "project_year"]
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Aggregate funding records into static dashboard JSON files."
    )
    parser.add_argument(
        "--input",
        default="data/mock_projects.json",
        help="Path to a local JSON file containing project records."
    )
    parser.add_argument(
        "--source-url",
        help="Optional remote JSON endpoint. When provided it overrides --input."
    )
    parser.add_argument(
        "--output",
        default="public/data",
        help="Directory where static dashboard JSON files will be written."
    )
    return parser.parse_args()


def load_payload(args: argparse.Namespace) -> Any:
    if args.source_url:
        with urlopen(args.source_url) as response:
            return json.loads(response.read().decode("utf-8"))

    return json.loads(Path(args.input).read_text(encoding="utf-8"))


def extract_records(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return payload

    if isinstance(payload, dict):
        for key in ("records", "results", "items", "projects", "data"):
            value = payload.get(key)
            if isinstance(value, list):
                return value

    raise ValueError("Could not find a list of records in the provided JSON payload.")


def pick_value(record: dict[str, Any], field_name: str) -> Any:
    for alias in FIELD_ALIASES[field_name]:
        if alias in record:
            return record[alias]

    raise KeyError(f"Missing required field '{field_name}' in record: {record}")


def slugify(value: str) -> str:
    replacements = {
        "å": "a",
        "ø": "o",
        "æ": "ae",
        "Å": "a",
        "Ø": "o",
        "Æ": "ae"
    }
    normalized = "".join(replacements.get(character, character) for character in value)
    return (
        normalized.strip()
        .lower()
        .replace("&", "and")
        .replace("/", "-")
        .replace(" ", "-")
    )


def normalize_record(record: dict[str, Any]) -> dict[str, Any]:
    county_name = str(pick_value(record, "county_name")).strip()
    institution_name = str(pick_value(record, "institution_name")).strip()
    scheme_name = str(pick_value(record, "scheme_name")).strip()
    subject_name = str(pick_value(record, "subject_name")).strip()

    return {
        "countyId": str(record.get("county_id") or slugify(county_name)),
        "countyName": county_name,
        "id": str(pick_value(record, "id")),
        "institutionId": str(record.get("institution_id") or slugify(institution_name)),
        "institutionName": institution_name,
        "projectCount": int(record.get("project_count", 1)),
        "schemeId": str(record.get("scheme_id") or slugify(scheme_name)),
        "schemeName": scheme_name,
        "subjectId": str(record.get("subject_id") or slugify(subject_name)),
        "subjectName": subject_name,
        "title": str(pick_value(record, "title")),
        "totalFundingNok": int(float(pick_value(record, "allocated_nok"))),
        "year": int(pick_value(record, "year"))
    }


def sort_options(items: set[tuple[str, str]]) -> list[dict[str, str]]:
    return [
        {"id": item_id, "label": label}
        for item_id, label in sorted(items, key=lambda entry: entry[1].lower())
    ]


def aggregate(normalized_records: list[dict[str, Any]]) -> dict[str, Any]:
    records = sorted(
        normalized_records,
        key=lambda record: (
            record["year"],
            record["countyName"],
            record["institutionName"],
            record["schemeName"],
            record["subjectName"]
        )
    )
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
    institution_options: set[tuple[str, str]] = set()
    scheme_options: set[tuple[str, str]] = set()
    subject_options: set[tuple[str, str]] = set()
    years = sorted({record["year"] for record in records})

    for record in records:
        county_options.add((record["countyId"], record["countyName"]))
        institution_options.add((record["institutionId"], record["institutionName"]))
        scheme_options.add((record["schemeId"], record["schemeName"]))
        subject_options.add((record["subjectId"], record["subjectName"]))

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

    total_funding = sum(record["totalFundingNok"] for record in records)
    total_projects = sum(record["projectCount"] for record in records)

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
                "institutions": sort_options(institution_options),
                "schemes": sort_options(scheme_options),
                "subjects": sort_options(subject_options),
                "years": years
            },
            "latestYear": years[-1] if years else None,
            "notes": [
                "Institution counts reflect the registered project owner, not collaborators.",
                "Subject totals can overlap across themes and should not be summed as independent buckets.",
                "The current dashboard dataset is a mocked static extract prepared for UI development."
            ],
            "projectCount": total_projects,
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
        ("funding_cube.json", "funding_cube")
    ):
        output_path = output_dir / file_name
        output_path.write_text(
            json.dumps(payload[key], ensure_ascii=False, indent=2, sort_keys=True) + "\n",
            encoding="utf-8"
        )


def main() -> None:
    args = parse_args()
    payload = load_payload(args)
    records = extract_records(payload)
    normalized_records = [normalize_record(record) for record in records]
    aggregated_payload = aggregate(normalized_records)
    write_output(Path(args.output), aggregated_payload)


if __name__ == "__main__":
    main()
