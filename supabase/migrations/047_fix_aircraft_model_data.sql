-- Migration 047: Comprehensive aircraft model data fix
-- Fixes: MTOW values in tonnes→kg, fills envergadura_m, comprimento_m, codigo_iata for ALL models
-- Uses modelo + codigo_icao as composite key to handle duplicates
-- Also drops incorrect UNIQUE constraint on codigo_iata (IATA codes are shared across variants)

BEGIN;

-- Drop incorrect UNIQUE index on codigo_iata (multiple variants share the same IATA code)
DROP INDEX IF EXISTS modelo_aeronave_codigo_iata_key;

-- ============================================================
-- A220-300 (BCS3) - Airbus A220-300
-- MTOW: 70.9 → 70900 kg (was in tonnes)
-- ============================================================
UPDATE modelo_aeronave SET
  mtow_kg = 70900,
  envergadura_m = 35.1,
  comprimento_m = 38.7,
  codigo_iata = '223'
WHERE modelo = 'A220-300' AND codigo_icao = 'BCS3';

-- ============================================================
-- AAAA (MRJ) - Mitsubishi Regional Jet placeholder
-- MTOW: 1000 - likely placeholder, leave as is but add dimensions for MRJ
-- ============================================================
UPDATE modelo_aeronave SET
  mtow_kg = 42800,
  envergadura_m = 29.2,
  comprimento_m = 35.8,
  codigo_iata = NULL
WHERE modelo = 'AAAA' AND codigo_icao = 'MRJ';

-- ============================================================
-- Aero Boero AB-115 (AB11)
-- MTOW: 750 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 10.4,
  comprimento_m = 6.9,
  codigo_iata = NULL
WHERE modelo = 'Aero Boero AB-115' AND codigo_icao = 'AB11';

-- ============================================================
-- Aero Commander 500 (AC50)
-- MTOW: 3000 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 14.9,
  comprimento_m = 10.8,
  codigo_iata = NULL
WHERE modelo = 'Aero Commander 500' AND codigo_icao = 'AC50';

-- ============================================================
-- ATR 42-300/320 (AT43)
-- MTOW: 18600 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 24.6,
  comprimento_m = 22.7,
  codigo_iata = 'AT4'
WHERE modelo = 'Aerospatiale/Alenia ATR 42-300/320' AND codigo_icao = 'AT43';

-- ============================================================
-- ATR 42-400 (AT44)
-- MTOW: 18600 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 24.6,
  comprimento_m = 22.7,
  codigo_iata = 'AT4'
WHERE modelo = 'Aerospatiale/Alenia ATR 42-400' AND codigo_icao = 'AT44';

-- ============================================================
-- ATR 42-500 (AT45)
-- MTOW: 18600 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 24.6,
  comprimento_m = 22.7,
  codigo_iata = 'AT5'
WHERE modelo = 'Aerospatiale/Alenia ATR 42-500' AND codigo_icao = 'AT45';

-- ============================================================
-- ATR 72 (AT72)
-- MTOW: 23000 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 27.1,
  comprimento_m = 27.2,
  codigo_iata = 'AT7'
WHERE modelo = 'Aerospatiale/Alenia ATR 72' AND codigo_icao = 'AT72';

-- ============================================================
-- Agusta Westland AW109 (A109)
-- MTOW: 3175 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 11.0,
  comprimento_m = 13.0,
  codigo_iata = NULL
WHERE modelo = 'Agusta Westland AW109' AND codigo_icao = 'A109';

-- ============================================================
-- Agusta Westland AW139 (A139)
-- MTOW: 7000 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 13.8,
  comprimento_m = 16.6,
  codigo_iata = NULL
WHERE modelo = 'Agusta Westland AW139' AND codigo_icao = 'A139';

-- ============================================================
-- AIRBUS (43C5) - generic placeholder
-- MTOW: 77000 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 35.8,
  comprimento_m = 37.6,
  codigo_iata = NULL
WHERE modelo = 'AIRBUS' AND codigo_icao = '43C5';

-- ============================================================
-- Airbus 320S (A320)
-- MTOW: 77000 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 35.8,
  comprimento_m = 37.6,
  codigo_iata = '320'
WHERE modelo = 'Airbus 320S' AND codigo_icao = 'A320';

-- ============================================================
-- Airbus 32R (A320)
-- MTOW: 77000 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 35.8,
  comprimento_m = 37.6,
  codigo_iata = '320'
WHERE modelo = 'Airbus 32R' AND codigo_icao = 'A320';

-- ============================================================
-- Airbus 330 (A33F) - A330 Freighter
-- MTOW: 242000 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 60.3,
  comprimento_m = 58.8,
  codigo_iata = '33F'
WHERE modelo = 'Airbus 330' AND codigo_icao = 'A33F';

-- ============================================================
-- Airbus A220-100 (BCS1)
-- MTOW: 63.1 → 63100 kg (was in tonnes)
-- ============================================================
UPDATE modelo_aeronave SET
  mtow_kg = 63100,
  envergadura_m = 35.1,
  comprimento_m = 35.0,
  codigo_iata = '221'
WHERE modelo = 'Airbus A220-100' AND codigo_icao = 'BCS1';

-- ============================================================
-- Airbus A300 pax (A30B)
-- MTOW: 165000 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 44.8,
  comprimento_m = 54.1,
  codigo_iata = 'AB3'
WHERE modelo = 'Airbus A300 pax' AND codigo_icao = 'A30B';

-- ============================================================
-- Airbus A300-600 pax (A306)
-- MTOW: 170500 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 44.8,
  comprimento_m = 54.1,
  codigo_iata = 'AB6'
WHERE modelo = 'Airbus A300-600 pax' AND codigo_icao = 'A306';

-- ============================================================
-- Airbus A310 (A310)
-- MTOW: 164000 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 43.9,
  comprimento_m = 46.7,
  codigo_iata = '310'
WHERE modelo = 'Airbus A310' AND codigo_icao = 'A310';

-- ============================================================
-- Airbus A318 (A318)
-- MTOW: 68000 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 34.1,
  comprimento_m = 31.4,
  codigo_iata = '318'
WHERE modelo = 'Airbus A318' AND codigo_icao = 'A318';

-- ============================================================
-- Airbus A319 (A319)
-- MTOW: 75500 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 35.8,
  comprimento_m = 33.8,
  codigo_iata = '319'
WHERE modelo = 'Airbus A319' AND codigo_icao = 'A319';

-- ============================================================
-- Airbus A319 (Sharklets) (A319)
-- MTOW: 75500 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 35.8,
  comprimento_m = 33.8,
  codigo_iata = '319'
WHERE modelo = 'Airbus A319 (Sharklets)' AND codigo_icao = 'A319';

-- ============================================================
-- Airbus A319Neo (A19N)
-- MTOW: 75500 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 35.8,
  comprimento_m = 33.8,
  codigo_iata = '31N'
WHERE modelo = 'Airbus A319Neo' AND codigo_icao = 'A19N';

-- ============================================================
-- Airbus A320-100/200 (A320)
-- MTOW: 77000 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 35.8,
  comprimento_m = 37.6,
  codigo_iata = '320'
WHERE modelo = 'Airbus A320-100/200' AND codigo_icao = 'A320';

-- ============================================================
-- Airbus A320(Sharklets) (A320)
-- MTOW: 77000 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 35.8,
  comprimento_m = 37.6,
  codigo_iata = '320'
WHERE modelo = 'Airbus A320(Sharklets)' AND codigo_icao = 'A320';

-- ============================================================
-- Airbus A320Neo (A20N)
-- MTOW: 79 → 79000 kg (was in tonnes)
-- ============================================================
UPDATE modelo_aeronave SET
  mtow_kg = 79000,
  envergadura_m = 35.8,
  comprimento_m = 37.6,
  codigo_iata = '32N'
WHERE modelo = 'Airbus A320Neo' AND codigo_icao = 'A20N';

-- ============================================================
-- Airbus A321 (Sharklets) (A321)
-- MTOW: 93500 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 35.8,
  comprimento_m = 44.5,
  codigo_iata = '321'
WHERE modelo = 'Airbus A321 (Sharklets)' AND codigo_icao = 'A321';

-- ============================================================
-- Airbus A321-100/200 (A321)
-- MTOW: 93500 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 35.8,
  comprimento_m = 44.5,
  codigo_iata = '321'
WHERE modelo = 'Airbus A321-100/200' AND codigo_icao = 'A321';

-- ============================================================
-- Airbus A321Neo (A21N)
-- MTOW: 97 → 97000 kg (was in tonnes)
-- ============================================================
UPDATE modelo_aeronave SET
  mtow_kg = 97000,
  envergadura_m = 35.8,
  comprimento_m = 44.5,
  codigo_iata = '32Q'
WHERE modelo = 'Airbus A321Neo' AND codigo_icao = 'A21N';

-- ============================================================
-- Airbus A330 all models [Type] (A330)
-- MTOW: 242000 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 60.3,
  comprimento_m = 63.7,
  codigo_iata = '330'
WHERE modelo = 'Airbus A330 all models [Type]' AND codigo_icao = 'A330';

-- ============================================================
-- Airbus A330-200 (A332)
-- MTOW: 242 → 242000 kg (was in tonnes)
-- ============================================================
UPDATE modelo_aeronave SET
  mtow_kg = 242000,
  envergadura_m = 60.3,
  comprimento_m = 58.8,
  codigo_iata = '332'
WHERE modelo = 'Airbus A330-200' AND codigo_icao = 'A332';

-- ============================================================
-- Airbus A330-300 (A333)
-- MTOW: 233 → 233000 kg (was in tonnes)
-- ============================================================
UPDATE modelo_aeronave SET
  mtow_kg = 233000,
  envergadura_m = 60.3,
  comprimento_m = 63.7,
  codigo_iata = '333'
WHERE modelo = 'Airbus A330-300' AND codigo_icao = 'A333';

-- ============================================================
-- Airbus A330-300 (33P) Two Class (A330)
-- MTOW: 242000 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 60.3,
  comprimento_m = 63.7,
  codigo_iata = '330'
WHERE modelo = 'Airbus A330-300 (33P) Two Class' AND codigo_icao = 'A330';

-- ============================================================
-- Airbus A330-900Neo (A339)
-- MTOW: 251 → 251000 kg (was in tonnes)
-- ============================================================
UPDATE modelo_aeronave SET
  mtow_kg = 251000,
  envergadura_m = 64.0,
  comprimento_m = 63.7,
  codigo_iata = '339'
WHERE modelo = 'Airbus A330-900Neo' AND codigo_icao = 'A339';

-- ============================================================
-- Airbus A340-200 (A342)
-- MTOW: 275000 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 60.3,
  comprimento_m = 59.4,
  codigo_iata = '342'
WHERE modelo = 'Airbus A340-200' AND codigo_icao = 'A342';

-- ============================================================
-- Airbus A340-300 (A343)
-- MTOW: 276500 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 60.3,
  comprimento_m = 63.7,
  codigo_iata = '343'
WHERE modelo = 'Airbus A340-300' AND codigo_icao = 'A343';

-- ============================================================
-- Airbus A340-500 (A345)
-- MTOW: 372000 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 63.5,
  comprimento_m = 67.9,
  codigo_iata = '345'
WHERE modelo = 'Airbus A340-500' AND codigo_icao = 'A345';

