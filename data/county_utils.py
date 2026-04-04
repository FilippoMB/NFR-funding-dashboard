from __future__ import annotations

import re
from typing import Any


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

LEGACY_COUNTY_CODES = {
    "01": "Østfold",
    "02": "Akershus",
    "03": "Oslo",
    "04": "Innlandet",
    "05": "Innlandet",
    "06": "Buskerud",
    "07": "Vestfold",
    "08": "Telemark",
    "09": "Agder",
    "10": "Agder",
    "11": "Rogaland",
    "12": "Vestland",
    "14": "Vestland",
    "15": "Møre og Romsdal",
    "16": "Trøndelag",
    "17": "Trøndelag",
    "18": "Nordland",
    "19": "Troms",
    "20": "Finnmark",
    "30": None,
    "50": "Trøndelag",
    "54": None,
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


def clean_text(value: Any) -> str:
    return " ".join(str(value or "").split())


def normalize_county_name(name: str) -> str | None:
    if not name:
        return None

    if name in LEGACY_COUNTY_NAMES:
        return LEGACY_COUNTY_NAMES[name]

    short_name = name.split(" - ")[0]
    return LEGACY_COUNTY_NAMES.get(
        short_name,
        short_name if short_name in CURRENT_COUNTIES.values() else None,
    )


def county_tuple_from_name(name: str) -> tuple[str, str] | None:
    current_name = normalize_county_name(clean_text(name))

    if not current_name:
        return None

    for county_id, county_name in CURRENT_COUNTIES.items():
        if county_name == current_name:
            return county_id, county_name

    return None


def county_tuple_from_code(code: str) -> tuple[str, str] | None:
    normalized_code = re.sub(r"\D", "", clean_text(code)).zfill(2)

    if normalized_code in CURRENT_COUNTIES:
        return normalized_code, CURRENT_COUNTIES[normalized_code]

    mapped_name = LEGACY_COUNTY_CODES.get(normalized_code)
    return county_tuple_from_name(mapped_name) if mapped_name else None
