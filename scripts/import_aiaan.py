#!/usr/bin/env python3
"""
Import AIAAN Excel flight data into Supabase database.

Usage:
    python3 scripts/import_aiaan.py              # Full import
    python3 scripts/import_aiaan.py --dry-run    # Preview only
    python3 scripts/import_aiaan.py --limit 100  # First 100 rows
"""

import argparse
import datetime
import json
import os
import sys
import time
from collections import defaultdict
from pathlib import Path

import requests

try:
    import openpyxl
except ImportError:
    print("ERROR: openpyxl is required. Install with: pip install openpyxl")
    sys.exit(1)

# ============================================================
# Configuration
# ============================================================

MGMT_TOKEN = "sbp_c8d01ec2c738bc1a6a9481b734a932cdcd6b18da"
PROJECT_REF = "glernwcsuwcyzwsnelad"

AEROPORTO_OPERACAO = "FNBJ"
AEROPORTO_ID = "6e7152b0-a0ef-4112-834d-e71c9e4f2e1f"
EMPRESA_ID = "031274b1-d4eb-42a6-8080-44c0bb31a455"
TIPO_VOO = "Regular"
STATUS = "Realizado"
ORIGEM_DADOS = "AIAAN_IMPORT"
CREATED_BY = "marciosager"  # Username format (not UUID)

EXCEL_PATH = os.path.join(os.path.dirname(__file__), "..", "docs", "AIAAN VOOS 2025.xlsx")
SHEET_NAME = "AIAAN VOOS 2025"

BATCH_SIZE = 50
BATCH_DELAY = 1  # seconds between batches to avoid API rate limits

# ============================================================
# City -> ICAO mapping
# ============================================================

CITY_TO_ICAO = {
    "CABINDA": "FNCA", "CATUMBELA": "FNCT", "LUBANGO": "FNUB", "SAURIMO": "FNSA",
    "SOYO": "FNSO", "HUAMBO": "FNHU", "NAMIBE": "FNMO", "ONDJIVA": "FNGI",
    "LUENA": "FNUE", "MENONGUE": "FNME", "DUNDO": "FNDU", "KUITO": "FNKU",
    "CUITO": "FNKU", "LUANDA": "FNLU", "BOM JESUS": "FNBJ",
    "JOHANNESBURG": "FAOR", "JOHANESBURGO": "FAOR", "JOHANESBURGOO": "FAOR",
    "JOHANNESBURGO": "FAOR", "JOANESBURGO": "FAOR",
    "CAPE TOWN": "FACT", "CAPETOWN": "FACT",
    "LAGOS": "DNMM", "MAPUTO": "FQMA",
    "ADDIS ABEBA": "HAAB", "ADDIS ABABA": "HAAB", "ADDIS-ABEBA": "HAAB",
    "ADIS ABEBA": "HAAB", "ETHIOPIA": "HAAB",
    "NAIROBI": "HKJK", "WINDHOEK": "FYWH", "KINSHASA": "FZAA",
    "BRAZZAVILLE": "FCBB", "BRAZAVILLE": "FCBB",
    "PONTA NEGRA": "FCPP", "PONTA-NEGRA": "FCPP",
    "CASABLANCA": "GMMN", "CASA BLANCA": "GMMN",
    "PORT HARCOURT": "DNPO", "PORTO HARCOURT": "DNPO",
    "ACCRA": "DGAA", "ABIDJAN": "DIAP", "LANSERIA": "FALA", "LUSAKA": "FLKK",
    "MAUN": "FBMN", "BANGUI": "FEFF", "DOUALA": "FKKD", "COTONOU": "DBBB",
    "ENTEBBE": "HUEN", "KANO": "DNKN", "CAIRO": "HECA", "MALABO": "FGSL",
    "NIAMEY": "DRRN", "HARARE": "FVHA", "HARGEISA": "HCMH",
    "LISBOA": "LPPT", "PARIS": "LFPG", "FRANKFURT": "EDDF", "PORTO": "LPPR",
    "ISTAMBUL": "LTFM", "ISTANBUL": "LTFM", "FARO": "LPFR", "ALICANTE": "LEAL",
    "BEIRUT": "OLBA", "DUBAI": "OMDB", "DOHA": "OTHH", "SHARJAH": "OMSJ",
    "JEDDAH": "OEJN", "BAKU": "UBBB", "ABU-DABI": "OMAA",
    "HONG KONG": "VHHH", "KUALA LUMPUR": "WMKK",
    "HAVANA": "MUHA", "VICTORVILLE": "KVCV",
    "NIGERIA": "DNMM",
    # Unicode-safe versions
    "MOCAMEDES": "FNMO", "MO\u00c7\u00c2MEDES": "FNMO",
    "SAO PAULO": "SBGR", "S\u00c3O PAULO": "SBGR",
    "SAO TOME": "FPST", "S\u00c3O TOM\u00c9": "FPST",
    "LOME": "DXXX", "LOM\u00c9": "DXXX",
    "LIEGE": "EBLG", "LI\u00c8GE": "EBLG",
    "N'DJAMENA": "FTTJ", "NDJAMENA": "FTTJ", "N\u00c9DJAMENA": "FTTJ", "N\u00b4DJAMENA": "FTTJ",
    "GUARULHOS": "SBGR", "GUARULHO": "SBGR",
    "BHISHO BULEMBO": "FABE", "EVERET,EUA": "KPAE",
    "REPUBLICA CENTRO AFRICANA": "FEFF",
}

