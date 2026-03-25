"""
Fetch FlightAware historical data and save to cache via Management API.
Inserts 1 flight at a time to avoid 403 on large payloads.
"""
import json
import urllib.request
import time
import ssl
import os
import sys
from datetime import datetime, timedelta

FA_KEY = "ZM6KDgWxboMqxYJq1z15HJQtVQ2uzdJ3"
SB_TOKEN = "sbp_c8d01ec2c738bc1a6a9481b734a932cdcd6b18da"
SB_PROJECT = "glernwcsuwcyzwsnelad"
AIRPORT = "FNBJ"
START_DATE = datetime(2026, 1, 1)
END_DATE = datetime(2026, 3, 23)

ctx = ssl.create_default_context()

def fa_fetch(endpoint):
    url = f"https://aeroapi.flightaware.com/aeroapi{endpoint}"
    req = urllib.request.Request(url, headers={"x-apikey": FA_KEY, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30, context=ctx) as resp:
            return json.loads(resp.read())
    except Exception as e:
        return None

def sb_sql(sql):
    url = f"https://api.supabase.com/v1/projects/{SB_PROJECT}/database/query"
    data = json.dumps({"query": sql}).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={
        "Authorization": f"Bearer {SB_TOKEN}",
        "Content-Type": "application/json",
    })
    try:
        with urllib.request.urlopen(req, timeout=30, context=ctx) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return {"error": f"HTTP {e.code}"}
    except Exception as e:
        return {"error": str(e)}

def esc(s):
    if s is None:
        return "NULL"
    return "'" + str(s).replace("'", "''") + "'"

def normalize(f, mt, airport):
    o = f.get("origin") or {}
    d = f.get("destination") or {}
    return {
        "fr24_id": f.get("fa_flight_id"),
        "flight": f.get("ident_iata") or f.get("ident"),
        "callsign": f.get("ident_icao"),
        "reg": f.get("registration"),
        "type": f.get("aircraft_type"),
        "operating_as": f.get("operator_icao"),
        "operator_iata": f.get("operator_iata"),
        "movement_type": mt, "airport_icao": airport,
        "orig_icao": o.get("code_icao"), "orig_iata": o.get("code_iata"),
        "orig_name": o.get("name"),
        "dest_icao": d.get("code_icao"), "dest_iata": d.get("code_iata"),
        "dest_icao_actual": d.get("code_icao"), "dest_name": d.get("name"),
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

def main():
    total = 0; saved = 0; errs = 0
    d = START_DATE
    sys.stdout.reconfigure(line_buffering=True)

    while d <= END_DATE:
        ds = d.strftime("%Y-%m-%d")
        s = f"{ds}T00:00:00Z"; e = f"{ds}T23:59:59Z"
        days = (datetime.now() - d).days
        pfx = "/history" if days > 9 else ""

        arrs = (fa_fetch(f"{pfx}/airports/{AIRPORT}/flights/arrivals?start={s}&end={e}&max_pages=2") or {}).get("arrivals", [])
        deps = (fa_fetch(f"{pfx}/airports/{AIRPORT}/flights/departures?start={s}&end={e}&max_pages=2") or {}).get("departures", [])
        cnt = len(arrs) + len(deps)
        total += cnt

        if cnt > 0:
            # Build batch of 3 flights per SQL INSERT
            recs = []
            for f in arrs:
                n = normalize(f, "ARR", AIRPORT)
                if n["fr24_id"]: recs.append(n)
            for f in deps:
                n = normalize(f, "DEP", AIRPORT)
                if n["fr24_id"]: recs.append(n)

            day_ok = True
            for i in range(0, len(recs), 3):
                batch = recs[i:i+3]
                vals = []
                for r in batch:
                    dt = r.get("datetime_landed") or r.get("datetime_takeoff") or ""
                    dv = dt[:10] if dt else ds
                    exp = (d + timedelta(days=90)).strftime("%Y-%m-%d")
                    rd = json.dumps(r).replace("'", "''")
                    vals.append(f"({esc(r['fr24_id'])}, {esc(r['flight'] or '')}, {esc(AIRPORT)}, {esc(dv)}, {esc(exp)}, 'pendente', '{rd}'::jsonb, now())")

                sql = ("INSERT INTO cache_voo_f_r24 (fr24_id,numero_voo,airport_icao,data_voo,"
                       "data_expiracao,status,raw_data,updated_date) VALUES " + ",".join(vals) +
                       " ON CONFLICT (fr24_id) DO UPDATE SET raw_data=EXCLUDED.raw_data,"
                       "numero_voo=EXCLUDED.numero_voo,data_voo=EXCLUDED.data_voo,"
                       "updated_date=now() WHERE cache_voo_f_r24.status!='importado';")

                res = sb_sql(sql)
                if isinstance(res, dict) and ("error" in res or "message" in res):
                    day_ok = False
                    break

            if day_ok:
                saved += len(recs)
                print(f"{ds}: {cnt} ({len(arrs)}A+{len(deps)}D) OK")
            else:
                errs += 1
                print(f"{ds}: {cnt} ({len(arrs)}A+{len(deps)}D) ERR")
        else:
            print(f"{ds}: 0")

        d += timedelta(days=1)
        time.sleep(0.2)

    print(f"\n=== TOTAL: {total} fetched, {saved} saved, {errs} errors ===")

if __name__ == "__main__":
    main()