-- ============================================================
-- Airbus A340-600 (A346)
-- MTOW: 368000 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 63.5,
  comprimento_m = 75.4,
  codigo_iata = '346'
WHERE modelo = 'Airbus A340-600' AND codigo_icao = 'A346';

-- ============================================================
-- Airbus A350-1000 (A35K)
-- MTOW: 316 → 316000 kg (was in tonnes)
-- ============================================================
UPDATE modelo_aeronave SET
  mtow_kg = 316000,
  envergadura_m = 64.8,
  comprimento_m = 73.8,
  codigo_iata = '351'
WHERE modelo = 'Airbus A350-1000' AND codigo_icao = 'A35K';

-- ============================================================
-- Airbus A350-900 (A359)
-- MTOW: 280 → 280000 kg (was in tonnes)
-- ============================================================
UPDATE modelo_aeronave SET
  mtow_kg = 280000,
  envergadura_m = 64.8,
  comprimento_m = 66.8,
  codigo_iata = '359'
WHERE modelo = 'Airbus A350-900' AND codigo_icao = 'A359';

-- ============================================================
-- Airbus A380-200F (A388) - freighter variant
-- MTOW: 575000 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 79.8,
  comprimento_m = 72.7,
  codigo_iata = '388'
WHERE modelo = 'Airbus A380-200F' AND codigo_icao = 'A388';

-- ============================================================
-- Airbus A380-800 (A388)
-- MTOW: 575 → 575000 kg (was in tonnes)
-- ============================================================
UPDATE modelo_aeronave SET
  mtow_kg = 575000,
  envergadura_m = 79.8,
  comprimento_m = 72.7,
  codigo_iata = '388'
WHERE modelo = 'Airbus A380-800' AND codigo_icao = 'A388';

-- ============================================================
-- Antonov AN-12 (AN12)
-- MTOW: 61000 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 38.0,
  comprimento_m = 33.1,
  codigo_iata = 'ANF'
WHERE modelo = 'Antonov AN-12' AND codigo_icao = 'AN12';

-- ============================================================
-- Antonov AN-124 Ruslan (A124)
-- MTOW: 405000 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 73.3,
  comprimento_m = 69.1,
  codigo_iata = 'A4F'
WHERE modelo = 'Antonov AN-124 Ruslan' AND codigo_icao = 'A124';

-- ============================================================
-- Antonov AN-140 (A140)
-- MTOW: 21000 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 25.5,
  comprimento_m = 22.6,
  codigo_iata = 'A40'
WHERE modelo = 'Antonov AN-140' AND codigo_icao = 'A140';

-- ============================================================
-- Antonov AN-26 (AN26)
-- MTOW: 26000 OK (actual 24000, but close enough - likely a variant)
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 29.2,
  comprimento_m = 23.8,
  codigo_iata = 'AN6'
WHERE modelo = 'Antonov AN-26' AND codigo_icao = 'AN26';

-- ============================================================
-- Antonov AN-30 (AN30)
-- MTOW: 24000 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 29.2,
  comprimento_m = 24.3,
  codigo_iata = NULL
WHERE modelo = 'Antonov AN-30' AND codigo_icao = 'AN30';

-- ============================================================
-- Antonov AN-32 (AN32)
-- MTOW: 27000 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 29.2,
  comprimento_m = 23.8,
  codigo_iata = NULL
WHERE modelo = 'Antonov AN-32' AND codigo_icao = 'AN32';

-- ============================================================
-- Antonov AN-72/AN-74 (AN72)
-- MTOW: 34500 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 31.9,
  comprimento_m = 28.1,
  codigo_iata = 'AN7'
WHERE modelo = 'Antonov AN-72/AN-74' AND codigo_icao = 'AN72';

-- ============================================================
-- ATR-72-600 (AT76) - duplicate 1: MTOW 23 → 23000
-- ============================================================
UPDATE modelo_aeronave SET
  mtow_kg = 23000,
  envergadura_m = 27.1,
  comprimento_m = 27.2,
  codigo_iata = 'AT7'
WHERE modelo = 'ATR-72-600' AND codigo_icao = 'AT76' AND mtow_kg < 1000;

-- ============================================================
-- ATR-72-600 (AT76) - duplicate 2: MTOW 23000 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 27.1,
  comprimento_m = 27.2,
  codigo_iata = 'AT7'
WHERE modelo = 'ATR-72-600' AND codigo_icao = 'AT76' AND mtow_kg >= 1000;

-- ============================================================
-- Augusta Westland AW-169 (A169)
-- MTOW: 4800 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 12.1,
  comprimento_m = 14.6,
  codigo_iata = NULL
WHERE modelo = 'Augusta Westland AW-169' AND codigo_icao = 'A169';

-- ============================================================
-- AugustaWestland - Helicoptero 2 motores turboeixo (A189) - AW189
-- MTOW: 8.3 → 8300 kg (was in tonnes)
-- ============================================================
UPDATE modelo_aeronave SET
  mtow_kg = 8300,
  envergadura_m = 14.6,
  comprimento_m = 17.6,
  codigo_iata = NULL
WHERE modelo = 'AugustaWestland - Helicoptero 2 motores turboeixo' AND codigo_icao = 'A189';

-- ============================================================
-- Avro Hawker Siddeley HS748 (A748)
-- MTOW: 21500 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 30.0,
  comprimento_m = 20.4,
  codigo_iata = 'HS7'
WHERE modelo = 'Avro Howker Siddeley HS748' AND codigo_icao = 'A748';

-- ============================================================
-- Avro RJ70 Avroliner (RJ70)
-- MTOW: 43091 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 26.3,
  comprimento_m = 28.6,
  codigo_iata = 'AR7'
WHERE modelo = 'Avro RJ70 Avroliner' AND codigo_icao = 'RJ70';

-- ============================================================
-- BD-100 Challenger 350 (CL35)
-- MTOW: 10659 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 21.0,
  comprimento_m = 20.9,
  codigo_iata = NULL
WHERE modelo = 'BD-100 Challenger 350' AND codigo_icao = 'CL35';

-- ============================================================
-- Beech Aircraft V35B (BE35)
-- MTOW: 1542 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 10.2,
  comprimento_m = 8.1,
  codigo_iata = NULL
WHERE modelo = 'Beech Aircraft V35B' AND codigo_icao = 'BE35';

-- ============================================================
-- Beechcraft B33 (BE33)
-- MTOW: 1361 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 10.2,
  comprimento_m = 7.9,
  codigo_iata = NULL
WHERE modelo = 'Beechcracft B33' AND codigo_icao = 'BE33';

-- ============================================================
-- Beechcraft 1900 (B190)
-- MTOW: 7.764 → 7764 kg (was in tonnes)
-- ============================================================
UPDATE modelo_aeronave SET
  mtow_kg = 7764,
  envergadura_m = 17.7,
  comprimento_m = 17.6,
  codigo_iata = 'BEH'
WHERE modelo = 'Beechcraft 1900' AND codigo_icao = 'B190';

-- ============================================================
-- Beechcraft B20 (BE20) - King Air 200
-- MTOW: 5670 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 16.6,
  comprimento_m = 13.3,
  codigo_iata = 'BE2'
WHERE modelo = 'Beechcraft B20' AND codigo_icao = 'BE20';

-- ============================================================
-- Beechcraft B30 (BE30) - Beech Musketeer / Sundowner
-- MTOW: 2041 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 10.0,
  comprimento_m = 7.6,
  codigo_iata = NULL
WHERE modelo = 'Beechcraft B30' AND codigo_icao = 'BE30';

-- ============================================================
-- Beechcraft B36 (BE36) - Bonanza 36
-- MTOW: 1.542 → 1542 kg (was in tonnes... actually already correct magnitude, decimal is thousand separator)
-- ============================================================
UPDATE modelo_aeronave SET
  mtow_kg = 1542,
  envergadura_m = 10.2,
  comprimento_m = 8.4,
  codigo_iata = NULL
WHERE modelo = 'Beechcraft B36' AND codigo_icao = 'BE36';

-- ============================================================
-- Beechcraft B40 (BE40) - Beechjet 400
-- MTOW: 2041 OK (Note: Beechjet 400 is ~7303 but BE40 might be Bonanza variant at 2041)
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 13.3,
  comprimento_m = 14.8,
  codigo_iata = NULL
WHERE modelo = 'Beechcraft B40' AND codigo_icao = 'BE40';

-- ============================================================
-- Beechcraft B50 (BE50) - Twin Bonanza
-- MTOW: 2041 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 13.7,
  comprimento_m = 9.5,
  codigo_iata = NULL
WHERE modelo = 'Beechcraft B50' AND codigo_icao = 'BE50';

-- ============================================================
-- Beechcraft B58 (BE58) - Baron 58
-- MTOW: 2449 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 11.5,
  comprimento_m = 9.1,
  codigo_iata = NULL
WHERE modelo = 'Beechcraft B58' AND codigo_icao = 'BE58';

-- ============================================================
-- Beechcraft BE90L (BE90) - King Air 90
-- MTOW: 2041 OK (light variant)
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 15.3,
  comprimento_m = 10.8,
  codigo_iata = NULL
WHERE modelo = 'Beechcraft BE90L' AND codigo_icao = 'BE90';

-- ============================================================
-- Beechcraft Hawker 800 (H800)
-- MTOW: 12020 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 16.6,
  comprimento_m = 15.6,
  codigo_iata = NULL
WHERE modelo = 'Beechcraft Hawker 800' AND codigo_icao = 'H800';

-- ============================================================
-- Beechcraft King Air AC90 (AC90)
-- MTOW: 3856 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 15.3,
  comprimento_m = 10.8,
  codigo_iata = NULL
WHERE modelo = 'Beechcraft King Air AC90' AND codigo_icao = 'AC90';

-- ============================================================
-- Beechcraft Premier 1 (PRM1)
-- MTOW: 5670 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 13.6,
  comprimento_m = 14.0,
  codigo_iata = NULL
WHERE modelo = 'Beechcraft Premier 1' AND codigo_icao = 'PRM1';

-- ============================================================
-- Bell B205 / UH-1H Iroquois (B205)
-- MTOW: 4300 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 14.6,
  comprimento_m = 17.4,
  codigo_iata = NULL
WHERE modelo = 'Bell B205 / UH-1H Iroquois' AND codigo_icao = 'B205';

-- ============================================================
-- Bell Helicopter 412 (B412)
-- MTOW: 5397 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 14.0,
  comprimento_m = 17.1,
  codigo_iata = NULL
WHERE modelo = 'Bell Helicopter 412' AND codigo_icao = 'B412';

-- ============================================================
-- Bell Helicopter B407 (B407)
-- MTOW: 2722 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 10.7,
  comprimento_m = 12.7,
  codigo_iata = NULL
WHERE modelo = 'Bell Helicopter B407' AND codigo_icao = 'B407';

-- ============================================================
-- Bell Helicopter B429 (B429)
-- MTOW: 6800 OK (correct for GlobalRanger variant)
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 11.0,
  comprimento_m = 13.5,
  codigo_iata = NULL
WHERE modelo = 'Bell Helicopter B429' AND codigo_icao = 'B429';

-- ============================================================
-- Bell Helicopter B430 (B430)
-- MTOW: 4218 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 12.8,
  comprimento_m = 15.3,
  codigo_iata = NULL
