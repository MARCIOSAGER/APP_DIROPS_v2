"""
Fetch historical FlightAware data and save to cache_voo_f_r24.
Uses Supabase REST API with service_role key (bypasses RLS).
"""
import json, urllib.request, time, ssl, os, sys
from datetime import datetime, timedelta

FA_KEY = "ZM6KDgWxboMqxYJq1z15HJQtVQ2uzdJ3"
SB_URL = "https://glernwcsuwcyzwsnelad.supabase.co"
SVC_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdsZXJud2NzdXdjeXp3c25lbGFkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjc4NDgzMywiZXhwIjoyMDg4MzYwODMzfQ.EgDe_4UxQfRytcc5o2UZ5NHoOwX3DMT4C5RZbNkuL-4"

env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
ANON_KEY = ""
with open(env_path) as f:
    for line in f:
        if line.startswith("VITE_SUPABASE_ANON_KEY="):
            ANON_KEY = line.strip().split("=", 1)[1]

AIRPORT = "FNBJ"
START_DATE = datetime(2026, 1, 1)
END_DATE = datetime(2026, 3, 23)
ctx = ssl.create_default_context()

def fa_fetch(endpoint):
    req = urllib.request.Request(
        f"https://aeroapi.flightaware.com/aeroapi{endpoint}",
        headers={"x-apikey": FA_KEY, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30, context=ctx) as r:
            return json.loads(r.read())
    except:
        return None

def sb_upsert(records):
    data = json.dumps(records).encode("utf-8")
    req = urllib.request.Request(f"{SB_URL}/rest/v1/cache_voo_f_r24", data=data, method="POST", headers={
        "apikey": ANON_KEY, "Authorization": f"Bearer {SVC_KEY}",
        "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates"})
    try:
        with urllib.request.urlopen(req, timeout=30, context=ctx) as r:
            return True
    except urllib.error.HTTPError as e:
        print(f"  upsert err {e.code}: {e.read().decode()[:100]}")
        return False
    except Exception as e:
        print(f"  upsert err: {e}")
        return False

def norm(f, mt):
    o = f.get("origin") or {}; d = f.get("destination") or {}
    return {
        "fr24_id": f.get("fa_flight_id"), "flight": f.get("ident_iata") or f.get("ident"),
        "callsign": f.get("ident_icao"), "reg": f.get("registration"),
        "type": f.get("aircraft_type"), "operating_as": f.get("operator_icao"),
        "operator_iata": f.get("operator_iata"), "movement_type": mt, "airport_icao": AIRPORT,
        "orig_icao": o.get("code_icao"), "orig_iata": o.get("code_iata"), "orig_name": o.get("name"),
        "dest_icao": d.get("code_icao"), "dest_iata": d.get("code_iata"),
        "dest_icao_actual": d.get("code_icao"), "dest_name": d.get("name"),
        "datetime_takeoff": f.get("actual_off") or f.get("estimated_off"),
        "datetime_landed": f.get("actual_on") or f.get("estimated_on"),
        "datetime_scheduled_takeoff": f.get("scheduled_off"),
        "datetime_scheduled_landed": f.get("scheduled_on"),
        "departure_delay": f.get("departure_delay"), "arrival_delay": f.get("arrival_delay"),
        "actual_distance": f.get("route_distance"),
        "runway_takeoff": f.get("actual_runway_off"),
        "gate_origin": f.get("gate_origin"), "gate_destination": f.get("gate_destination"),
        "terminal_origin": f.get("terminal_origin"), "terminal_destination": f.get("terminal_destination"),
        "status": f.get("status"), "cancelled": f.get("cancelled", False),
        "diverted": f.get("diverted", False),
        "codeshares_iata": f.get("codeshares_iata", []), "data_source": "flightaware"}

def main():
    total = 0; saved = 0; errs = 0; d = START_DATE
    sys.stdout.reconfigure(line_buffering=True)
    print(f"Fetching {AIRPORT}: {START_DATE.date()} to {END_DATE.date()}\n")

    while d <= END_DATE:
        ds = d.strftime("%Y-%m-%d")
        days = (datetime.now() - d).days
        pfx = "/history" if days > 9 else ""
        s = f"{ds}T00:00:00Z"; e = f"{ds}T23:59:59Z"

        arrs = (fa_fetch(f"{pfx}/airports/{AIRPORT}/flights/arrivals?start={s}&end={e}&max_pages=2") or {}).get("arrivals", [])
        deps = (fa_fetch(f"{pfx}/airports/{AIRPORT}/flights/departures?start={s}&end={e}&max_pages=2") or {}).get("departures", [])
        cnt = len(arrs) + len(deps); total += cnt

        if cnt > 0:
            recs = []
            for f in arrs:
                n = norm(f, "ARR")
                if not n["fr24_id"]: continue
                dt = n["datetime_landed"] or n["datetime_takeoff"] or ""
                recs.append({"fr24_id": n["fr24_id"], "numero_voo": n["flight"] or "",
                    "airport_icao": AIRPORT, "data_voo": dt[:10] if dt else ds,
                    "data_expiracao": (d+timedelta(days=90)).strftime("%Y-%m-%d"),
                    "status": "pendente", "raw_data": n})
            for f in deps:
                n = norm(f, "DEP")
                if not n["fr24_id"]: continue
                dt = n["datetime_takeoff"] or n["datetime_landed"] or ""
                recs.append({"fr24_id": n["fr24_id"], "numero_voo": n["flight"] or "",
                    "airport_icao": AIRPORT, "data_voo": dt[:10] if dt else ds,
                    "data_expiracao": (d+timedelta(days=90)).strftime("%Y-%m-%d"),
                    "status": "pendente", "raw_data": n})

            if sb_upsert(recs):
                saved += len(recs)
                print(f"{ds}: {cnt} ({len(arrs)}A+{len(deps)}D) OK")
            else:
                errs += 1
                print(f"{ds}: {cnt} ({len(arrs)}A+{len(deps)}D) ERR")
        else:
            print(f"{ds}: 0")

        d += timedelta(days=1); time.sleep(0.3)

    print(f"\n=== FETCHED: {total} | SAVED: {saved} | ERRORS: {errs} ===")

if __name__ == "__main__":
    main()
