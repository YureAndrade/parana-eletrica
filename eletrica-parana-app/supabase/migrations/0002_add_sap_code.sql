-- =============================================================
-- Adiciona campos do catálogo SAP ao products
-- =============================================================

alter table public.products
  add column if not exists sap_code text,
  add column if not exists family text,
  add column if not exists source text;

-- UNIQUE comum (postgres permite múltiplos NULL): produtos criados pelo
-- vendedor sem código SAP convivem com itens do catálogo. Não usar índice
-- parcial aqui — PostgREST precisa de um constraint completo p/ ON CONFLICT.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'products_sap_code_key'
       and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_sap_code_key unique (sap_code);
  end if;
end $$;

-- Limpa o índice parcial antigo se ele existir (criação anterior dessa migration).
drop index if exists public.products_sap_code_unique;

create index if not exists products_family_idx
  on public.products (family);

-- Para autocomplete por código SAP (busca por prefixo)
create index if not exists products_sap_code_prefix_idx
  on public.products (sap_code text_pattern_ops);