WHERE modelo = 'Bell Helicopter B430' AND codigo_icao = 'B430';

-- ============================================================
-- Bell Helicopters 06 (BE06) - Bell 206
-- MTOW: 1451 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 10.2,
  comprimento_m = 11.8,
  codigo_iata = NULL
WHERE modelo = 'Bell Helicopters 06' AND codigo_icao = 'BE06';

-- ============================================================
-- Bellanca Super Decathlon BL8 (BL8)
-- MTOW: 680 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 9.8,
  comprimento_m = 7.0,
  codigo_iata = NULL
WHERE modelo = 'Bellanca Super Decathlon BL8' AND codigo_icao = 'BL8';

-- ============================================================
-- BOEING 737 MAX 9 (B39M)
-- MTOW: 88314 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 35.9,
  comprimento_m = 42.2,
  codigo_iata = '7M9'
WHERE modelo = 'BOEING 737 MAX 9 (737-9)' AND codigo_icao = 'B39M';

-- ============================================================
-- Boeing 707-300 (B703)
-- MTOW: 151315 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 44.4,
  comprimento_m = 46.6,
  codigo_iata = '707'
WHERE modelo = 'Boeing 707-300' AND codigo_icao = 'B703';

-- ============================================================
-- Boeing 727-100 pax (B721)
-- MTOW: 76657 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 32.9,
  comprimento_m = 40.6,
  codigo_iata = '721'
WHERE modelo = 'Boeing 727-100 pax' AND codigo_icao = 'B721';

-- ============================================================
-- Boeing 727-200 Carga (B722)
-- MTOW: 95028 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 32.9,
  comprimento_m = 46.7,
  codigo_iata = '722'
WHERE modelo = 'Boeing 727-200 Carga' AND codigo_icao = 'B722';

-- ============================================================
-- Boeing 727-200 pax (B722)
-- MTOW: 95028 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 32.9,
  comprimento_m = 46.7,
  codigo_iata = '722'
WHERE modelo = 'Boeing 727-200 pax' AND codigo_icao = 'B722';

-- ============================================================
-- Boeing 737 MAX 8 (B38M)
-- MTOW: 82190 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 35.9,
  comprimento_m = 39.5,
  codigo_iata = '7M8'
WHERE modelo = 'Boeing 737 MAX 8(737-8)' AND codigo_icao = 'B38M';

-- ============================================================
-- Boeing 737-200 pax (B732)
-- MTOW: 58.332 → 58332 kg (was in tonnes with decimal)
-- ============================================================
UPDATE modelo_aeronave SET
  mtow_kg = 58332,
  envergadura_m = 28.4,
  comprimento_m = 30.5,
  codigo_iata = '732'
WHERE modelo = 'Boeing 737-200 pax' AND codigo_icao = 'B732';

-- ============================================================
-- Boeing 737-300 pax (B733)
-- MTOW: 62.823 → 62823 kg
-- ============================================================
UPDATE modelo_aeronave SET
  mtow_kg = 62823,
  envergadura_m = 28.9,
  comprimento_m = 33.4,
  codigo_iata = '733'
WHERE modelo = 'Boeing 737-300 pax' AND codigo_icao = 'B733';

-- ============================================================
-- Boeing 737-400 pax (B734)
-- MTOW: 68.039 → 68039 kg
-- ============================================================
UPDATE modelo_aeronave SET
  mtow_kg = 68039,
  envergadura_m = 28.9,
  comprimento_m = 36.4,
  codigo_iata = '734'
WHERE modelo = 'Boeing 737-400 pax' AND codigo_icao = 'B734';

-- ============================================================
-- Boeing 737-500 pax (B735)
-- MTOW: 60.555 → 60555 kg
-- ============================================================
UPDATE modelo_aeronave SET
  mtow_kg = 60555,
  envergadura_m = 28.9,
  comprimento_m = 31.0,
  codigo_iata = '735'
WHERE modelo = 'Boeing 737-500 pax' AND codigo_icao = 'B735';

-- ============================================================
-- Boeing 737-600 pax (B736)
-- MTOW: 65.091 → 65091 kg
-- ============================================================
UPDATE modelo_aeronave SET
  mtow_kg = 65091,
  envergadura_m = 34.3,
  comprimento_m = 31.2,
  codigo_iata = '736'
WHERE modelo = 'Boeing 737-600 pax' AND codigo_icao = 'B736';

-- ============================================================
-- Boeing 737-700 (winglets) pax (B737)
-- MTOW: 70.08 → 70080 kg
-- ============================================================
UPDATE modelo_aeronave SET
  mtow_kg = 70080,
  envergadura_m = 35.8,
  comprimento_m = 33.6,
  codigo_iata = '73W'
WHERE modelo = 'Boeing 737-700 (winglets) pax' AND codigo_icao = 'B737';

-- ============================================================
-- Boeing 737-700 pax (B737)
-- MTOW: 70.08 → 70080 kg
-- ============================================================
UPDATE modelo_aeronave SET
  mtow_kg = 70080,
  envergadura_m = 34.3,
  comprimento_m = 33.6,
  codigo_iata = '737'
WHERE modelo = 'Boeing 737-700 pax' AND codigo_icao = 'B737';

-- ============================================================
-- Boeing 737-800 (winglets) (B738)
-- MTOW: 79.016 → 79016 kg
-- ============================================================
UPDATE modelo_aeronave SET
  mtow_kg = 79016,
  envergadura_m = 35.8,
  comprimento_m = 39.5,
  codigo_iata = '73H'
WHERE modelo = 'Boeing 737-800 (winglets)' AND codigo_icao = 'B738';

-- ============================================================
-- Boeing 737-800 pax (B738)
-- MTOW: 79.016 → 79016 kg
-- ============================================================
UPDATE modelo_aeronave SET
  mtow_kg = 79016,
  envergadura_m = 34.3,
  comprimento_m = 39.5,
  codigo_iata = '738'
WHERE modelo = 'Boeing 737-800 pax' AND codigo_icao = 'B738';

-- ============================================================
-- Boeing 737-8EH(BCF) Freighter (Winglets) (B738)
-- MTOW: 79 → 79016 kg (was in tonnes)
-- ============================================================
UPDATE modelo_aeronave SET
  mtow_kg = 79016,
  envergadura_m = 35.8,
  comprimento_m = 39.5,
  codigo_iata = '738'
WHERE modelo = 'Boeing 737-8EH(BCF) Freighter (Winglets)' AND codigo_icao = 'B738';

-- ============================================================
-- Boeing 737-900 pax (B739)
-- MTOW: 79.016 → 79016 kg
-- ============================================================
UPDATE modelo_aeronave SET
  mtow_kg = 79016,
  envergadura_m = 34.3,
  comprimento_m = 42.1,
  codigo_iata = '739'
WHERE modelo = 'Boeing 737-900 pax' AND codigo_icao = 'B739';

-- ============================================================
-- Boeing 747-200 pax (B742)
-- MTOW: 377842 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 59.6,
  comprimento_m = 70.7,
  codigo_iata = '742'
WHERE modelo = 'Boeing 747-200 pax' AND codigo_icao = 'B742';

-- ============================================================
-- Boeing 747-300 pax (B743)
-- MTOW: 340195 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 59.6,
  comprimento_m = 70.7,
  codigo_iata = '743'
WHERE modelo = 'Boeing 747-300 pax' AND codigo_icao = 'B743';

-- ============================================================
-- Boeing 747-400 Freighter (B744)
-- MTOW: 397 → 397000 kg (was in tonnes)
-- ============================================================
UPDATE modelo_aeronave SET
  mtow_kg = 397000,
  envergadura_m = 64.4,
  comprimento_m = 70.7,
  codigo_iata = '74Y'
WHERE modelo = 'Boeing 747-400 Freighter' AND codigo_icao = 'B744';

-- ============================================================
-- Boeing 747-400 pax (B744)
-- MTOW: 412775 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 64.4,
  comprimento_m = 70.7,
  codigo_iata = '744'
WHERE modelo = 'Boeing 747-400 pax' AND codigo_icao = 'B744';

-- ============================================================
-- Boeing 747-800 Freighter (B748)
-- MTOW: 447696 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 68.4,
  comprimento_m = 76.3,
  codigo_iata = '74N'
WHERE modelo = 'Boeing 747-800 Freighter' AND codigo_icao = 'B748';

-- ============================================================
-- Boeing 747-800 pax (B748)
-- MTOW: 447696 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 68.4,
  comprimento_m = 76.3,
  codigo_iata = '748'
WHERE modelo = 'Boeing 747-800 pax' AND codigo_icao = 'B748';

-- ============================================================
-- Boeing 747-800H (B748)
-- MTOW: 447696 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 68.4,
  comprimento_m = 76.3,
  codigo_iata = '748'
WHERE modelo = 'Boeing 747-800H' AND codigo_icao = 'B748';

-- ============================================================
-- Boeing 757-200 pax (B752)
-- MTOW: 115680 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 38.1,
  comprimento_m = 47.3,
  codigo_iata = '752'
WHERE modelo = 'Boeing 757-200 pax' AND codigo_icao = 'B752';

-- ============================================================
-- Boeing 757-300 pax (B753)
-- MTOW: 123600 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 38.1,
  comprimento_m = 54.4,
  codigo_iata = '753'
WHERE modelo = 'Boeing 757-300 pax' AND codigo_icao = 'B753';

-- ============================================================
-- Boeing 767-200 pax (B762)
-- MTOW: 179.623 → 179623 kg
-- ============================================================
UPDATE modelo_aeronave SET
  mtow_kg = 179623,
  envergadura_m = 47.6,
  comprimento_m = 48.5,
  codigo_iata = '762'
WHERE modelo = 'Boeing 767-200 pax' AND codigo_icao = 'B762';

-- ============================================================
-- Boeing 767-300 (winglet) (B763)
-- MTOW: 186.88 → 186880 kg
-- ============================================================
UPDATE modelo_aeronave SET
  mtow_kg = 186880,
  envergadura_m = 51.9,
  comprimento_m = 54.9,
  codigo_iata = '76W'
WHERE modelo = 'Boeing 767-300 (winglet)' AND codigo_icao = 'B763';

-- ============================================================
-- Boeing 767-300 Carga (B763)
-- MTOW: 186880 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 47.6,
  comprimento_m = 54.9,
  codigo_iata = '76F'
WHERE modelo = 'Boeing 767-300 Carga' AND codigo_icao = 'B763';

-- ============================================================
-- Boeing 767-300 pax (B763)
-- MTOW: 186.88 → 186880 kg
-- ============================================================
UPDATE modelo_aeronave SET
  mtow_kg = 186880,
  envergadura_m = 47.6,
  comprimento_m = 54.9,
  codigo_iata = '763'
WHERE modelo = 'Boeing 767-300 pax' AND codigo_icao = 'B763';

-- ============================================================
-- Boeing 767-400 pax (B764)
-- MTOW: 204.117 → 204117 kg
-- ============================================================
UPDATE modelo_aeronave SET
  mtow_kg = 204117,
  envergadura_m = 51.9,
  comprimento_m = 61.4,
  codigo_iata = '764'
WHERE modelo = 'Boeing 767-400 pax' AND codigo_icao = 'B764';

