"""
Fetch historical FlightAware data and save to cache_voo_f_r24.
Usage: python scripts/fetch_historical.py
"""
import json
import urllib.request
import time
from datetime import datetime, timedelta

FA_KEY = "ZM6KDgWxboMqxYJq1z15HJQtVQ2uzdJ3"
SB_TOKEN = "sbp_c8d01ec2c738bc1a6a9481b734a932cdcd6b18da"
SB_PROJECT = "glernwcsuwcyzwsnelad"
AIRPORT = "FNBJ"
START_DATE = datetime(2026, 1, 1)
END_DATE = datetime(2026, 3, 23)

def fa_fetch(endpoint):
    url = f"https://aeroapi.flightaware.com/aeroapi{endpoint}"
    req = urllib.request.Request(url, headers={"x-apikey": FA_KEY, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())
    except Exception as e:
        print(f"  API error: {e}")
        return None

def sb_query(sql):
    url = f"https://api.supabase.com/v1/projects/{SB_PROJECT}/database/query"
    data = json.dumps({"query": sql}).encode()
    req = urllib.request.Request(url, data=data, headers={
        "Authorization": f"Bearer {SB_TOKEN}",
        "Content-Type": "application/json",
    })
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())
    except Exception as e:
        return {"error": str(e)}

def normalize_flight(f, movement_type, airport):
    origin = f.get("origin") or {}
    dest = f.get("destination") or {}
    return {
        "fr24_id": f.get("fa_flight_id"),
        "flight": f.get("ident_iata") or f.get("ident"),
        "callsign": f.get("ident_icao"),
        "flight_number": f.get("flight_number"),
        "reg": f.get("registration"),
        "type": f.get("aircraft_type"),
        "operating_as": f.get("operator_icao"),
        "operator_iata": f.get("operator_iata"),
        "movement_type": movement_type,
        "airport_icao": airport,
        "orig_icao": origin.get("code_icao"),
        "orig_iata": origin.get("code_iata"),
        "orig_name": origin.get("name"),
        "orig_city": origin.get("city"),
        "dest_icao": dest.get("code_icao"),
        "dest_iata": dest.get("code_iata"),
        "dest_icao_actual": dest.get("code_icao"),
        "dest_iata_actual": dest.get("code_iata"),
        "dest_name": dest.get("name"),
        "dest_city": dest.get("city"),
        "datetime_takeoff": f.get("actual_off") or f.get("estimated_off"),
        "datetime_landed": f.get("actual_on") or f.get("estimated_on"),
        "datetime_scheduled_takeoff": f.get("scheduled_off"),
        "datetime_scheduled_landed": f.get("scheduled_on"),
        "datetime_estimated_takeoff": f.get("estimated_off"),
        "datetime_estimated_landed": f.get("estimated_on"),
        "departure_delay": f.get("departure_delay"),
        "arrival_delay": f.get("arrival_delay"),
        "actual_distance": f.get("route_distance"),
        "runway_takeoff": f.get("actual_runway_off"),
        "runway_landed": f.get("actual_runway_on"),
        "gate_origin": f.get("gate_origin"),
        "gate_destination": f.get("gate_destination"),
        "terminal_origin": f.get("terminal_origin"),
        "terminal_destination": f.get("terminal_destination"),
        "baggage_claim": f.get("baggage_claim"),
        "status": f.get("status"),
        "progress_percent": f.get("progress_percent"),
        "cancelled": f.get("cancelled", False),
        "diverted": f.get("diverted", False),
        "flight_ended": f.get("status", "").lower().find("arrived") >= 0 or f.get("progress_percent") == 100,
        "codeshares": f.get("codeshares", []),
        "codeshares_iata": f.get("codeshares_iata", []),
        "data_source": "flightaware",
    }

def escape_sql(s):
    if s is None:
        return "NULL"
    return "'" + str(s).replace("'", "''") + "'"

def main():
    total = 0
    errors = 0
    d = START_DATE

    while d <= END_DATE:
        date_str = d.strftime("%Y-%m-%d")
        start = f"{date_str}T00:00:00Z"
        end = f"{date_str}T23:59:59Z"

        days_ago = (datetime.now() - d).days
        prefix = "/history" if days_ago > 9 else ""

        # Fetch arrivals
        arr_data = fa_fetch(f"{prefix}/airports/{AIRPORT}/flights/arrivals?start={start}&end={end}&max_pages=2")
        arrivals = (arr_data or {}).get("arrivals", [])

        # Fetch departures
        dep_data = fa_fetch(f"{prefix}/airports/{AIRPORT}/flights/departures?start={start}&end={end}&max_pages=2")
        departures = (dep_data or {}).get("departures", [])

        day_total = len(arrivals) + len(departures)

        if day_total > 0:
            # Build records
            values = []
            for f in arrivals:
                norm = normalize_flight(f, "ARR", AIRPORT)
                if not norm["fr24_id"]:
                    continue
                dt = norm["datetime_landed"] or norm["datetime_takeoff"] or ""
                data_voo = dt[:10] if dt else date_str
                rd = json.dumps(norm).replace("'", "''")
                values.append(
                    f"('{norm['fr24_id']}', '{norm['flight'] or ''}', '{AIRPORT}', '{data_voo}', "
                    f"'{(d + timedelta(days=30)).strftime('%Y-%m-%d')}', 'pendente', '{rd}'::jsonb, now())"
                )

            for f in departures:
                norm = normalize_flight(f, "DEP", AIRPORT)
                if not norm["fr24_id"]:
                    continue
                dt = norm["datetime_takeoff"] or norm["datetime_landed"] or ""
                data_voo = dt[:10] if dt else date_str
                rd = json.dumps(norm).replace("'", "''")
                values.append(
                    f"('{norm['fr24_id']}', '{norm['flight'] or ''}', '{AIRPORT}', '{data_voo}', "
                    f"'{(d + timedelta(days=30)).strftime('%Y-%m-%d')}', 'pendente', '{rd}'::jsonb, now())"
                )

            if values:
                sql = (
                    "INSERT INTO cache_voo_f_r24 (fr24_id, numero_voo, airport_icao, data_voo, "
                    "data_expiracao, status, raw_data, updated_date) VALUES "
                    + ",".join(values)
                    + " ON CONFLICT (fr24_id) DO UPDATE SET "
                    "raw_data = EXCLUDED.raw_data, numero_voo = EXCLUDED.numero_voo, "
                    "data_voo = EXCLUDED.data_voo, updated_date = now() "
                    "WHERE cache_voo_f_r24.status != 'importado';"
                )

                result = sb_query(sql)
                if isinstance(result, dict) and "error" in result:
                    print(f"{date_str}: {day_total} voos ({len(arrivals)}A+{len(departures)}D) - ERROR: {result.get('error','')[:80]}")
                    errors += 1
                elif isinstance(result, dict) and "message" in result:
                    print(f"{date_str}: {day_total} voos ({len(arrivals)}A+{len(departures)}D) - SQL ERROR: {result.get('message','')[:80]}")
                    errors += 1
                else:
                    print(f"{date_str}: {day_total} voos ({len(arrivals)}A+{len(departures)}D) - OK")

            total += day_total
        else:
            print(f"{date_str}: 0 voos")

        d += timedelta(days=1)
        time.sleep(0.5)  # Rate limit

    print(f"\n=== TOTAL: {total} voos em cache, {errors} erros ===")

if __name__ == "__main__":
    main()
