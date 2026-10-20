-- Restringe a página Pronto Pagamento a ADMIN: remove-a das páginas permitidas
-- do perfil 'operacoes' na regra_permissao (a BD manda sobre o fallback do Layout).
-- Só 'administrador' e (super)admin passam a ver/aceder.
UPDATE regra_permissao
  SET paginas_permitidas = array_remove(paginas_permitidas, 'ProntoPagamento'),
      updated_date = now()
  WHERE perfil = 'operacoes';

-- Verificação (esperado: só administrador = t)
SELECT perfil, ('ProntoPagamento' = ANY(paginas_permitidas)) AS tem_pp
  FROM regra_permissao ORDER BY perfil;