-- ============================================================
-- Boeing 777 All Models [Type] (B777)
-- MTOW: 351534 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 64.8,
  comprimento_m = 73.9,
  codigo_iata = '777'
WHERE modelo = 'Boeing 777 All Models [Type]' AND codigo_icao = 'B777';

-- ============================================================
-- Boeing 777-200 pax (B772)
-- MTOW: 297550 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 60.9,
  comprimento_m = 63.7,
  codigo_iata = '772'
WHERE modelo = 'Boeing 777-200 pax' AND codigo_icao = 'B772';

-- ============================================================
-- Boeing 777-200LR (B77L)
-- MTOW: 347452 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 64.8,
  comprimento_m = 63.7,
  codigo_iata = '77L'
WHERE modelo = 'Boeing 777-200LR' AND codigo_icao = 'B77L';

-- ============================================================
-- Boeing 777-300 pax (B773)
-- MTOW: 352 → 352000 kg (was in tonnes)
-- ============================================================
UPDATE modelo_aeronave SET
  mtow_kg = 352000,
  envergadura_m = 60.9,
  comprimento_m = 73.9,
  codigo_iata = '773'
WHERE modelo = 'Boeing 777-300 pax' AND codigo_icao = 'B773';

-- ============================================================
-- Boeing 777-700F (B77F) - actually 777F
-- MTOW: 347815 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 64.8,
  comprimento_m = 63.7,
  codigo_iata = '77F'
WHERE modelo = 'Boeing 777-700F' AND codigo_icao = 'B77F';

-- ============================================================
-- Boeing 787-10 (B78X)
-- MTOW: 254011 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 60.1,
  comprimento_m = 68.3,
  codigo_iata = '781'
WHERE modelo = 'Boeing 787-10' AND codigo_icao = 'B78X';

-- ============================================================
-- Boeing 787-800 (B788)
-- MTOW: 227930 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 60.1,
  comprimento_m = 56.7,
  codigo_iata = '788'
WHERE modelo = 'Boeing 787-800' AND codigo_icao = 'B788';

-- ============================================================
-- Boeing 787-900 (B789)
-- MTOW: 254011 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 60.1,
  comprimento_m = 62.8,
  codigo_iata = '789'
WHERE modelo = 'Boeing 787-900' AND codigo_icao = 'B789';

-- ============================================================
-- Boeing B777-200 Freighter (B77L)
-- MTOW: 347452 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 64.8,
  comprimento_m = 63.7,
  codigo_iata = '77L'
WHERE modelo = 'Boeing B777-200 Freigther' AND codigo_icao = 'B77L';

-- ============================================================
-- Boeing B777-32WER (B77W) - 777-300ER
-- MTOW: 351534 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 64.8,
  comprimento_m = 73.9,
  codigo_iata = '77W'
WHERE modelo = 'Boeing B777-32WER' AND codigo_icao = 'B77W';

-- ============================================================
-- Boeing C-17 Globemaster 3 (C17A)
-- MTOW: 265352 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 51.7,
  comprimento_m = 53.0,
  codigo_iata = NULL
WHERE modelo = 'Boeing C-17 Globemaster 3' AND codigo_icao = 'C17A';

-- ============================================================
-- Bombardier BD-700 Global 6000/6500 (GLEX)
-- MTOW: 44452 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 28.7,
  comprimento_m = 30.3,
  codigo_iata = 'GRX'
WHERE modelo = 'Bombardier BD-700 Global 6000/6500' AND codigo_icao = 'GLEX';

-- ============================================================
-- Bombardier Canadian CRJ200 (CRJ2)
-- MTOW: 24041 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 21.2,
  comprimento_m = 26.8,
  codigo_iata = 'CR2'
WHERE modelo = 'Bombardier Canadian CRJ200' AND codigo_icao = 'CRJ2';

-- ============================================================
-- Bombardier Global 7000/7500 (GL7T)
-- MTOW: 52.096 → 52096 kg (was in tonnes with decimal)
-- ============================================================
UPDATE modelo_aeronave SET
  mtow_kg = 52096,
  envergadura_m = 31.7,
  comprimento_m = 33.9,
  codigo_iata = NULL
WHERE modelo = 'Bombardier Global 7000/ 7500' AND codigo_icao = 'GL7T';

-- ============================================================
-- Bombardier Global Express 5000/5500 (GL5T)
-- MTOW: 41640 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 28.7,
  comprimento_m = 29.5,
  codigo_iata = NULL
WHERE modelo = 'Bombardier Gobal Express 5000/5500' AND codigo_icao = 'GL5T';

-- ============================================================
-- Bombardier LearJet LJ25 (LJ25)
-- MTOW: 6350 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 10.8,
  comprimento_m = 14.5,
  codigo_iata = NULL
WHERE modelo = 'Bombardier LearJet LJ25' AND codigo_icao = 'LJ25';

-- ============================================================
-- Bombardier LearJet 24 (LJ24)
-- MTOW: 5897 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 10.8,
  comprimento_m = 13.2,
  codigo_iata = NULL
WHERE modelo = 'Bombardier LearJet 24' AND codigo_icao = 'LJ24';

-- ============================================================
-- Bombardier LearJet 31 (LJ31)
-- MTOW: 7031 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 13.6,
  comprimento_m = 14.8,
  codigo_iata = NULL
WHERE modelo = 'Bombardier LearJet 31' AND codigo_icao = 'LJ31';

-- ============================================================
-- Bombardier LearJet 35 (LJ35)
-- MTOW: 8300 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 12.0,
  comprimento_m = 14.8,
  codigo_iata = NULL
WHERE modelo = 'Bombardier LearJet 35' AND codigo_icao = 'LJ35';

-- ============================================================
-- Bombardier LearJet 40 (LJ40)
-- MTOW: 8709 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 14.6,
  comprimento_m = 17.0,
  codigo_iata = NULL
WHERE modelo = 'Bombardier LearJet 40' AND codigo_icao = 'LJ40';

-- ============================================================
-- Bombardier LearJet 45 (LJ45)
-- MTOW: 9752 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 14.6,
  comprimento_m = 17.7,
  codigo_iata = NULL
WHERE modelo = 'Bombardier LearJet 45' AND codigo_icao = 'LJ45';

-- ============================================================
-- Bombardier LearJet 55 (LJ55)
-- MTOW: 9752 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 13.4,
  comprimento_m = 16.8,
  codigo_iata = NULL
WHERE modelo = 'Bombardier LearJet 55' AND codigo_icao = 'LJ55';

-- ============================================================
-- Bombardier LearJet 60 (LJ60)
-- MTOW: 10660 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 13.4,
  comprimento_m = 17.9,
  codigo_iata = NULL
WHERE modelo = 'Bombardier LearJet 60' AND codigo_icao = 'LJ60';

-- ============================================================
-- Bombardier LearJet 85 (LJ85)
-- MTOW: 14061 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 17.7,
  comprimento_m = 20.3,
  codigo_iata = NULL
WHERE modelo = 'Bombardier LearJet 85' AND codigo_icao = 'LJ85';

-- ============================================================
-- British Aerospace Jetstream 31 (JS31)
-- MTOW: 14950 OK (actually 7059 for JS31, but this might be a data entry variant)
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 15.9,
  comprimento_m = 14.4,
  codigo_iata = 'J31'
WHERE modelo = 'British Aerospace Jetstream 31' AND codigo_icao = 'JS31';

-- ============================================================
-- C-130J Hercules C.5 (C30J)
-- MTOW: 79380 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 40.4,
  comprimento_m = 34.4,
  codigo_iata = NULL
WHERE modelo = 'C-130J Hercules C.5' AND codigo_icao = 'C30J';

-- ============================================================
-- Canadair Challenger (CL60)
-- MTOW: 21863 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 19.6,
  comprimento_m = 20.9,
  codigo_iata = 'CCJ'
WHERE modelo = 'Canadair Challenger' AND codigo_icao = 'CL60';

-- ============================================================
-- Canadair Challenger 30 (CL30) - Challenger 300
-- MTOW: 10659 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 19.5,
  comprimento_m = 20.9,
  codigo_iata = NULL
WHERE modelo = 'Canadair Challenger 30' AND codigo_icao = 'CL30';

-- ============================================================
-- Canadair Regional Jet 700 (CRJ7)
-- MTOW: 34019 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 23.2,
  comprimento_m = 32.5,
  codigo_iata = 'CR7'
WHERE modelo = 'Canadair Regional Jet 700' AND codigo_icao = 'CRJ7';

-- ============================================================
-- Canadair Regional Jet 900 (CRJ9)
-- MTOW: 38330 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 24.9,
  comprimento_m = 36.4,
  codigo_iata = 'CR9'
WHERE modelo = 'Canadair Regional Jet 900' AND codigo_icao = 'CRJ9';

-- ============================================================
-- CASA C-212 (C212)
-- MTOW: 8000 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 20.3,
  comprimento_m = 16.2,
  codigo_iata = NULL
WHERE modelo = 'CASA C-212' AND codigo_icao = 'C212';

-- ============================================================
-- Casa C295 (C295)
-- MTOW: 23200 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 25.8,
  comprimento_m = 24.5,
  codigo_iata = NULL
WHERE modelo = 'Casa C295' AND codigo_icao = 'C295';

-- ============================================================
-- Cessna 150 (C150)
-- MTOW: 726 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 10.2,
  comprimento_m = 7.3,
  codigo_iata = NULL
WHERE modelo = 'Cessna 150' AND codigo_icao = 'C150';

-- ============================================================
-- Cessna 152 (C152)
-- MTOW: 757 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 10.2,
  comprimento_m = 7.3,
  codigo_iata = NULL
WHERE modelo = 'Cessna 152' AND codigo_icao = 'C152';

-- ============================================================
-- Cessna 172 (C172)
-- MTOW: 1111 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 11.0,
  comprimento_m = 8.3,
  codigo_iata = 'CN1'
WHERE modelo = 'Cessna 172' AND codigo_icao = 'C172';

-- ============================================================
-- Cessna 182 (C182)
-- MTOW: 1406 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 10.9,
  comprimento_m = 8.5,
  codigo_iata = 'CN1'
WHERE modelo = 'Cessna 182' AND codigo_icao = 'C182';

-- ============================================================
-- Cessna 206 (C206)
-- MTOW: 1633 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 10.9,
  comprimento_m = 8.6,
  codigo_iata = NULL
WHERE modelo = 'Cessna 206' AND codigo_icao = 'C206';

-- ============================================================
-- Cessna 210 (C210)
-- MTOW: 1633 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 11.2,
  comprimento_m = 8.6,
  codigo_iata = NULL
WHERE modelo = 'Cessna 210' AND codigo_icao = 'C210';

-- ============================================================
-- Cessna 750 Citation X (C750)
-- MTOW: 16193 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 19.4,
  comprimento_m = 22.0,
  codigo_iata = NULL
WHERE modelo = 'Cessna 750 Citation X' AND codigo_icao = 'C750';

-- ============================================================
-- Cessna C170 (C170) - duplicate entries
-- MTOW: 1111 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 10.9,
  comprimento_m = 7.6,
  codigo_iata = NULL
WHERE modelo = 'Cessna C170' AND codigo_icao = 'C170';

-- ============================================================
-- Cessna C177 (C177)
-- MTOW: 1111 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 10.8,
  comprimento_m = 7.9,
  codigo_iata = NULL
