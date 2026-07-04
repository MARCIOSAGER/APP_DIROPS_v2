"""
Fetch historical FlightAware data and save to cache_voo_f_r24.
Uses Supabase REST API (PostgREST) for upserts.
"""
import json
import urllib.request
import time
import ssl
import os
from datetime import datetime, timedelta

FA_KEY = "ZM6KDgWxboMqxYJq1z15HJQtVQ2uzdJ3"
SB_URL = "https://glernwcsuwcyzwsnelad.supabase.co"
AIRPORT = "FNBJ"
START_DATE = datetime(2026, 1, 1)
END_DATE = datetime(2026, 3, 23)

# Read anon key from .env
env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
ANON_KEY = ""
with open(env_path) as f:
    for line in f:
        if line.startswith("VITE_SUPABASE_ANON_KEY="):
            ANON_KEY = line.strip().split("=", 1)[1]
            break

ctx = ssl.create_default_context()

def fa_fetch(endpoint):
    url = f"https://aeroapi.flightaware.com/aeroapi{endpoint}"
    req = urllib.request.Request(url, headers={"x-apikey": FA_KEY, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30, context=ctx) as resp:
            return json.loads(resp.read())
    except Exception as e:
        return None

def sb_upsert_rest(records):
    """Upsert records using Supabase REST API (PostgREST)."""
    if not records:
        return True
    url = f"{SB_URL}/rest/v1/cache_voo_f_r24"
    data = json.dumps(records).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST", headers={
        "apikey": ANON_KEY,
        "Authorization": f"Bearer {ANON_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    })
    try:
        with urllib.request.urlopen(req, timeout=30, context=ctx) as resp:
            return resp.status in (200, 201)
    except urllib.error.HTTPError as e:
        body = e.read().decode()[:200]
        print(f"  REST error {e.code}: {body}")
        return False
    except Exception as e:
        print(f"  REST error: {e}")
        return False

def normalize_flight(f, movement_type, airport, date_str):
    origin = f.get("origin") or {}
    dest = f.get("destination") or {}
    norm = {
        "fr24_id": f.get("fa_flight_id"),
        "flight": f.get("ident_iata") or f.get("ident"),
        "callsign": f.get("ident_icao"),
        "reg": f.get("registration"),
        "type": f.get("aircraft_type"),
        "operating_as": f.get("operator_icao"),
        "operator_iata": f.get("operator_iata"),
        "movement_type": movement_type,
        "airport_icao": airport,
        "orig_icao": origin.get("code_icao"),
        "orig_iata": origin.get("code_iata"),
        "orig_name": origin.get("name"),
        "dest_icao": dest.get("code_icao"),
        "dest_iata": dest.get("code_iata"),
        "dest_icao_actual": dest.get("code_icao"),
        "dest_iata_actual": dest.get("code_iata"),
        "dest_name": dest.get("name"),
        "datetime_takeoff": f.get("actual_off") or f.get("estimated_off"),
        "datetime_landed": f.get("actual_on") or f.get("estimated_on"),
        "datetime_scheduled_takeoff": f.get("scheduled_off"),
        "datetime_scheduled_landed": f.get("scheduled_on"),
        "departure_delay": f.get("departure_delay"),
        "arrival_delay": f.get("arrival_delay"),
        "actual_distance": f.get("route_distance"),
        "runway_takeoff": f.get("actual_runway_off"),
        "gate_origin": f.get("gate_origin"),
        "gate_destination": f.get("gate_destination"),
        "terminal_origin": f.get("terminal_origin"),
        "terminal_destination": f.get("terminal_destination"),
        "status": f.get("status"),
        "cancelled": f.get("cancelled", False),
        "diverted": f.get("diverted", False),
        "codeshares_iata": f.get("codeshares_iata", []),
        "data_source": "flightaware",
    }
    dt = norm["datetime_landed"] or norm["datetime_takeoff"] or ""
    return {
        "fr24_id": norm["fr24_id"],
        "numero_voo": norm["flight"] or "",
        "airport_icao": airport,
        "data_voo": dt[:10] if dt else date_str,
        "data_expiracao": (datetime.strptime(date_str, "%Y-%m-%d") + timedelta(days=90)).strftime("%Y-%m-%d"),
        "status": "pendente",
        "raw_data": norm,
    }

def main():
    total_fetched = 0
    total_saved = 0
    errors = 0
    d = START_DATE

    print(f"Fetching {AIRPORT} from {START_DATE.date()} to {END_DATE.date()}")
    print(f"Supabase URL: {SB_URL}")
    print(f"Anon key: {ANON_KEY[:20]}...")
    print()

    while d <= END_DATE:
        date_str = d.strftime("%Y-%m-%d")
        start = f"{date_str}T00:00:00Z"
        end = f"{date_str}T23:59:59Z"
        days_ago = (datetime.now() - d).days
        prefix = "/history" if days_ago > 9 else ""

        arr_data = fa_fetch(f"{prefix}/airports/{AIRPORT}/flights/arrivals?start={start}&end={end}&max_pages=2")
        arrivals = (arr_data or {}).get("arrivals", [])

        dep_data = fa_fetch(f"{prefix}/airports/{AIRPORT}/flights/departures?start={start}&end={end}&max_pages=2")
        departures = (dep_data or {}).get("departures", [])

        day_total = len(arrivals) + len(departures)
        total_fetched += day_total

        if day_total > 0:
            records = []
            for f in arrivals:
                rec = normalize_flight(f, "ARR", AIRPORT, date_str)
                if rec["fr24_id"]:
                    records.append(rec)
            for f in departures:
                rec = normalize_flight(f, "DEP", AIRPORT, date_str)
                if rec["fr24_id"]:
                    records.append(rec)

            ok = sb_upsert_rest(records)
            if ok:
                total_saved += len(records)
                print(f"{date_str}: {day_total} voos ({len(arrivals)}A+{len(departures)}D) - OK")
            else:
                errors += 1
                print(f"{date_str}: {day_total} voos - SAVE ERROR")
        else:
            print(f"{date_str}: 0 voos")

        d += timedelta(days=1)
        time.sleep(0.3)

    print(f"\n=== FETCHED: {total_fetched} | SAVED: {total_saved} | ERRORS: {errors} ===")

if __name__ == "__main__":
    main()