# ============================================================
# Operator -> ICAO code mapping
# ============================================================

OPERATOR_TO_ICAO = {
    "TAAG": "DT", "TAP AIR PORTUGAL": "TP", "TAP": "TP",
    "ETHIOPIAN AIRLINES": "ET", "ETHIOPIAN": "ET", "EMIRATES": "EK",
    "AIR FRANCE": "AF", "LUFTHANSA": "LH", "QATAR": "QR", "ASKY": "KP",
    "TURKISH AIRLINES": "TK", "ROYAL AIR MAROC": "AT", "RAM": "AT",
    "HELIMALONGO": "HM", "HELI MALONGO": "HM",
    "AIRLINK": "LNK", "AIR LINK": "LNK", "MULTIFLIGHT": "MFT",
    "SKY VISION AIRLINES": "SVA", "NEW WAY CARGO": "NWC", "BESTFLY": "BFL",
    "COMAIR FLIGTH SERVICES": "CAW", "CAVOK AIR": "CVK", "CAVOKAIR": "CVK",
    "AFRICA CHARTER AIRLINE": "FSK", "AIR JET": "AJT",
    "AIR ATLANTA ICELANDIC": "ABD", "AIRATLANTA ICELANDIC": "ABD",
    "BIDAIR CARGO": "BDC", "FLY PRO": "FPR",
    "NEW RAYDE": "NRD", "NEWRADE": "NRD", "NEWRAYDE": "NRD",
    "ETIHAD AIRWAYS": "EY", "SILKWAY AIR LINES": "AZG", "FLY VAAYU": "FVY",
    "STAR AIR CARGO": "SRR", "GUARDIAN AIR": "GAR",
    "PROFLIGHT": "PFZ", "UKRAINE AIR ALLIANCE": "UKL", "ALPHA SKY": "ASK",
    "PEDRO SEBASTI\u00c3O": "D2E", "PEDRO SEBASTIAO": "D2E", "PEDRO SEBASTI\u00c3\u0083O": "D2E",
}

# ============================================================
# Helpers
# ============================================================

def run_sql(query, retries=3):
    """Execute SQL via Supabase Management API with retry."""
    import time as _time
    for attempt in range(retries):
        try:
            r = requests.post(
                f"https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query",
                headers={
                    "Authorization": f"Bearer {MGMT_TOKEN}",
                    "Content-Type": "application/json",
                },
                json={"query": query},
                timeout=60,
            )
            if r.status_code != 200 and r.status_code != 201:
                print(f"  SQL ERROR ({r.status_code}): {r.text[:500]}")
                return None
            try:
                return r.json()
            except Exception:
                return r.text
        except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as e:
            if attempt < retries - 1:
                wait = (attempt + 1) * 5
                print(f"  -> Connection error, retrying in {wait}s... ({attempt+1}/{retries})")
                _time.sleep(wait)
            else:
                print(f"  -> FATAL: Connection failed after {retries} attempts: {e}")
                raise


def sql_escape(val):
    """Escape a value for SQL insertion."""
    if val is None:
        return "NULL"
    s = str(val).replace("'", "''")
    return f"'{s}'"


def normalize_reg(reg):
    """Normalize aircraft registration: remove dashes/spaces, uppercase."""
    if not reg:
        return ""
    return str(reg).strip().upper().replace("-", "").replace(" ", "").replace("_", "")


def is_empty(val):
    """Check if a value is empty/missing."""
    if val is None:
        return True
    s = str(val).strip()
    return s in ("", "-", " -", "- ", "None")


def parse_time(val):
    """Parse a time value from Excel into HH:MM string."""
    if val is None:
        return None
    if isinstance(val, datetime.time):
        return val.strftime("%H:%M")
    if isinstance(val, datetime.datetime):
        return val.strftime("%H:%M")
    if isinstance(val, (int, float)):
        if val < 0 or val > 1.5:
            return None
        total_mins = int(val * 24 * 60)
        h = total_mins // 60
        m = total_mins % 60
        if h > 23:
            h = 23
            m = 59
        return f"{h:02d}:{m:02d}"
    s = str(val).strip()
    if s in ("", "-", " -", "- ", "None"):
        return None
    parts = s.split(":")
    if len(parts) >= 2:
        try:
            return f"{int(parts[0]):02d}:{int(parts[1]):02d}"
        except (ValueError, IndexError):
            pass
    return None


