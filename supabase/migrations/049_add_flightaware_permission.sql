-- 049: Add FlightAware to administrador permissions
-- The page was renamed from Flightradar24 but never added to regra_permissao

UPDATE regra_permissao
SET paginas_permitidas = array_append(paginas_permitidas, 'FlightAware')
WHERE perfil = 'administrador'
  AND NOT ('FlightAware' = ANY(paginas_permitidas));