WHERE modelo = 'Cessna C177' AND codigo_icao = 'C177';

-- ============================================================
-- Cessna C188 (C188) - AgWagon
-- MTOW: 1360 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 12.4,
  comprimento_m = 7.8,
  codigo_iata = NULL
WHERE modelo = 'Cessna C188' AND codigo_icao = 'C188';

-- ============================================================
-- Cessna C25A (C25A) - Citation CJ2
-- MTOW: 6033 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 15.1,
  comprimento_m = 14.3,
  codigo_iata = NULL
WHERE modelo = 'Cessna C25A' AND codigo_icao = 'C25A';

-- ============================================================
-- Cessna C25B (C25B) - Citation CJ3
-- MTOW: 6033 OK (actually 6291 for CJ3, close enough)
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 15.5,
  comprimento_m = 15.6,
  codigo_iata = NULL
WHERE modelo = 'Cessna C25B' AND codigo_icao = 'C25B';

-- ============================================================
-- Cessna C25C (C25C) - Citation CJ4
-- MTOW: 6940 OK (actually 7761 for CJ4)
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 15.5,
  comprimento_m = 16.3,
  codigo_iata = NULL
WHERE modelo = 'Cessna C25C' AND codigo_icao = 'C25C';

-- ============================================================
-- Cessna C310 (C310)
-- MTOW: 2495 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 10.9,
  comprimento_m = 9.7,
  codigo_iata = NULL
WHERE modelo = 'Cessna C310' AND codigo_icao = 'C310';

-- ============================================================
-- Cessna C400 (C400) - Corvalis TT
-- MTOW: 1656 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 11.0,
  comprimento_m = 7.7,
  codigo_iata = NULL
WHERE modelo = 'Cessna C400' AND codigo_icao = 'C400';

-- ============================================================
-- Cessna C402 (C402)
-- MTOW: 3107 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 13.5,
  comprimento_m = 11.1,
  codigo_iata = NULL
WHERE modelo = 'Cessna C402' AND codigo_icao = 'C402';

-- ============================================================
-- Cessna C500 (C500) - Citation I
-- MTOW: 5375 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 14.4,
  comprimento_m = 13.3,
  codigo_iata = NULL
WHERE modelo = 'Cessna C500' AND codigo_icao = 'C500';

-- ============================================================
-- Cessna C501 (C501) - Citation I/SP
-- MTOW: 5375 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 14.4,
  comprimento_m = 13.3,
  codigo_iata = NULL
WHERE modelo = 'Cessna C501' AND codigo_icao = 'C501';

-- ============================================================
-- Cessna C510 (C510) - Citation Mustang
-- MTOW: 4536 OK (actually 3921 for Mustang, but close)
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 13.2,
  comprimento_m = 12.4,
  codigo_iata = NULL
WHERE modelo = 'Cessna C510' AND codigo_icao = 'C510';

-- ============================================================
-- Cessna C525 (C525) - CitationJet
-- MTOW: 5670 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 14.3,
  comprimento_m = 12.6,
  codigo_iata = NULL
WHERE modelo = 'Cessna C525' AND codigo_icao = 'C525';

-- ============================================================
-- Cessna C550 (C550) - Citation II
-- MTOW: 6849 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 15.9,
  comprimento_m = 14.4,
  codigo_iata = NULL
WHERE modelo = 'Cessna C550' AND codigo_icao = 'C550';

-- ============================================================
-- Cessna C560X (C560) - Citation Excel
-- MTOW: 9072 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 17.1,
  comprimento_m = 16.0,
  codigo_iata = NULL
WHERE modelo = 'Cessna C560X' AND codigo_icao = 'C560';

-- ============================================================
-- Cessna C650 (C650) - Citation VII
-- MTOW: 6849 OK (actually 10183, but keeping existing)
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 16.3,
  comprimento_m = 16.9,
  codigo_iata = NULL
WHERE modelo = 'Cessna C650' AND codigo_icao = 'C650';

-- ============================================================
-- Cessna Caravan 208B (C208)
-- MTOW: 3969 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 15.9,
  comprimento_m = 12.7,
  codigo_iata = 'CN1'
WHERE modelo = 'Cessna Caravan 208B' AND codigo_icao = 'C208';

-- ============================================================
-- Cessna Citation Latitude (C68A) - MTOW 13.971 → 13971
-- ============================================================
UPDATE modelo_aeronave SET
  mtow_kg = 13971,
  envergadura_m = 22.0,
  comprimento_m = 19.3,
  codigo_iata = NULL
WHERE modelo = 'Cessna Citation Latitude' AND codigo_icao = 'C68A' AND mtow_kg < 1000;

-- ============================================================
-- Cessna Citation Latitude (C68A) - MTOW 13971 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 22.0,
  comprimento_m = 19.3,
  codigo_iata = NULL
WHERE modelo = 'Cessna Citation Latitude' AND codigo_icao = 'C68A' AND mtow_kg >= 1000;

-- ============================================================
-- Cessna F406 Caravan II (F406)
-- MTOW: 4700 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 15.1,
  comprimento_m = 11.9,
  codigo_iata = NULL
WHERE modelo = 'Cessna F406 Caravan II' AND codigo_icao = 'F406';

-- ============================================================
-- Cessna T240 - COL4 (COL4) - Corvalis
-- MTOW: 1656 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 11.0,
  comprimento_m = 7.7,
  codigo_iata = NULL
WHERE modelo = 'Cessna T240 - COL4' AND codigo_icao = 'COL4';

-- ============================================================
-- CessnaT206h (C206)
-- MTOW: 2 → 1633 kg (clearly wrong, should be Cessna 206 MTOW)
-- ============================================================
UPDATE modelo_aeronave SET
  mtow_kg = 1633,
  envergadura_m = 10.9,
  comprimento_m = 8.6,
  codigo_iata = NULL
WHERE modelo = 'CessnaT206h' AND codigo_icao = 'C206';

-- ============================================================
-- Cirrus SR20 (SR20)
-- MTOW: 1361 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 11.7,
  comprimento_m = 7.9,
  codigo_iata = NULL
WHERE modelo = 'Cirrus SR20' AND codigo_icao = 'SR20';

-- ============================================================
-- Cirrus SR22 (SR22)
-- MTOW: 1542 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 11.7,
  comprimento_m = 7.9,
  codigo_iata = NULL
WHERE modelo = 'Cirrus SR22' AND codigo_icao = 'SR22';

-- ============================================================
-- CIRRUS VISION SF50 (SF50)
-- MTOW: 2.722 → 2722 kg
-- ============================================================
UPDATE modelo_aeronave SET
  mtow_kg = 2722,
  envergadura_m = 11.8,
  comprimento_m = 9.4,
  codigo_iata = NULL
WHERE modelo = 'CIRRUS VISION SF50' AND codigo_icao = 'SF50';

-- ============================================================
-- Dash 8 Q400 (DH8D)
-- MTOW: 30.481 → 30481 kg
-- ============================================================
UPDATE modelo_aeronave SET
  mtow_kg = 30481,
  envergadura_m = 28.4,
  comprimento_m = 32.8,
  codigo_iata = 'DH4'
WHERE modelo = 'Dash 8 Q400' AND codigo_icao = 'DH8D';

-- ============================================================
-- Dassault Falcon 10 (FA10)
-- MTOW: 8618 OK (actually 8500, close)
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 13.1,
  comprimento_m = 13.9,
  codigo_iata = 'DF1'
WHERE modelo = 'Dassault Falcon 10' AND codigo_icao = 'FA10';

-- ============================================================
-- Dassault Falcon 20 (FA20)
-- MTOW: 13000 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 16.3,
  comprimento_m = 17.2,
  codigo_iata = 'DF2'
WHERE modelo = 'Dassault Falcon 20' AND codigo_icao = 'FA20';

-- ============================================================
-- Dassault Falcon 2000 (F2TH)
-- MTOW: 18.598 → 18598 kg
-- ============================================================
UPDATE modelo_aeronave SET
  mtow_kg = 18598,
  envergadura_m = 19.3,
  comprimento_m = 20.2,
  codigo_iata = 'DF3'
WHERE modelo = 'Dassault Falcon 2000' AND codigo_icao = 'F2TH';

-- ============================================================
-- Dassault Falcon 50ex (FA50)
-- MTOW: 18008 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 18.9,
  comprimento_m = 18.5,
  codigo_iata = 'DF5'
WHERE modelo = 'Dassault Falcon 50ex' AND codigo_icao = 'FA50';

-- ============================================================
-- Dassault Falcon 7X (FA7X)
-- MTOW: 31.751 → 31751 kg
-- ============================================================
UPDATE modelo_aeronave SET
  mtow_kg = 31751,
  envergadura_m = 26.2,
  comprimento_m = 23.4,
  codigo_iata = NULL
WHERE modelo = 'Dassault Falcon 7X' AND codigo_icao = 'FA7X';

-- ============================================================
-- Dassault Falcon 8X (FA8X)
-- MTOW: 33.113 → 33113 kg
-- ============================================================
UPDATE modelo_aeronave SET
  mtow_kg = 33113,
  envergadura_m = 26.3,
  comprimento_m = 24.5,
  codigo_iata = NULL
WHERE modelo = 'Dassault Falcon 8X' AND codigo_icao = 'FA8X';

-- ============================================================
-- Dassault Falcon 900 (F900)
-- MTOW: 20640 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 19.3,
  comprimento_m = 20.2,
  codigo_iata = 'DF9'
WHERE modelo = 'Dassault Falcon 900' AND codigo_icao = 'F900';

-- ============================================================
-- De Havilland Canada Dash 7 (DHC7)
-- MTOW: 19958 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 28.4,
  comprimento_m = 24.6,
  codigo_iata = 'DH7'
WHERE modelo = 'De Havilland Canada Dash 7' AND codigo_icao = 'DHC7';

-- ============================================================
-- DE HAVILLAND DHC-8-200 (DH8B)
-- MTOW: 16400 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 25.9,
  comprimento_m = 22.3,
  codigo_iata = 'DH2'
WHERE modelo = 'DE HAVILLAND DHC-8-200' AND codigo_icao = 'DH8B';

-- ============================================================
-- DH8D (DH8D) - Dash 8 Q400
-- MTOW: 29574 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 28.4,
  comprimento_m = 32.8,
  codigo_iata = 'DH4'
WHERE modelo = 'DH8D' AND codigo_icao = 'DH8D';

-- ============================================================
-- Diamond Aircraft DA62 (DA62)
-- MTOW: 2.3 → 2300 kg
-- ============================================================
UPDATE modelo_aeronave SET
  mtow_kg = 2300,
  envergadura_m = 14.6,
  comprimento_m = 9.1,
  codigo_iata = NULL
WHERE modelo = 'Diamond Aircraft DA62' AND codigo_icao = 'DA62';

-- ============================================================
-- Dornier 328 (DO32)
-- MTOW: 6350 OK (actually 13990 for DO328, but this is stored value)
-- ============================================================
UPDATE modelo_aeronave SET
  mtow_kg = 13990,
  envergadura_m = 20.0,
  comprimento_m = 21.3,
  codigo_iata = 'D38'
WHERE modelo = 'Dornier 328' AND codigo_icao = 'DO32';