def parse_date(val):
    """Parse a date value from Excel into YYYY-MM-DD string."""
    if val is None:
        return None
    if isinstance(val, datetime.datetime):
        return val.strftime("%Y-%m-%d")
    if isinstance(val, datetime.date):
        return val.strftime("%Y-%m-%d")
    s = str(val).strip()
    if not s or s in ("-", " -"):
        return None
    # Try common date formats
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%m/%d/%Y"):
        try:
            return datetime.datetime.strptime(s, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def parse_int(val, default=0):
    """Parse an integer value, returning default if not parseable."""
    if val is None:
        return default
    if isinstance(val, (int, float)):
        return int(val)
    s = str(val).strip()
    if not s or s in ("-", " -", "- ", "None"):
        return default
    try:
        return int(float(s))
    except (ValueError, TypeError):
        return default


def parse_float(val, default=0.0):
    """Parse a float value, returning default if not parseable."""
    if val is None:
        return default
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).strip().replace(",", ".")
    if not s or s in ("-", " -", "- ", "None"):
        return default
    try:
        return float(s)
    except (ValueError, TypeError):
        return default


def sanitize_pmd(pmd_tonnes):
    """Convert PMD from tonnes to kg, with sanity checks."""
    if pmd_tonnes is None or pmd_tonnes == 0:
        return None
    val = parse_float(pmd_tonnes, 0.0)
    if val <= 0:
        return None
    # If value > 1000, it's likely already in kg
    if val > 1000:
        # Cap at 600000 kg (A380)
        return min(val, 600000.0)
    # Otherwise it's in tonnes, convert to kg
    kg = val * 1000
    # Cap at 600000 kg
    return min(kg, 600000.0)


def map_city_to_icao(city_name):
    """Map a city name to its ICAO code."""
    if not city_name:
        return None
    # Normalize: uppercase, strip whitespace
    normalized = str(city_name).strip().upper()
    # Direct lookup
    if normalized in CITY_TO_ICAO:
        return CITY_TO_ICAO[normalized]
    # Try without accents (basic normalization)
    import unicodedata
    try:
        nfkd = unicodedata.normalize("NFKD", normalized)
        ascii_only = "".join(c for c in nfkd if not unicodedata.combining(c))
        if ascii_only in CITY_TO_ICAO:
            return CITY_TO_ICAO[ascii_only]
    except Exception:
        pass
    # Try partial match
    for key, code in CITY_TO_ICAO.items():
        if key in normalized or normalized in key:
            return code
    return None


def map_operator_to_icao(operator_name):
    """Map an operator name to its ICAO code."""
    if not operator_name:
        return None
    normalized = str(operator_name).strip().upper()
    if normalized in OPERATOR_TO_ICAO:
        return OPERATOR_TO_ICAO[normalized]
    # Partial match
    for key, code in OPERATOR_TO_ICAO.items():
        if key in normalized or normalized in key:
            return code
    return None


def combine_datetime(date_str, time_str):
    """Combine a date (YYYY-MM-DD) and time (HH:MM) into ISO timestamp."""
    if not date_str or not time_str:
        return None
    return f"{date_str}T{time_str}:00Z"


def calc_minutes_between(time1, time2):
    """Calculate minutes between two HH:MM times. Handles overnight."""
    if not time1 or not time2:
        return 0
    try:
        h1, m1 = map(int, time1.split(":"))
        h2, m2 = map(int, time2.split(":"))
        mins1 = h1 * 60 + m1
        mins2 = h2 * 60 + m2
        diff = mins2 - mins1
        if diff < 0:
            diff += 1440  # overnight
        return diff
    except (ValueError, AttributeError):
        return 0


# Color output helpers
def green(text):
    return f"\033[92m{text}\033[0m"

def yellow(text):
    return f"\033[93m{text}\033[0m"

def red(text):
    return f"\033[91m{text}\033[0m"

def bold(text):
    return f"\033[1m{text}\033[0m"


# ============================================================
# Phase 1: Parse Excel
# ============================================================

