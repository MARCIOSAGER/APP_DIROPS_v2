-- Migration 048: Deduplicate modelo_aeronave by codigo_icao
-- For each duplicate ICAO, keep the one with most registos (or best name), migrate FK references, delete the rest
-- Then add UNIQUE constraint on codigo_icao

BEGIN;

-- ============================================================
-- A319: Keep "Airbus A319" (aacb8237), delete "Airbus A319 (Sharklets)" (b008b625) — both 0 registos
-- ============================================================
DELETE FROM modelo_aeronave WHERE id = 'b008b625-14a3-4e73-9003-f305976bd591';

-- ============================================================
-- A320: Keep "Airbus A320-100/200" (211879b6, 1 registo), delete 3 others
-- ============================================================
UPDATE registo_aeronave SET id_modelo_aeronave = '211879b6-75d2-4736-803e-0f7516371843' WHERE id_modelo_aeronave IN ('714ee2d4-161b-4d54-8c5f-6ca349288a80','cf1818bc-f109-40a4-8b5a-a531b164b476','9c08d833-4fac-4318-b112-1f589d025e73');
DELETE FROM modelo_aeronave WHERE id IN ('714ee2d4-161b-4d54-8c5f-6ca349288a80','cf1818bc-f109-40a4-8b5a-a531b164b476','9c08d833-4fac-4318-b112-1f589d025e73');

-- ============================================================
-- A321: Keep "Airbus A321 (Sharklets)" (80d4e9c3, 1 registo), delete other
-- ============================================================
UPDATE registo_aeronave SET id_modelo_aeronave = '80d4e9c3-cda4-4fad-a335-b1b3204150fb' WHERE id_modelo_aeronave = '457e8b6a-9d5b-4b5c-a2f6-f500c7803ad2';
DELETE FROM modelo_aeronave WHERE id = '457e8b6a-9d5b-4b5c-a2f6-f500c7803ad2';
-- Rename to generic name
UPDATE modelo_aeronave SET modelo = 'Airbus A321' WHERE id = '80d4e9c3-cda4-4fad-a335-b1b3204150fb';

-- ============================================================
-- A330: Keep "Airbus A330 all models [Type]" (d86c2d6b), delete other — both 0 registos
-- ============================================================
UPDATE registo_aeronave SET id_modelo_aeronave = 'd86c2d6b-1505-4e69-9355-35893689e6a6' WHERE id_modelo_aeronave = '6054a80f-63ef-4c60-8289-31369ed9e174';
DELETE FROM modelo_aeronave WHERE id = '6054a80f-63ef-4c60-8289-31369ed9e174';
-- Rename to cleaner name
UPDATE modelo_aeronave SET modelo = 'Airbus A330' WHERE id = 'd86c2d6b-1505-4e69-9355-35893689e6a6';

-- ============================================================
-- A388: Keep "Airbus A380-800" (81611b40), delete "A380-200F" (c4ad4a8e) — both 0 registos
-- ============================================================
UPDATE registo_aeronave SET id_modelo_aeronave = '81611b40-ae5e-444b-9ce2-01638a786e11' WHERE id_modelo_aeronave = 'c4ad4a8e-5d40-424a-ac54-1d652e7fe5e7';
DELETE FROM modelo_aeronave WHERE id = 'c4ad4a8e-5d40-424a-ac54-1d652e7fe5e7';

-- ============================================================
-- AT76: Keep ATR-72-600 (729c9398, 1 registo), delete duplicate (3080e829)
-- ============================================================
UPDATE registo_aeronave SET id_modelo_aeronave = '729c9398-d77b-4beb-abe8-9eeeabe6f0e4' WHERE id_modelo_aeronave = '3080e829-228b-45e7-966e-0eca9c32700d';
DELETE FROM modelo_aeronave WHERE id = '3080e829-228b-45e7-966e-0eca9c32700d';

-- ============================================================
-- B722: Keep "Boeing 727-200 pax" (bfcae26d), delete Carga (e5aeab63) — both 0 registos
-- ============================================================
UPDATE registo_aeronave SET id_modelo_aeronave = 'bfcae26d-ed1e-44b7-98fc-f8d0ab5db015' WHERE id_modelo_aeronave = 'e5aeab63-93e3-441f-9140-de409acabf7e';
DELETE FROM modelo_aeronave WHERE id = 'e5aeab63-93e3-441f-9140-de409acabf7e';
UPDATE modelo_aeronave SET modelo = 'Boeing 727-200' WHERE id = 'bfcae26d-ed1e-44b7-98fc-f8d0ab5db015';