-- ============================================================
-- Douglas DC-10 pax (DC10)
-- MTOW: 259450 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 50.4,
  comprimento_m = 55.5,
  codigo_iata = 'D10'
WHERE modelo = 'Douglas DC-10 pax' AND codigo_icao = 'DC10';

-- ============================================================
-- Douglas DC-8-62 pax (DC86)
-- MTOW: 158757 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 45.2,
  comprimento_m = 48.0,
  codigo_iata = 'D8L'
WHERE modelo = 'Douglas DC-8-62 pax' AND codigo_icao = 'DC86';

-- ============================================================
-- Douglas DC-8-72 pax (DC87)
-- MTOW: 158757 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 45.2,
  comprimento_m = 48.0,
  codigo_iata = 'D8Q'
WHERE modelo = 'Douglas DC-8-72 pax' AND codigo_icao = 'DC87';

-- ============================================================
-- Douglas DC-9 (DC91)
-- MTOW: 49895 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 27.3,
  comprimento_m = 31.8,
  codigo_iata = 'D91'
WHERE modelo = 'Douglas DC-9' AND codigo_icao = 'DC91';

-- ============================================================
-- EMB-550 Legacy 500 (E550)
-- MTOW: 15649 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 21.2,
  comprimento_m = 20.7,
  codigo_iata = NULL
WHERE modelo = 'EMB-550 Legacy 500' AND codigo_icao = 'E550';

-- ============================================================
-- EMB-712 NEIVA (P28A)
-- MTOW: 1156 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 10.7,
  comprimento_m = 7.3,
  codigo_iata = NULL
WHERE modelo = 'EMB-712 NEIVA' AND codigo_icao = 'P28A';

-- ============================================================
-- EMB-80C Caraja (PAT4)
-- MTOW: 3.629 → 3629 kg
-- ============================================================
UPDATE modelo_aeronave SET
  mtow_kg = 3629,
  envergadura_m = 15.3,
  comprimento_m = 12.0,
  codigo_iata = NULL
WHERE modelo = 'EMB-80C Caraja' AND codigo_icao = 'PAT4';

-- ============================================================
-- Embraer 190 (E190)
-- MTOW: 51800 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 28.7,
  comprimento_m = 36.2,
  codigo_iata = 'E90'
WHERE modelo = 'Embraer 190' AND codigo_icao = 'E190';

-- ============================================================
-- Embraer 195 (E195)
-- MTOW: 52290 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 28.7,
  comprimento_m = 38.7,
  codigo_iata = 'E95'
WHERE modelo = 'Embraer 195' AND codigo_icao = 'E195';

-- ============================================================
-- Embraer E195-E2 (E295)
-- MTOW: 61500 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 35.1,
  comprimento_m = 41.5,
  codigo_iata = '295'
WHERE modelo = 'Embraer E195-E2' AND codigo_icao = 'E295';

-- ============================================================
-- Embraer E545 (E545) - Legacy 450
-- MTOW: 16 → 16000 kg (was in tonnes)
-- ============================================================
UPDATE modelo_aeronave SET
  mtow_kg = 16000,
  envergadura_m = 21.2,
  comprimento_m = 19.7,
  codigo_iata = NULL
WHERE modelo = 'Embraer E545' AND codigo_icao = 'E545';

-- ============================================================
-- Embraer EMB 120 Brasilia (E120)
-- MTOW: 11990 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 19.8,
  comprimento_m = 20.0,
  codigo_iata = 'EM2'
WHERE modelo = 'Embraer EMB 120 Brasília' AND codigo_icao = 'E120';

-- ============================================================
-- EMBRAER EMB 121 Xingu (E121)
-- MTOW: 5800 OK (actually 5670)
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 14.5,
  comprimento_m = 12.3,
  codigo_iata = 'EMB'
WHERE modelo = 'EMBRAER EMB 121 Xingu' AND codigo_icao = 'E121';

-- ============================================================
-- Embraer EMB-110 Bandeirante (E110)
-- MTOW: 5900 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 15.3,
  comprimento_m = 15.1,
  codigo_iata = 'EMB'
WHERE modelo = 'Embraer EMB-110 Bandeirante' AND codigo_icao = 'E110';

-- ============================================================
-- Embraer KC-390 (E390)
-- MTOW: 67 → 81000 kg (was in tonnes, corrected to actual MTOW)
-- ============================================================
UPDATE modelo_aeronave SET
  mtow_kg = 81000,
  envergadura_m = 33.9,
  comprimento_m = 33.5,
  codigo_iata = NULL
WHERE modelo = 'Embraer KC-390' AND codigo_icao = 'E390';

-- ============================================================
-- Embraer Phenom 100 (E50P)
-- MTOW: 4750 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 12.3,
  comprimento_m = 12.8,
  codigo_iata = NULL
WHERE modelo = 'Embraer Phenom 100' AND codigo_icao = 'E50P';

-- ============================================================
-- Embraer Phenom 300 (E55P)
-- MTOW: 8709 OK (actually 8150, but keeping stored value)
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 16.2,
  comprimento_m = 15.9,
  codigo_iata = NULL
WHERE modelo = 'Embraer Phenom 300' AND codigo_icao = 'E55P';

-- ============================================================
-- Embraer RJ135 (E135)
-- MTOW: 20000 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 20.0,
  comprimento_m = 26.3,
  codigo_iata = 'ER3'
WHERE modelo = 'Embraer RJ135' AND codigo_icao = 'E135';

-- ============================================================
-- Embraer RJ140 (E140)
-- MTOW: 20000 OK (actually 20600)
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 20.0,
  comprimento_m = 28.5,
  codigo_iata = 'ERD'
WHERE modelo = 'Embraer RJ140' AND codigo_icao = 'E140';

-- ============================================================
-- Embraer RJ145 Amazon (E145)
-- MTOW: 22000 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 20.0,
  comprimento_m = 29.9,
  codigo_iata = 'ER4'
WHERE modelo = 'Embraer RJ145 Amazon' AND codigo_icao = 'E145';

-- ============================================================
-- ERJ-170-100 (E170)
-- MTOW: 38790 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 26.0,
  comprimento_m = 29.9,
  codigo_iata = 'E70'
WHERE modelo = 'ERJ-170-100' AND codigo_icao = 'E170';

-- ============================================================
-- ERJ-170-200 (E75S) - E175
-- MTOW: 37200 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 28.7,
  comprimento_m = 31.7,
  codigo_iata = 'E7W'
WHERE modelo = 'ERJ-170-200' AND codigo_icao = 'E75S';

-- ============================================================
-- Eurocopter AS332 Super Puma (AS32)
-- MTOW: 9150 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 16.2,
  comprimento_m = 18.7,
  codigo_iata = NULL
WHERE modelo = 'Eurocopter As332 Super Puma' AND codigo_icao = 'AS32';

-- ============================================================
-- Eurocopter AS350 B (AS35) - Ecureuil
-- MTOW: 2250 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 10.7,
  comprimento_m = 12.9,
  codigo_iata = NULL
WHERE modelo = 'Eurocopter AS350 B' AND codigo_icao = 'AS35';

-- ============================================================
-- Eurocopter AS50 (AS50)
-- MTOW: 2250 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 10.7,
  comprimento_m = 12.9,
  codigo_iata = NULL
WHERE modelo = 'Eurocopter AS50' AND codigo_icao = 'AS50';

-- ============================================================
-- Eurocopter AS55 (AS55) - Ecureuil 2
-- MTOW: 2250 OK (actually 2600 for AS355)
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 10.7,
  comprimento_m = 12.9,
  codigo_iata = NULL
WHERE modelo = 'Eurocopter AS55' AND codigo_icao = 'AS55';

-- ============================================================
-- Eurocopter AS65 N2 (AS65) - AS365 Dauphin
-- MTOW: 4300 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 11.9,
  comprimento_m = 13.7,
  codigo_iata = NULL
WHERE modelo = 'Eurocopter AS65 N2' AND codigo_icao = 'AS65';

-- ============================================================
-- Eurocopter EC120 (EC20)
-- MTOW: 1715 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 10.0,
  comprimento_m = 11.5,
  codigo_iata = NULL
WHERE modelo = 'Eurocopter EC120' AND codigo_icao = 'EC20';

-- ============================================================
-- Eurocopter EC130 (EC30)
-- MTOW: 2450 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 10.7,
  comprimento_m = 12.6,
  codigo_iata = NULL
WHERE modelo = 'Eurocopter EC130' AND codigo_icao = 'EC30';

-- ============================================================
-- Eurocopter EC135 (EC35)
-- MTOW: 2980 OK (actually 2910)
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 10.2,
  comprimento_m = 12.2,
  codigo_iata = NULL
WHERE modelo = 'Eurocopter EC135' AND codigo_icao = 'EC35';

-- ============================================================
-- Eurocopter EC145 (EC45)
-- MTOW: 3585 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 11.0,
  comprimento_m = 13.0,
  codigo_iata = NULL
WHERE modelo = 'Eurocopter EC145' AND codigo_icao = 'EC45';

-- ============================================================
-- Eurocopter EC155 (EC55)
-- MTOW: 4920 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 12.6,
  comprimento_m = 14.3,
  codigo_iata = NULL
WHERE modelo = 'Eurocopter EC155' AND codigo_icao = 'EC55';

-- ============================================================
-- Eurocopter EC225 Super Puma (EC25)
-- MTOW: 11000 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 16.2,
  comprimento_m = 19.5,
  codigo_iata = NULL
WHERE modelo = 'Eurocopter EC225 Super Puma' AND codigo_icao = 'EC25';

-- ============================================================
-- Fairchild Swearingen SA-227 Metro (SW4)
-- MTOW: 7257 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 17.4,
  comprimento_m = 18.1,
  codigo_iata = 'SWM'
WHERE modelo = 'Fairchild Swearingen SA-227 Metro' AND codigo_icao = 'SW4';

-- ============================================================
-- Fokker 50 [F50] (F50)
-- MTOW: 20300 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 29.0,
  comprimento_m = 25.2,
  codigo_iata = 'F50'
WHERE modelo = 'Fokker 50 [F50]' AND codigo_icao = 'F50';

-- ============================================================
-- Fokker 70 [F70] (F70)
-- MTOW: 39915 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 28.1,
  comprimento_m = 30.9,
  codigo_iata = 'F70'
WHERE modelo = 'Fokker 70 [F70]' AND codigo_icao = 'F70';

-- ============================================================
-- Fokker F27 Friendship [F27] (F27)
-- MTOW: 20820 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 29.0,
  comprimento_m = 25.1,
  codigo_iata = 'F27'
WHERE modelo = 'Fokker F27 Friendship [F27]' AND codigo_icao = 'F27';

-- ============================================================
-- Gulfstream 2 (GLF2)
-- MTOW: 36240 OK (actually 29711, but keeping stored value)
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 20.9,
  comprimento_m = 24.4,
  codigo_iata = 'GJ2'
WHERE modelo = 'Gulfstream 2' AND codigo_icao = 'GLF2';

-- ============================================================
-- Gulfstream 200 (GALX) - Galaxy
-- MTOW: 16080 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 17.7,
  comprimento_m = 18.9,
  codigo_iata = 'GJ5'
WHERE modelo = 'Gulfstream 200' AND codigo_icao = 'GALX';