def parse_excel(limit=None):
    """Parse the AIAAN Excel file and return structured flight records."""
    excel_path = os.path.abspath(EXCEL_PATH)
    if not os.path.exists(excel_path):
        print(red(f"  ERROR: Excel file not found: {excel_path}"))
        sys.exit(1)

    print(f"  Loading: {excel_path}")
    wb = openpyxl.load_workbook(excel_path, data_only=True, read_only=True)
    ws = wb[SHEET_NAME]

    rows = []
    unmapped_cities = set()
    unmapped_operators = set()
    all_cities = set()
    all_operators = set()
    skipped = 0

    for row_idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True)):
        if limit and len(rows) >= limit:
            break

        # Skip rows without a date
        date_val = row[0] if len(row) > 0 else None
        data_operacao = parse_date(date_val)
        if not data_operacao:
            skipped += 1
            continue

        # Extract columns
        turno = str(row[1]).strip() if row[1] else None
        num_ordem = str(row[2]).strip() if row[2] else None
        pista = str(row[3]).strip() if row[3] else None
        operador = str(row[4]).strip() if row[4] and not is_empty(row[4]) else None
        ata = row[5] if len(row) > 5 else None
        std = row[6] if len(row) > 6 else None
        atd = row[7] if len(row) > 7 else None
        calcos = row[8] if len(row) > 8 else None
        stand = str(row[9]).strip() if len(row) > 9 and row[9] and not is_empty(row[9]) else None
        callsign = str(row[10]).strip() if len(row) > 10 and row[10] and not is_empty(row[10]) else None
        registo = row[11] if len(row) > 11 else None
        pmd = row[12] if len(row) > 12 else None
        origem_destino = str(row[15]).strip() if len(row) > 15 and row[15] and not is_empty(row[15]) else None
        pax_embar = row[16] if len(row) > 16 else None
        transito = row[17] if len(row) > 17 else None
        pax_desembar = row[18] if len(row) > 18 else None
        crew = row[19] if len(row) > 19 else None
        carga = row[25] if len(row) > 25 else None
        checkin_on = row[27] if len(row) > 27 else None
        checkin_off = row[28] if len(row) > 28 else None
        balcoes = row[29] if len(row) > 29 else None
        manga_on = row[30] if len(row) > 30 else None
        manga_off = row[31] if len(row) > 31 else None
        pca_on = row[32] if len(row) > 32 else None
        pca_off = row[33] if len(row) > 33 else None
        gpu_on = row[36] if len(row) > 36 else None
        gpu_off = row[37] if len(row) > 37 else None
        obs = str(row[40]).strip() if len(row) > 40 and row[40] and not is_empty(row[40]) else None

        # Parse times
        ata_time = parse_time(ata)
        std_time = parse_time(std)
        atd_time = parse_time(atd)
        calcos_time = parse_time(calcos)

        # Determine ARR vs DEP
        has_ata = not is_empty(ata) and ata_time is not None
        has_std = not is_empty(std) and std_time is not None

        if has_ata and not has_std:
            tipo_movimento = "ARR"
        elif has_std and not has_ata:
            tipo_movimento = "DEP"
        else:
            # Both or neither - skip
            skipped += 1
            continue

        # Map city to ICAO
        icao_destino = None
        if origem_destino:
            all_cities.add(origem_destino.upper())
            icao_destino = map_city_to_icao(origem_destino)
            if not icao_destino:
                unmapped_cities.add(origem_destino.strip())

        # Map operator
        icao_operator = None
        if operador:
            all_operators.add(operador.upper())
            icao_operator = map_operator_to_icao(operador)
            if not icao_operator:
                unmapped_operators.add(operador.strip())

        # Normalize registration
        reg_norm = normalize_reg(registo)

        # PMD
        pmd_kg = sanitize_pmd(pmd)

        # Passengers
        pax_local = 0
        pax_transit = parse_int(transito, 0)
        if tipo_movimento == "ARR":
            pax_local = parse_int(pax_desembar, 0)
        else:
            pax_local = parse_int(pax_embar, 0)
        pax_total = pax_local + pax_transit

        # Crew
        crew_count = parse_int(crew, 0)

        # Cargo (already in kg)
        carga_kg = parse_float(carga, 0.0)

        # Horarios
        if tipo_movimento == "ARR":
            horario_real = ata_time
            horario_previsto = ata_time  # No scheduled arrival in data
        else:
            horario_previsto = std_time
            horario_real = atd_time if atd_time else std_time

        # Build record
        record = {
            "data_operacao": data_operacao,
            "tipo_movimento": tipo_movimento,
            "numero_voo": callsign or "",
            "horario_previsto": horario_previsto,
            "horario_real": horario_real,
            "aeroporto_operacao": AEROPORTO_OPERACAO,
            "registo_aeronave": reg_norm,
            "companhia_aerea": icao_operator or (operador or ""),
            "aeroporto_origem_destino": icao_destino or (origem_destino or ""),
            "tipo_voo": TIPO_VOO,
            "status": STATUS,
            "passageiros_local": pax_local,
            "passageiros_transito_transbordo": pax_transit,
            "passageiros_total": pax_total,
            "tripulacao": crew_count,
            "carga_kg": carga_kg,
            "observacoes": obs,
            "empresa_id": EMPRESA_ID,
            "origem_dados": ORIGEM_DADOS,
            # Extra fields for linking/resources (not inserted into voo table)
            "_calcos_time": calcos_time,
            "_stand": stand,
            "_pmd_kg": pmd_kg,
            "_operador_raw": operador,
            "_origem_destino_raw": origem_destino,
            "_reg_raw": str(registo).strip() if registo else "",
            "_checkin_on": parse_time(checkin_on),
            "_checkin_off": parse_time(checkin_off),
            "_balcoes": str(balcoes).strip() if balcoes and not is_empty(balcoes) else None,
            "_manga_on": parse_time(manga_on),
            "_manga_off": parse_time(manga_off),
            "_pca_on": parse_time(pca_on),
            "_pca_off": parse_time(pca_off),
            "_gpu_on": parse_time(gpu_on),
            "_gpu_off": parse_time(gpu_off),
        }
        rows.append(record)

    wb.close()

    arr_count = sum(1 for r in rows if r["tipo_movimento"] == "ARR")
    dep_count = sum(1 for r in rows if r["tipo_movimento"] == "DEP")

    print(green(f"  -> {len(rows)} rows parsed ({arr_count} ARR, {dep_count} DEP)"))
    print(f"  -> {len(all_cities)} unique destinations, {len(all_operators)} unique operators")
    if skipped:
        print(yellow(f"  -> {skipped} rows skipped (no date or ambiguous ARR/DEP)"))
    if unmapped_cities:
        print(yellow(f"  WARNING: {len(unmapped_cities)} unmapped destinations: {', '.join(sorted(unmapped_cities)[:20])}"))
    if unmapped_operators:
        print(yellow(f"  WARNING: {len(unmapped_operators)} unmapped operators: {', '.join(sorted(unmapped_operators)[:20])}"))

    return rows, unmapped_cities, unmapped_operators


