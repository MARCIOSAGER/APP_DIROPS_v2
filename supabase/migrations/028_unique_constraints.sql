-- 028: Add UNIQUE constraints for duplicate prevention
-- Prevents race conditions when multiple users create records simultaneously

-- companhia_aerea: codigo_icao must be unique
ALTER TABLE companhia_aerea
  ADD CONSTRAINT companhia_aerea_codigo_icao_key UNIQUE (codigo_icao);

-- modelo_aeronave: codigo_iata must be unique (partial - allows NULLs)
CREATE UNIQUE INDEX modelo_aeronave_codigo_iata_key
  ON modelo_aeronave (codigo_iata) WHERE codigo_iata IS NOT NULL;

-- registo_aeronave: registo_normalizado must be unique (partial - allows NULLs)
CREATE UNIQUE INDEX registo_aeronave_registo_normalizado_key
  ON registo_aeronave (registo_normalizado) WHERE registo_normalizado IS NOT NULL;