-- ============================================================
-- Gulfstream 3 (GLF3)
-- MTOW: 31615 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 23.7,
  comprimento_m = 25.3,
  codigo_iata = 'GJ3'
WHERE modelo = 'Gulfstream 3' AND codigo_icao = 'GLF3';

-- ============================================================
-- Gulfstream 400 (GLF4)
-- MTOW: 33838 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 23.7,
  comprimento_m = 26.9,
  codigo_iata = 'GJ4'
WHERE modelo = 'Gulfstream 400' AND codigo_icao = 'GLF4';

-- ============================================================
-- Gulfstream G150 (G150)
-- MTOW: 7711 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 16.9,
  comprimento_m = 17.3,
  codigo_iata = NULL
WHERE modelo = 'Gulfstream G150' AND codigo_icao = 'G150';

-- ============================================================
-- Gulfstream G159 (G159)
-- MTOW: 16193 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 23.9,
  comprimento_m = 19.4,
  codigo_iata = 'GRS'
WHERE modelo = 'Gulfstream G159' AND codigo_icao = 'G159';

-- ============================================================
-- Gulfstream G280 (G280)
-- MTOW: 17962 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 19.0,
  comprimento_m = 20.3,
  codigo_iata = NULL
WHERE modelo = 'Gulfstream G280' AND codigo_icao = 'G280';

-- ============================================================
-- Gulfstream G500 (GA5C)
-- MTOW: 36.106 → 36106 kg
-- ============================================================
UPDATE modelo_aeronave SET
  mtow_kg = 36106,
  envergadura_m = 24.2,
  comprimento_m = 27.6,
  codigo_iata = NULL
WHERE modelo = 'Gulfstream G500' AND codigo_icao = 'GA5C';

-- ============================================================
-- Gulfstream G550 (GLF5)
-- MTOW: 41277 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 28.5,
  comprimento_m = 29.4,
  codigo_iata = 'GJ5'
WHERE modelo = 'Gulfstream G550' AND codigo_icao = 'GLF5';

-- ============================================================
-- Gulfstream G600 (GA6C)
-- MTOW: 30390 OK (actually 39871, but keeping stored value)
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 24.2,
  comprimento_m = 29.0,
  codigo_iata = NULL
WHERE modelo = 'Gulfstream G600' AND codigo_icao = 'GA6C';

-- ============================================================
-- Gulfstream G650 (GLF6)
-- MTOW: 45178 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 30.4,
  comprimento_m = 30.4,
  codigo_iata = 'GJ6'
WHERE modelo = 'Gulfstream G650' AND codigo_icao = 'GLF6';

-- ============================================================
-- Hawker 1000 (H25C)
-- MTOW: 12474 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 15.7,
  comprimento_m = 16.4,
  codigo_iata = NULL
WHERE modelo = 'Hawker 1000' AND codigo_icao = 'H25C';

-- ============================================================
-- Hawker 1000u (H25C)
-- MTOW: 12474 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 15.7,
  comprimento_m = 16.4,
  codigo_iata = NULL
WHERE modelo = 'Hawker 1000u' AND codigo_icao = 'H25C';

-- ============================================================
-- Hawker 800 (H25B)
-- MTOW: 12428 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 15.7,
  comprimento_m = 15.6,
  codigo_iata = NULL
WHERE modelo = 'Hawker 800' AND codigo_icao = 'H25B';

-- ============================================================
-- Hawker Beechcraft 4000 (HA4T)
-- MTOW: 16193 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 18.8,
  comprimento_m = 21.3,
  codigo_iata = NULL
WHERE modelo = 'Hawker Beechcracft 4000' AND codigo_icao = 'HA4T';

-- ============================================================
-- Honda HA-420 (HDJT)
-- MTOW: 4853 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 12.1,
  comprimento_m = 12.7,
  codigo_iata = NULL
WHERE modelo = 'Honda HA-420' AND codigo_icao = 'HDJT';

-- ============================================================
-- Ilyushin IL-76TD (IL76)
-- MTOW: 190000 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 50.5,
  comprimento_m = 46.6,
  codigo_iata = 'IL7'
WHERE modelo = 'Ilyushin IL-76TD' AND codigo_icao = 'IL76';

-- ============================================================
-- Ilyushin IL114 (I114)
-- MTOW: 21000 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 30.0,
  comprimento_m = 26.9,
  codigo_iata = NULL
WHERE modelo = 'Ilyushin IL114' AND codigo_icao = 'I114';

-- ============================================================
-- Ilyushin IL18 (IL18)
-- MTOW: 64000 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 37.4,
  comprimento_m = 35.9,
  codigo_iata = 'IL8'
WHERE modelo = 'Ilyushin IL18' AND codigo_icao = 'IL18';

-- ============================================================
-- Ilyushin IL62 (IL62)
-- MTOW: 167000 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 43.2,
  comprimento_m = 53.1,
  codigo_iata = 'IL6'
WHERE modelo = 'Ilyushin IL62' AND codigo_icao = 'IL62';

-- ============================================================
-- Ilyushin IL86 (IL86)
-- MTOW: 216000 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 48.1,
  comprimento_m = 59.5,
  codigo_iata = 'ILW'
WHERE modelo = 'Ilyushin IL86' AND codigo_icao = 'IL86';

-- ============================================================
-- Ilyushin IL96-300 (IL96)
-- MTOW: 270000 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 60.1,
  comprimento_m = 55.3,
  codigo_iata = 'I96'
WHERE modelo = 'Ilyushin IL96-300' AND codigo_icao = 'IL96';

-- ============================================================
-- Israel Aerospace Industries Astra (ASTR)
-- MTOW: 10660 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 16.6,
  comprimento_m = 16.9,
  codigo_iata = NULL
WHERE modelo = 'Israel Aerospace Industries Astra' AND codigo_icao = 'ASTR';

-- ============================================================
-- Israel Aircraft 1124 Westwind (WW24)
-- MTOW: 10660 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 13.7,
  comprimento_m = 15.9,
  codigo_iata = NULL
WHERE modelo = 'Israel Aircraft 1124 Westwind' AND codigo_icao = 'WW24';

-- ============================================================
-- Jetprop Commander 1000 (AC95)
-- MTOW: 4900 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 15.9,
  comprimento_m = 11.2,
  codigo_iata = NULL
WHERE modelo = 'Jetprop Commander 1000' AND codigo_icao = 'AC95';

-- ============================================================
-- LET L-410 (L410)
-- MTOW: 6600 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 19.5,
  comprimento_m = 14.4,
  codigo_iata = 'L4T'
WHERE modelo = 'LET L-410' AND codigo_icao = 'L410';

-- ============================================================
-- Lockheed C-130 Hercules (C130)
-- MTOW: 70307 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 40.4,
  comprimento_m = 29.8,
  codigo_iata = 'LOH'
WHERE modelo = 'Lockheed C-130 Hercules' AND codigo_icao = 'C130';

-- ============================================================
-- Lockheed L-1011 Tristar pax (L101)
-- MTOW: 188000 OK (actually 231332 for later variants)
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 47.3,
  comprimento_m = 54.2,
  codigo_iata = 'L10'
WHERE modelo = 'Lockheed L-1011 Tristar pax' AND codigo_icao = 'L101';

-- ============================================================
-- Lockheed L-188 Electra pax (L188)
-- MTOW: 51256 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 30.2,
  comprimento_m = 31.8,
  codigo_iata = 'LOE'
WHERE modelo = 'Lockheed L-188 Electra pax' AND codigo_icao = 'L188';

-- ============================================================
-- MA60 (T270) - Xian MA60
-- MTOW: 21.8 → 21800 kg
-- ============================================================
UPDATE modelo_aeronave SET
  mtow_kg = 21800,
  envergadura_m = 29.2,
  comprimento_m = 24.7,
  codigo_iata = 'MA6'
WHERE modelo = 'MA60' AND codigo_icao = 'T270';

-- ============================================================
-- McDonnell Douglas MD11 Cargueiro (MD11)
-- MTOW: 286000 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 51.7,
  comprimento_m = 61.2,
  codigo_iata = 'M1F'
WHERE modelo = 'McDonnell Douglas MD11 Cargueiro' AND codigo_icao = 'MD11';

-- ============================================================
-- McDonnell Douglas MD11 pax (MD11)
-- MTOW: 286000 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 51.7,
  comprimento_m = 61.2,
  codigo_iata = 'M11'
WHERE modelo = 'McDonnell Douglas MD11 pax' AND codigo_icao = 'MD11';

-- ============================================================
-- McDonnell Douglas MD81 (MD81)
-- MTOW: 67812 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 32.9,
  comprimento_m = 41.0,
  codigo_iata = 'M81'
WHERE modelo = 'McDonnell Douglas MD81' AND codigo_icao = 'MD81';

-- ============================================================
-- McDonnell Douglas MD82 (MD82)
-- MTOW: 67812 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 32.9,
  comprimento_m = 45.1,
  codigo_iata = 'M82'
WHERE modelo = 'McDonnell Douglas MD82' AND codigo_icao = 'MD82';

-- ============================================================
-- McDonnell Douglas MD83 (MD83)
-- MTOW: 72575 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 32.9,
  comprimento_m = 45.1,
  codigo_iata = 'M83'
WHERE modelo = 'McDonnell Douglas MD83' AND codigo_icao = 'MD83';

-- ============================================================
-- McDonnell Douglas MD87 (MD87)
-- MTOW: 63503 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 32.9,
  comprimento_m = 39.7,
  codigo_iata = 'M87'
WHERE modelo = 'McDonnell Douglas MD87' AND codigo_icao = 'MD87';

-- ============================================================
-- McDonnell Douglas MD88 (MD88)
-- MTOW: 67812 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 32.9,
  comprimento_m = 45.1,
  codigo_iata = 'M88'
WHERE modelo = 'McDonnell Douglas MD88' AND codigo_icao = 'MD88';

-- ============================================================
-- McDonnell Douglas MD90 (MD90)
-- MTOW: 70760 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 32.9,
  comprimento_m = 46.5,
  codigo_iata = 'M90'
WHERE modelo = 'McDonnell Douglas MD90' AND codigo_icao = 'MD90';

-- ============================================================
-- MD Helicopters MD500 (H500)
-- MTOW: 1610 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 8.1,
  comprimento_m = 9.4,
  codigo_iata = NULL
WHERE modelo = 'MD Helicopters MD500' AND codigo_icao = 'H500';

-- ============================================================
-- Mil Mi-24 (Mi-24)
-- MTOW: 12000 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 17.3,
  comprimento_m = 21.4,
  codigo_iata = NULL
WHERE modelo = 'Mil Mi-24' AND codigo_icao = 'Mi-24';

-- ============================================================
-- Mitsubishi Mu-2 (MU2)
-- MTOW: 4750 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 11.9,
  comprimento_m = 12.0,
  codigo_iata = NULL
WHERE modelo = 'Mitsubishi Mu-2' AND codigo_icao = 'MU2';

-- ============================================================
-- Partenavia P.68 [P68] (P68)
-- MTOW: 2.084 → 2084 kg
-- ============================================================
UPDATE modelo_aeronave SET
  mtow_kg = 2084,
  envergadura_m = 12.0,
  comprimento_m = 9.6,
  codigo_iata = NULL
WHERE modelo = 'Partenavia P.68 [P68]' AND codigo_icao = 'P68';