# ============================================================
# Phase 2: Create missing aircraft registrations
# ============================================================

def create_aircraft_registrations(rows, dry_run=False):
    """Create missing registo_aeronave records."""
    # Collect unique registrations
    unique_regs = {}
    for r in rows:
        reg = r["registo_aeronave"]
        if reg and reg not in unique_regs:
            unique_regs[reg] = r["_pmd_kg"]

    if not unique_regs:
        print(yellow("  No registrations to create."))
        return

    # Fetch existing registrations
    result = run_sql("SELECT registo_normalizado, mtow_kg FROM registo_aeronave")
    existing = set()
    if result and isinstance(result, list):
        for row in result:
            rn = row.get("registo_normalizado", "")
            if rn:
                existing.add(rn.upper())

    to_create = []
    already_exist = 0
    for reg, pmd in unique_regs.items():
        if reg.upper() in existing:
            already_exist += 1
        else:
            to_create.append((reg, pmd))

    print(f"  -> {len(unique_regs)} unique registrations found")
    print(f"  -> {already_exist} already exist in DB")
    print(f"  -> {len(to_create)} new registrations to create")

    if dry_run or not to_create:
        return

    # Batch insert
    for i in range(0, len(to_create), BATCH_SIZE):
        batch = to_create[i : i + BATCH_SIZE]
        values = []
        for reg, pmd in batch:
            mtow = f"{pmd}" if pmd else "NULL"
            values.append(
                f"(gen_random_uuid(), {sql_escape(reg)}, {sql_escape(reg)}, "
                f"{mtow}, {sql_escape(EMPRESA_ID)}, NOW(), NOW())"
            )
        sql = (
            "INSERT INTO registo_aeronave "
            "(id, registo, registo_normalizado, mtow_kg, empresa_id, created_date, updated_date) "
            "VALUES " + ", ".join(values)
        )
        result = run_sql(sql)
        print(f"  -> Batch {i // BATCH_SIZE + 1}: {len(batch)} registrations created")

    print(green(f"  -> {len(to_create)} new registrations created"))


# ============================================================
# Phase 3: Create voos
# ============================================================