-- ============================================================
-- B737: Keep "Boeing 737-700 (winglets) pax" (e1b0432e, 8 registos), migrate 2 from other
-- ============================================================
UPDATE registo_aeronave SET id_modelo_aeronave = 'e1b0432e-248b-47ad-938f-476bbe70252e' WHERE id_modelo_aeronave = '1c8caeab-ab6e-409a-a2be-a8319aace5c8';
DELETE FROM modelo_aeronave WHERE id = '1c8caeab-ab6e-409a-a2be-a8319aace5c8';
UPDATE modelo_aeronave SET modelo = 'Boeing 737-700' WHERE id = 'e1b0432e-248b-47ad-938f-476bbe70252e';

-- ============================================================
-- B738: Keep "Boeing 737-800 (winglets)" (4edaf0bb, 7 registos), migrate from other 2
-- ============================================================
UPDATE registo_aeronave SET id_modelo_aeronave = '4edaf0bb-6d44-4c6e-b833-052ba78e875d' WHERE id_modelo_aeronave IN ('fb2932fb-e3bc-4df5-b1eb-7f261fc99fb2','52a8c50f-5f12-45f0-9479-506b764105a0');
DELETE FROM modelo_aeronave WHERE id IN ('fb2932fb-e3bc-4df5-b1eb-7f261fc99fb2','52a8c50f-5f12-45f0-9479-506b764105a0');
UPDATE modelo_aeronave SET modelo = 'Boeing 737-800' WHERE id = '4edaf0bb-6d44-4c6e-b833-052ba78e875d';

-- ============================================================
-- B744: Keep "Boeing 747-400 pax" (bee09bad, 6 registos, mtow 412775), delete Freighter (279be0b7)
-- ============================================================
UPDATE registo_aeronave SET id_modelo_aeronave = 'bee09bad-3da4-444d-a725-8414f6ed5566' WHERE id_modelo_aeronave = '279be0b7-4340-4648-9885-cbf3ee399fb9';
DELETE FROM modelo_aeronave WHERE id = '279be0b7-4340-4648-9885-cbf3ee399fb9';
UPDATE modelo_aeronave SET modelo = 'Boeing 747-400' WHERE id = 'bee09bad-3da4-444d-a725-8414f6ed5566';

-- ============================================================
-- B748: Keep "Boeing 747-800 pax" (b05a28b0), delete other 2 — all 0 registos
-- ============================================================
UPDATE registo_aeronave SET id_modelo_aeronave = 'b05a28b0-e59f-4a0e-a807-5b6a8e3031d2' WHERE id_modelo_aeronave IN ('ef7ba579-0ec2-44a2-885a-6d69a07cfb46','50e1d365-0e09-4b6c-9928-78ed3b2abb7d');
DELETE FROM modelo_aeronave WHERE id IN ('ef7ba579-0ec2-44a2-885a-6d69a07cfb46','50e1d365-0e09-4b6c-9928-78ed3b2abb7d');
UPDATE modelo_aeronave SET modelo = 'Boeing 747-800' WHERE id = 'b05a28b0-e59f-4a0e-a807-5b6a8e3031d2';

-- ============================================================
-- B763: Keep "Boeing 767-300 pax" (f0d700a4), delete other 2 — all 0 registos
-- ============================================================
UPDATE registo_aeronave SET id_modelo_aeronave = 'f0d700a4-4f16-45bd-8f55-3ab20566bf21' WHERE id_modelo_aeronave IN ('55679453-8dd2-41fc-8280-c33a832e79d3','73dc2bf7-08fb-4f1a-b6fb-322dd654e13f');
DELETE FROM modelo_aeronave WHERE id IN ('55679453-8dd2-41fc-8280-c33a832e79d3','73dc2bf7-08fb-4f1a-b6fb-322dd654e13f');
UPDATE modelo_aeronave SET modelo = 'Boeing 767-300' WHERE id = 'f0d700a4-4f16-45bd-8f55-3ab20566bf21';

