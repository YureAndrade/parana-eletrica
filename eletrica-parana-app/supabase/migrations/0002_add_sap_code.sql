-- =============================================================
-- Adiciona campos do catálogo SAP ao products
-- =============================================================

alter table public.products
  add column if not exists sap_code text,
  add column if not exists family text,
  add column if not exists source text;

-- Único quando preenchido (vendedores criam produtos sem SAP a partir do app)
create unique index if not exists products_sap_code_unique
  on public.products (sap_code)
  where sap_code is not null;

create index if not exists products_family_idx
  on public.products (family);

-- Para autocomplete por código SAP (busca por prefixo)
create index if not exists products_sap_code_prefix_idx
  on public.products (sap_code text_pattern_ops)
  where sap_code is not null;