def create_voos(rows, dry_run=False):
    """Create voo records from parsed rows. Returns list of (row_index, voo_id) for linking."""
    # Fetch existing voos from this import
    result = run_sql(
        "SELECT numero_voo, data_operacao, tipo_movimento "
        "FROM voo WHERE origem_dados = 'AIAAN_IMPORT'"
    )
    existing = set()
    if result and isinstance(result, list):
        for row in result:
            key = (
                row.get("numero_voo", ""),
                row.get("data_operacao", ""),
                row.get("tipo_movimento", ""),
            )
            existing.add(key)

    if existing:
        print(yellow(f"  -> {len(existing)} voos already imported, will skip duplicates"))

    # Filter out duplicates
    to_insert = []
    skipped = 0
    for idx, r in enumerate(rows):
        key = (r["numero_voo"], r["data_operacao"], r["tipo_movimento"])
        if key in existing:
            skipped += 1
            continue
        to_insert.append((idx, r))

    print(f"  -> {len(to_insert)} voos to create ({skipped} duplicates skipped)")

    if dry_run or not to_insert:
        return {}

    # Insert in batches, returning IDs
    voo_id_map = {}  # row_index -> voo_id
    total_created = 0

    for batch_start in range(0, len(to_insert), BATCH_SIZE):
        batch = to_insert[batch_start : batch_start + BATCH_SIZE]
        values = []
        batch_indices = []

        for idx, r in batch:
            batch_indices.append(idx)
            values.append(
                f"(gen_random_uuid(), "
                f"{sql_escape(r['tipo_movimento'])}, "
                f"{sql_escape(r['numero_voo'])}, "
                f"{sql_escape(r['data_operacao'])}, "
                f"{sql_escape(r['horario_previsto'])}, "
                f"{sql_escape(r['horario_real'])}, "
                f"{sql_escape(r['aeroporto_operacao'])}, "
                f"{sql_escape(r['registo_aeronave'])}, "
                f"{sql_escape(r['companhia_aerea'])}, "
                f"{sql_escape(r['aeroporto_origem_destino'])}, "
                f"{sql_escape(r['tipo_voo'])}, "
                f"{sql_escape(r['status'])}, "
                f"{r['passageiros_local']}, "
                f"{r['passageiros_transito_transbordo']}, "
                f"{r['passageiros_total']}, "
                f"{r['tripulacao']}, "
                f"{r['carga_kg']}, "
                f"{sql_escape(r['observacoes'])}, "
                f"{sql_escape(r['empresa_id'])}, "
                f"{sql_escape(r['origem_dados'])}, "
                f"{sql_escape(CREATED_BY)}, {sql_escape(CREATED_BY)}, "
                f"NOW(), NOW())"
            )

        sql = (
            "INSERT INTO voo "
            "(id, tipo_movimento, numero_voo, data_operacao, horario_previsto, "
            "horario_real, aeroporto_operacao, registo_aeronave, companhia_aerea, "
            "aeroporto_origem_destino, tipo_voo, status, passageiros_local, "
            "passageiros_transito_transbordo, passageiros_total, tripulacao, "
            "carga_kg, observacoes, empresa_id, origem_dados, "
            "created_by, updated_by, created_date, updated_date) VALUES "
            + ", ".join(values)
            + " RETURNING id, numero_voo, data_operacao, tipo_movimento"
        )

        result = run_sql(sql)

        if result and isinstance(result, list):
            # Map returned IDs back to row indices
            # Since INSERT preserves order of VALUES, match by position
            for i, row_data in enumerate(result):
                if i < len(batch_indices):
                    voo_id_map[batch_indices[i]] = row_data.get("id")
            total_created += len(result)

        batch_num = batch_start // BATCH_SIZE + 1
        total_batches = (len(to_insert) + BATCH_SIZE - 1) // BATCH_SIZE
        print(f"  -> Batch {batch_num}/{total_batches}... {len(batch)} inserted")
        if batch_start + BATCH_SIZE < len(to_insert):
            import time as _t; _t.sleep(BATCH_DELAY)

    print(green(f"  -> {total_created} voos created"))
    return voo_id_map


# ============================================================
# Phase 4: Link ARR <-> DEP pairs
# ============================================================