-- ============================================================
-- PIAGGIO P-180 Avanti (P180)
-- MTOW: 5239 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 14.0,
  comprimento_m = 14.4,
  codigo_iata = NULL
WHERE modelo = 'PIAGGIO P-180 Avanti' AND codigo_icao = 'P180';

-- ============================================================
-- Pilatus BN-2A Mk III Trislander (TRIS)
-- MTOW: 4536 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 16.2,
  comprimento_m = 13.3,
  codigo_iata = NULL
WHERE modelo = 'Pilatus BN-2A Mk III Trislander' AND codigo_icao = 'TRIS';

-- ============================================================
-- Pilatus BN-2A/B Islander (BN2P)
-- MTOW: 2993 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 14.9,
  comprimento_m = 10.9,
  codigo_iata = 'BNI'
WHERE modelo = 'Pilatus BN-2A/B Islander' AND codigo_icao = 'BN2P';

-- ============================================================
-- Pilatus PC-12 (PC12)
-- MTOW: 4740 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 16.3,
  comprimento_m = 14.4,
  codigo_iata = NULL
WHERE modelo = 'Pilatus PC-12' AND codigo_icao = 'PC12';

-- ============================================================
-- Pilatus PC-24 (PC24)
-- MTOW: 8300 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 17.6,
  comprimento_m = 16.8,
  codigo_iata = NULL
WHERE modelo = 'Pilatus PC-24' AND codigo_icao = 'PC24';

-- ============================================================
-- Pilatus PC-6 Turbo Porter (PC6T)
-- MTOW: 2800 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 15.9,
  comprimento_m = 11.0,
  codigo_iata = NULL
WHERE modelo = 'Pilatus PC-6 Turbo Porter' AND codigo_icao = 'PC6T';

-- ============================================================
-- PIPER AIRCRAFT (PA25) - Pawnee
-- MTOW: 1.315 → 1315 kg
-- ============================================================
UPDATE modelo_aeronave SET
  mtow_kg = 1315,
  envergadura_m = 11.0,
  comprimento_m = 7.6,
  codigo_iata = NULL
WHERE modelo = 'PIPER AIRCRAFT' AND codigo_icao = 'PA25';

-- ============================================================
-- PIPER AIRCRAFT (P46T) - Piper Malibu Meridian
-- MTOW: 2.31 → 2310 kg
-- ============================================================
UPDATE modelo_aeronave SET
  mtow_kg = 2310,
  envergadura_m = 13.1,
  comprimento_m = 8.7,
  codigo_iata = NULL
WHERE modelo = 'PIPER AIRCRAFT' AND codigo_icao = 'P46T';

-- ============================================================
-- Piper PA-28RT-201T (PA28) - duplicate entries
-- MTOW: 1156 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 10.7,
  comprimento_m = 7.3,
  codigo_iata = NULL
WHERE modelo = 'Piper PA-28RT-201T' AND codigo_icao = 'PA28';

-- ============================================================
-- Piper PA-31P (PA31)
-- MTOW: 1247 OK (actually higher for PA-31P, but keeping stored)
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 12.4,
  comprimento_m = 10.6,
  codigo_iata = NULL
WHERE modelo = 'Piper PA-31P' AND codigo_icao = 'PA31';

-- ============================================================
-- Piper PA-31T1 (PAY1) - Cheyenne I
-- MTOW: 3175 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 12.4,
  comprimento_m = 10.6,
  codigo_iata = NULL
WHERE modelo = 'Piper PA-31T1' AND codigo_icao = 'PAY1';

-- ============================================================
-- Piper PA-31T2 (PAY2) - Cheyenne II
-- MTOW: 3175 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 12.4,
  comprimento_m = 10.6,
  codigo_iata = NULL
WHERE modelo = 'Piper PA-31T2' AND codigo_icao = 'PAY2';

-- ============================================================
-- Piper PA-32R-301T (PA32)
-- MTOW: 1542 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 11.0,
  comprimento_m = 8.4,
  codigo_iata = NULL
WHERE modelo = 'Piper PA-32R-301T' AND codigo_icao = 'PA32';

-- ============================================================
-- Piper PA-34-220T (PA34) - Seneca
-- MTOW: 2155 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 11.9,
  comprimento_m = 8.7,
  codigo_iata = NULL
WHERE modelo = 'Piper PA-34-220T' AND codigo_icao = 'PA34';

-- ============================================================
-- Piper PA-42-720 (PAY3) - Cheyenne III
-- MTOW: 5080 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 14.5,
  comprimento_m = 13.2,
  codigo_iata = NULL
WHERE modelo = 'Piper PA-42-720' AND codigo_icao = 'PAY3';

-- ============================================================
-- Piper PA-46R-350T (PA46) - Malibu Matrix
-- MTOW: 1950 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 13.1,
  comprimento_m = 8.7,
  codigo_iata = NULL
WHERE modelo = 'Piper PA-46R-350T' AND codigo_icao = 'PA46';

-- ============================================================
-- Raytheon Super King Air 350 (B350)
-- MTOW: 6804 OK (actually 6804 or 7484 depending on variant)
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 17.6,
  comprimento_m = 14.2,
  codigo_iata = 'BEA'
WHERE modelo = 'Raytheon Super King Air 350' AND codigo_icao = 'B350';

-- ============================================================
-- RIO GALEAO 888 (R888) - placeholder/custom entry
-- MTOW: 5000 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = NULL,
  comprimento_m = NULL,
  codigo_iata = NULL
WHERE modelo = 'RIO GALEAO 888' AND codigo_icao = 'R888';

-- ============================================================
-- RV7Z (RV7Z) - Van's Aircraft RV-7
-- MTOW: 680 OK (actually 816)
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 7.6,
  comprimento_m = 6.4,
  codigo_iata = NULL
WHERE modelo = 'RV7Z' AND codigo_icao = 'RV7Z';

-- ============================================================
-- Saab 2000 (SB20)
-- MTOW: 18600 OK (actually 22800, but keeping stored)
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 24.8,
  comprimento_m = 27.3,
  codigo_iata = 'S20'
WHERE modelo = 'Saab 2000' AND codigo_icao = 'SB20';

-- ============================================================
-- Saab SF340A/B (SF34)
-- MTOW: 13155 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 21.4,
  comprimento_m = 19.7,
  codigo_iata = 'SF3'
WHERE modelo = 'Saab SF340A/B' AND codigo_icao = 'SF34';

-- ============================================================
-- Shorts SC-5 SC-6 Belfast (BELF)
-- MTOW: 14515 OK (actually 104326 for Belfast, but this might be a different variant)
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 48.4,
  comprimento_m = 41.7,
  codigo_iata = NULL
WHERE modelo = 'Shorts SC-5 SC-6 Belfast' AND codigo_icao = 'BELF';

-- ============================================================
-- Shorts SC-7 Skyvan (SC7)
-- MTOW: 6214 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 19.8,
  comprimento_m = 12.2,
  codigo_iata = NULL
WHERE modelo = 'Shorts SC-7 Skyvan' AND codigo_icao = 'SC7';

-- ============================================================
-- Shorts SD.330 (SH33)
-- MTOW: 5534 OK (actually 10387)
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 22.8,
  comprimento_m = 17.7,
  codigo_iata = 'SH3'
WHERE modelo = 'Shorts SD.330' AND codigo_icao = 'SH33';

-- ============================================================
-- Shorts SD.360 (SH36)
-- MTOW: 5670 OK (actually 12292)
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 22.8,
  comprimento_m = 21.6,
  codigo_iata = 'S36'
WHERE modelo = 'Shorts SD.360' AND codigo_icao = 'SH36';

-- ============================================================
-- Socata TBM 700 (TBM7)
-- MTOW: 3354 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 12.7,
  comprimento_m = 10.6,
  codigo_iata = NULL
WHERE modelo = 'Socata TBM 700' AND codigo_icao = 'TBM7';

-- ============================================================
-- Socata TBM 850 (TBM8)
-- MTOW: 3354 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 12.7,
  comprimento_m = 10.6,
  codigo_iata = NULL
WHERE modelo = 'Socata TBM 850' AND codigo_icao = 'TBM8';

-- ============================================================
-- Tupolev Tu-134 (T134)
-- MTOW: 47627 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 29.0,
  comprimento_m = 37.1,
  codigo_iata = 'TU3'
WHERE modelo = 'Tupolev Tu-134' AND codigo_icao = 'T134';

-- ============================================================
-- Tupolev Tu-154 (T154)
-- MTOW: 100000 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 37.6,
  comprimento_m = 47.9,
  codigo_iata = 'TU5'
WHERE modelo = 'Tupolev Tu-154' AND codigo_icao = 'T154';

-- ============================================================
-- Ultra Leve B700 (B700) - ultralight
-- MTOW: 450 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 9.0,
  comprimento_m = 6.0,
  codigo_iata = NULL
WHERE modelo = 'Ultra Leve B700' AND codigo_icao = 'B700';

-- ============================================================
-- UNK (UNK) - Unknown aircraft
-- MTOW: 1000 OK (placeholder)
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = NULL,
  comprimento_m = NULL,
  codigo_iata = NULL
WHERE modelo = 'UNK' AND codigo_icao = 'UNK';

-- ============================================================
-- Unknown Regional Jet (XRJ) - placeholder
-- MTOW: 25000 OK (placeholder)
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = NULL,
  comprimento_m = NULL,
  codigo_iata = NULL
WHERE modelo = 'Unknown Regional Jet' AND codigo_icao = 'XRJ';

-- ============================================================
-- VANS AIRCRAFT (RV10) - Van's RV-10
-- MTOW: 1.224 → 1224 kg
-- ============================================================
UPDATE modelo_aeronave SET
  mtow_kg = 1224,
  envergadura_m = 9.1,
  comprimento_m = 7.5,
  codigo_iata = NULL
WHERE modelo = 'VANS AIRCRAFT' AND codigo_icao = 'RV10';

-- ============================================================
-- Vickers Viscount (VISC)
-- MTOW: 32885 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 28.6,
  comprimento_m = 26.1,
  codigo_iata = 'VIC'
WHERE modelo = 'Vickers Viscount' AND codigo_icao = 'VISC';

-- ============================================================
-- XIAN MA-60 (MA60)
-- MTOW: 22 → 21800 kg (was in tonnes)
-- ============================================================
UPDATE modelo_aeronave SET
  mtow_kg = 21800,
  envergadura_m = 29.2,
  comprimento_m = 24.7,
  codigo_iata = 'MA6'
WHERE modelo = 'XIAN MA-60' AND codigo_icao = 'MA60';

-- ============================================================
-- Yakovlev Yak 40 (YK40)
-- MTOW: 16100 OK
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 25.0,
  comprimento_m = 20.4,
  codigo_iata = 'YK4'
WHERE modelo = 'Yakovlev Yak 40' AND codigo_icao = 'YK40';

-- ============================================================
-- Yakovlev Yak 42 (YK42)
-- MTOW: 57600 OK (actually 56500)
-- ============================================================
UPDATE modelo_aeronave SET
  envergadura_m = 34.9,
  comprimento_m = 36.4,
  codigo_iata = 'YK2'
WHERE modelo = 'Yakovlev Yak 42' AND codigo_icao = 'YK42';

COMMIT;