-- ============================================================
-- B77L: Keep "Boeing 777-200LR" (b52aacfb, 5 registos), migrate 1 from Freighter
-- ============================================================
UPDATE registo_aeronave SET id_modelo_aeronave = 'b52aacfb-6cdc-45a1-a812-d0cfcfdee49e' WHERE id_modelo_aeronave = '9dcd94b5-99a7-4e04-8f5a-9eb367fc7446';
DELETE FROM modelo_aeronave WHERE id = '9dcd94b5-99a7-4e04-8f5a-9eb367fc7446';

-- ============================================================
-- C170: Both "Cessna C170" with 0 registos — keep one (ca80c6be), delete other
-- ============================================================
UPDATE registo_aeronave SET id_modelo_aeronave = 'ca80c6be-5d61-493b-8585-1faf2baed5e0' WHERE id_modelo_aeronave = 'ac3ad2dd-3d76-41c3-9fc4-dc67b63486a1';
DELETE FROM modelo_aeronave WHERE id = 'ac3ad2dd-3d76-41c3-9fc4-dc67b63486a1';

-- ============================================================
-- C206: Keep "Cessna 206" (d60a65a7, 2 registos), migrate 1 from CessnaT206h
-- ============================================================
UPDATE registo_aeronave SET id_modelo_aeronave = 'd60a65a7-248c-4357-b7bc-424cd2989548' WHERE id_modelo_aeronave = 'abe873b6-b296-44b4-b7d0-f7c777c58362';
DELETE FROM modelo_aeronave WHERE id = 'abe873b6-b296-44b4-b7d0-f7c777c58362';

-- ============================================================
-- C68A: Keep Cessna Citation Latitude (99500267, 1 registo), delete other
-- ============================================================
UPDATE registo_aeronave SET id_modelo_aeronave = '99500267-78f6-447c-8d33-ce7135884ddd' WHERE id_modelo_aeronave = '9f1d685e-7c0d-498e-90c6-56805779ed02';
DELETE FROM modelo_aeronave WHERE id = '9f1d685e-7c0d-498e-90c6-56805779ed02';

-- ============================================================
-- DH8D: Keep "Dash 8 Q400" (e89987e3, 8 registos, mtow 30481), delete duplicate
-- ============================================================
UPDATE registo_aeronave SET id_modelo_aeronave = 'e89987e3-0a76-4d23-b653-afcbec7d3b0e' WHERE id_modelo_aeronave = '71f8249d-b47e-4a38-9333-6d0cafac7890';
DELETE FROM modelo_aeronave WHERE id = '71f8249d-b47e-4a38-9333-6d0cafac7890';

-- ============================================================
-- H25C: Keep "Hawker 1000" (043c286a), delete "Hawker 1000u" — both 0 registos
-- ============================================================
UPDATE registo_aeronave SET id_modelo_aeronave = '043c286a-8f52-4834-a442-f7f5116f111b' WHERE id_modelo_aeronave = 'd9ef9451-b8d3-41c8-90f2-fd4f7d353fcd';
DELETE FROM modelo_aeronave WHERE id = 'd9ef9451-b8d3-41c8-90f2-fd4f7d353fcd';

-- ============================================================
-- MD11: Keep "McDonnell Douglas MD11 pax" (15c2b8bc), delete Cargueiro — both 0 registos
-- ============================================================
UPDATE registo_aeronave SET id_modelo_aeronave = '15c2b8bc-0c2e-48a5-9bd2-4ea19784cdad' WHERE id_modelo_aeronave = 'b76c1ccd-033b-442a-81d7-8212f1d9daa3';
DELETE FROM modelo_aeronave WHERE id = 'b76c1ccd-033b-442a-81d7-8212f1d9daa3';
UPDATE modelo_aeronave SET modelo = 'McDonnell Douglas MD-11' WHERE id = '15c2b8bc-0c2e-48a5-9bd2-4ea19784cdad';

-- ============================================================
-- PA28: Both "Piper PA-28RT-201T" with 0 registos — keep one (d74fad7e), delete other
-- ============================================================
UPDATE registo_aeronave SET id_modelo_aeronave = 'd74fad7e-8f67-4810-a2b3-3db845ac35c0' WHERE id_modelo_aeronave = '523246b3-7714-489e-901d-2dbb02154daf';
DELETE FROM modelo_aeronave WHERE id = '523246b3-7714-489e-901d-2dbb02154daf';

-- ============================================================
-- Now add UNIQUE constraint on codigo_icao
-- ============================================================
CREATE UNIQUE INDEX modelo_aeronave_codigo_icao_unique ON modelo_aeronave (codigo_icao);

COMMIT;