def link_arr_dep(rows, voo_id_map, dry_run=False):
    """Group by (registration, date), find ARR+DEP pairs, create voo_ligado records.

    The same aircraft (registration) arriving and departing on the same date
    forms a linked pair. ARR comes first chronologically, then DEP.
    """
    # Group rows by (registration, date) — same aircraft on same day
    groups = defaultdict(list)
    for idx, r in enumerate(rows):
        reg = r.get("registo_aeronave", "")
        if not reg or not r["data_operacao"]:
            continue
        key = (reg, r["data_operacao"])
        groups[key].append(idx)

    pairs = []
    for key, indices in groups.items():
        arr_indices = [i for i in indices if rows[i]["tipo_movimento"] == "ARR"]
        dep_indices = [i for i in indices if rows[i]["tipo_movimento"] == "DEP"]

        # Sort by time (ARR by horario_real, DEP by horario_previsto or horario_real)
        arr_indices.sort(key=lambda i: rows[i].get("horario_real") or "00:00")
        dep_indices.sort(key=lambda i: rows[i].get("horario_previsto") or rows[i].get("horario_real") or "00:00")

        # Pair: first ARR with first DEP that comes after it, etc.
        used_deps = set()
        for arr_idx in arr_indices:
            arr_time = rows[arr_idx].get("horario_real") or "00:00"
            best_dep = None
            for dep_idx in dep_indices:
                if dep_idx in used_deps:
                    continue
                dep_time = rows[dep_idx].get("horario_previsto") or rows[dep_idx].get("horario_real") or "23:59"
                # DEP should be after ARR (or at least same time)
                if dep_time >= arr_time:
                    best_dep = dep_idx
                    break

            if best_dep is None:
                continue

            used_deps.add(best_dep)

            # Get voo IDs (may be None in dry-run)
            arr_id = voo_id_map.get(arr_idx, f"dry-{arr_idx}")
            dep_id = voo_id_map.get(best_dep, f"dry-{best_dep}")

            # Calculate permanencia from ATA (arrival) to ATD/STD (departure)
            ata = rows[arr_idx].get("horario_real")
            atd = rows[best_dep].get("horario_real") or rows[best_dep].get("horario_previsto")
            permanencia = calc_minutes_between(ata, atd) if ata and atd else 0

            pairs.append((arr_idx, best_dep, arr_id, dep_id, permanencia))

    print(f"  -> {len(pairs)} ARR<->DEP pairs found")

    if dry_run or not pairs:
        return pairs

    # Insert voo_ligado records in batches
    total_created = 0
    for batch_start in range(0, len(pairs), BATCH_SIZE):
        batch = pairs[batch_start : batch_start + BATCH_SIZE]
        values = []
        for arr_idx, dep_idx, arr_id, dep_id, perm in batch:
            values.append(
                f"(gen_random_uuid(), "
                f"{sql_escape(arr_id)}, "
                f"{sql_escape(dep_id)}, "
                f"{perm}, "
                f"{sql_escape(EMPRESA_ID)}, "
                f"{sql_escape(CREATED_BY)}, {sql_escape(CREATED_BY)}, "
                f"NOW(), NOW())"
            )

        sql = (
            "INSERT INTO voo_ligado "
            "(id, id_voo_arr, id_voo_dep, tempo_permanencia_min, empresa_id, "
            "created_by, updated_by, created_date, updated_date) VALUES "
            + ", ".join(values)
            + " RETURNING id"
        )

        result = run_sql(sql)
        if result and isinstance(result, list):
            # Store voo_ligado IDs back into pairs
            for i, row_data in enumerate(result):
                pair_idx = batch_start + i
                if pair_idx < len(pairs):
                    # Replace tuple with one that includes the voo_ligado_id
                    arr_idx, dep_idx, arr_id, dep_id, perm = pairs[pair_idx]
                    pairs[pair_idx] = (arr_idx, dep_idx, arr_id, dep_id, perm, row_data.get("id"))
            total_created += len(result)

        batch_num = batch_start // BATCH_SIZE + 1
        total_batches = (len(pairs) + BATCH_SIZE - 1) // BATCH_SIZE
        print(f"  -> Batch {batch_num}/{total_batches}... {len(batch)} linked")

    # Update voo records with voo_ligado_id
    print("  -> Updating voo records with voo_ligado_id references...")
    update_count = 0
    for pair in pairs:
        if len(pair) < 6 or not pair[5]:
            continue
        arr_idx, dep_idx, arr_id, dep_id, perm, voo_ligado_id = pair
        sql = (
            f"UPDATE voo SET voo_ligado_id = {sql_escape(voo_ligado_id)} "
            f"WHERE id IN ({sql_escape(arr_id)}, {sql_escape(dep_id)})"
        )
        run_sql(sql)
        update_count += 1

    print(green(f"  -> {total_created} pairs linked, {update_count * 2} voos updated"))
    return pairs


# ============================================================
# Phase 5: Create recurso_voo records
# ============================================================

def create_resources(rows, pairs, dry_run=False):
    """Create recurso_voo records for linked pairs that have resource data."""
    if not pairs:
        print("  -> No pairs to create resources for.")
        return 0

    resources = []
    for pair in pairs:
        # In dry-run: pair has 5 elements. In real mode: 6 (with voo_ligado_id)
        arr_idx, dep_idx, arr_id, dep_id, perm = pair[:5]
        voo_ligado_id = pair[5] if len(pair) > 5 else f"dry-{arr_idx}-{dep_idx}"

        arr = rows[arr_idx]
        dep = rows[dep_idx]
        date_str = arr["data_operacao"]

        # Collect resource data from both ARR and DEP rows
        manga_on = arr.get("_manga_on") or dep.get("_manga_on")
        manga_off = arr.get("_manga_off") or dep.get("_manga_off")
        pca_on = arr.get("_pca_on") or dep.get("_pca_on")
        pca_off = arr.get("_pca_off") or dep.get("_pca_off")
        gpu_on = arr.get("_gpu_on") or dep.get("_gpu_on")
        gpu_off = arr.get("_gpu_off") or dep.get("_gpu_off")
        checkin_on = arr.get("_checkin_on") or dep.get("_checkin_on")
        checkin_off = arr.get("_checkin_off") or dep.get("_checkin_off")
        balcoes = arr.get("_balcoes") or dep.get("_balcoes")

        has_any = any([manga_on, pca_on, gpu_on, checkin_on])
        if not has_any:
            continue

        pbb_used = bool(manga_on)
        pca_used = bool(pca_on)
        gpu_used = bool(gpu_on)
        checkin_used = bool(checkin_on)

        resources.append({
            "voo_ligado_id": voo_ligado_id,
            "pbb_utilizado": pbb_used,
            "pbb_hora_inicio": combine_datetime(date_str, manga_on),
            "pbb_hora_fim": combine_datetime(date_str, manga_off),
            "pca_utilizado": pca_used,
            "pca_hora_inicio": combine_datetime(date_str, pca_on),
            "pca_hora_fim": combine_datetime(date_str, pca_off),
            "gpu_utilizado": gpu_used,
            "gpu_hora_inicio": combine_datetime(date_str, gpu_on),
            "gpu_hora_fim": combine_datetime(date_str, gpu_off),
            "checkin_utilizado": checkin_used,
            "checkin_hora_inicio": combine_datetime(date_str, checkin_on),
            "checkin_hora_fim": combine_datetime(date_str, checkin_off),
            "checkin_posicoes": balcoes,
        })

    print(f"  -> {len(resources)} recurso_voo records to create")

    if dry_run or not resources:
        return len(resources)

    total_created = 0
    for batch_start in range(0, len(resources), BATCH_SIZE):
        batch = resources[batch_start : batch_start + BATCH_SIZE]
        values = []

        for res in batch:
            values.append(
                f"(gen_random_uuid(), "
                f"{sql_escape(res['voo_ligado_id'])}, "
                f"{res['pbb_utilizado']}, "
                f"{sql_escape(res['pbb_hora_inicio'])}, "
                f"{sql_escape(res['pbb_hora_fim'])}, "
                f"{res['pca_utilizado']}, "
                f"{sql_escape(res['pca_hora_inicio'])}, "
                f"{sql_escape(res['pca_hora_fim'])}, "
                f"{res['gpu_utilizado']}, "
                f"{sql_escape(res['gpu_hora_inicio'])}, "
                f"{sql_escape(res['gpu_hora_fim'])}, "
                f"{res['checkin_utilizado']}, "
                f"{sql_escape(res['checkin_hora_inicio'])}, "
                f"{sql_escape(res['checkin_hora_fim'])}, "
                f"{sql_escape(res['checkin_posicoes'])}, "
                f"NOW(), NOW())"
            )

        sql = (
            "INSERT INTO recurso_voo "
            "(id, voo_ligado_id, "
            "pbb_utilizado, pbb_hora_inicio, pbb_hora_fim, "
            "pca_utilizado, pca_hora_inicio, pca_hora_fim, "
            "gpu_utilizado, gpu_hora_inicio, gpu_hora_fim, "
            "checkin_utilizado, checkin_hora_inicio, checkin_hora_fim, "
            "checkin_posicoes, "
            "created_date, updated_date) VALUES "
            + ", ".join(values)
        )

        result = run_sql(sql)
        total_created += len(batch)

        batch_num = batch_start // BATCH_SIZE + 1
        total_batches = (len(resources) + BATCH_SIZE - 1) // BATCH_SIZE
        print(f"  -> Batch {batch_num}/{total_batches}... {len(batch)} created")

    print(green(f"  -> {total_created} recurso_voo records created"))
    return total_created


# ============================================================
# Main
# ============================================================

def main():
    parser = argparse.ArgumentParser(description="Import AIAAN Excel flight data into Supabase")
    parser.add_argument("--dry-run", action="store_true", help="Preview only, do not write to DB")
    parser.add_argument("--limit", type=int, default=None, help="Process only first N rows")
    args = parser.parse_args()

    print()
    print(bold("=" * 60))
    print(bold("  AIAAN Flight Data Import"))
    print(bold("=" * 60))
    if args.dry_run:
        print(yellow("  MODE: DRY RUN (no changes will be made)"))
    if args.limit:
        print(yellow(f"  LIMIT: Processing first {args.limit} rows only"))
    print()

    # Phase 1: Parse Excel
    print(bold("[1/5] Parsing Excel..."))
    rows, unmapped_cities, unmapped_operators = parse_excel(limit=args.limit)
    if not rows:
        print(red("  No rows to import. Exiting."))
        return
    print()

    # Phase 2: Create aircraft registrations
    print(bold("[2/5] Creating aircraft registrations..."))
    create_aircraft_registrations(rows, dry_run=args.dry_run)
    print()

    # Phase 3: Create voos
    print(bold(f"[3/5] Creating voos ({len(rows)} records)..."))
    voo_id_map = create_voos(rows, dry_run=args.dry_run)
    print()

    # Phase 4: Link ARR<->DEP pairs
    print(bold("[4/5] Linking ARR<->DEP pairs..."))
    pairs = link_arr_dep(rows, voo_id_map, dry_run=args.dry_run)
    print()

    # Phase 5: Create resources
    print(bold("[5/5] Creating resources (PBB/PCA/GPU/Checkin)..."))
    resource_count = create_resources(rows, pairs, dry_run=args.dry_run)
    print()

    # Summary
    pairs_linked = sum(1 for p in pairs if len(p) >= 6 and p[5]) if pairs else 0
    print(bold("=" * 60))
    print(bold("  Import Complete!"))
    print(bold("=" * 60))
    print(f"  - Voos created:      {len(voo_id_map) if not args.dry_run else 0}")
    print(f"  - Pairs linked:      {pairs_linked}")
    print(f"  - Resources created: {resource_count if not args.dry_run else 0}")
    print(f"  - Tariff calculation: run from Operacoes page (Recalcular Selecionados)")
    if unmapped_cities:
        print(yellow(f"  - Unmapped cities:   {len(unmapped_cities)}"))
    if unmapped_operators:
        print(yellow(f"  - Unmapped operators: {len(unmapped_operators)}"))
    print()


if __name__ == "__main__":
    main()
