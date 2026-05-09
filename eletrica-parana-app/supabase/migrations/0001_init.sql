-- =============================================================
-- Elétrica Paraná — App Demandas Não Atendidas
-- Migration inicial: schema, índices, RLS, triggers e helpers.
-- =============================================================

create extension if not exists "uuid-ossp";
create extension if not exists "unaccent";

-- -------------------------------------------------------------
-- Função utilitária: normalização de texto p/ busca
-- -------------------------------------------------------------
create or replace function public.normalize_text(input text)
returns text
language sql
immutable
strict
as $$
  select lower(public.unaccent(coalesce(input, '')));
$$;

-- -------------------------------------------------------------
-- profiles: estende auth.users
-- -------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  branch text,
  role text not null default 'vendedor'
    check (role in ('vendedor', 'admin', 'compras')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Trigger: cria profile vazio quando um usuário é criado em auth.users.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -------------------------------------------------------------
-- products
-- -------------------------------------------------------------
create table if not exists public.products (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  brand text,
  normalized_name text generated always as (public.normalize_text(name)) stored,
  first_requested_at timestamptz,
  request_count int not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists products_normalized_name_idx
  on public.products (normalized_name);
create index if not exists products_request_count_idx
  on public.products (request_count desc);

-- -------------------------------------------------------------
-- customers
-- -------------------------------------------------------------
create table if not exists public.customers (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  phone text,
  document text,
  normalized_name text generated always as (public.normalize_text(name)) stored,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists customers_normalized_name_idx
  on public.customers (normalized_name);

-- -------------------------------------------------------------
-- demand_records
-- -------------------------------------------------------------
create table if not exists public.demand_records (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references public.products(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  vendor_id uuid not null references public.profiles(id) on delete restrict,
  quantity int not null default 1 check (quantity > 0),
  status text not null
    check (status in ('out_of_stock', 'not_registered')),
  notes text,
  photo_url text,
  client_uuid text unique,
  created_at timestamptz not null default now(),
  synced_at timestamptz
);

create index if not exists demand_created_at_idx
  on public.demand_records (created_at desc);
create index if not exists demand_vendor_created_idx
  on public.demand_records (vendor_id, created_at desc);
create index if not exists demand_product_idx
  on public.demand_records (product_id);
create index if not exists demand_status_idx
  on public.demand_records (status);

-- Trigger: incrementa contadores no produto quando uma demanda é criada.
create or replace function public.bump_product_counters()
returns trigger
language plpgsql
as $$
begin
  update public.products
     set request_count      = request_count + 1,
         first_requested_at = coalesce(first_requested_at, new.created_at)
   where id = new.product_id;
  return new;
end;
$$;

drop trigger if exists demand_bump_product on public.demand_records;
create trigger demand_bump_product
  after insert on public.demand_records
  for each row execute function public.bump_product_counters();

-- -------------------------------------------------------------
-- report_config
-- -------------------------------------------------------------
create table if not exists public.report_config (
  id uuid primary key default uuid_generate_v4(),
  recipients text[] not null default '{}',
  send_day int not null default 1 check (send_day between 0 and 6),
  send_hour int not null default 7 check (send_hour between 0 and 23),
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

-- Singleton lógico: garantir uma única linha em report_config.
create unique index if not exists report_config_singleton_idx
  on public.report_config ((true));

insert into public.report_config (recipients)
values ('{}')
on conflict do nothing;

-- =============================================================
-- ROW LEVEL SECURITY
-- =============================================================

alter table public.profiles        enable row level security;
alter table public.products        enable row level security;
alter table public.customers       enable row level security;
alter table public.demand_records  enable row level security;
alter table public.report_config   enable row level security;

-- Helper: papel do usuário corrente.
create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
as $$
  select public.current_role() in ('admin', 'compras');
$$;

-- ---------- profiles ----------
drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles
  for select using (auth.uid() = id or public.is_staff());

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update using (auth.uid() = id or public.is_staff())
  with check (auth.uid() = id or public.is_staff());

drop policy if exists profiles_admin_insert on public.profiles;
create policy profiles_admin_insert on public.profiles
  for insert with check (public.is_staff());

drop policy if exists profiles_admin_delete on public.profiles;
create policy profiles_admin_delete on public.profiles
  for delete using (public.is_staff());

-- ---------- products ----------
drop policy if exists products_select on public.products;
create policy products_select on public.products
  for select using (auth.role() = 'authenticated');

drop policy if exists products_insert on public.products;
create policy products_insert on public.products
  for insert with check (auth.role() = 'authenticated');

drop policy if exists products_update on public.products;
create policy products_update on public.products
  for update using (public.is_staff()) with check (public.is_staff());

drop policy if exists products_delete on public.products;
create policy products_delete on public.products
  for delete using (public.is_staff());

-- ---------- customers ----------
drop policy if exists customers_select on public.customers;
create policy customers_select on public.customers
  for select using (auth.role() = 'authenticated');

drop policy if exists customers_insert on public.customers;
create policy customers_insert on public.customers
  for insert with check (auth.role() = 'authenticated');

drop policy if exists customers_update on public.customers;
create policy customers_update on public.customers
  for update using (public.is_staff()) with check (public.is_staff());

drop policy if exists customers_delete on public.customers;
create policy customers_delete on public.customers
  for delete using (public.is_staff());

-- ---------- demand_records ----------
-- Vendedor vê e edita só os próprios; admin/compras veem tudo.
drop policy if exists demand_select on public.demand_records;
create policy demand_select on public.demand_records
  for select using (vendor_id = auth.uid() or public.is_staff());

drop policy if exists demand_insert on public.demand_records;
create policy demand_insert on public.demand_records
  for insert with check (vendor_id = auth.uid());

-- Edição/exclusão limitada à janela de 24h, exceto staff.
drop policy if exists demand_update on public.demand_records;
create policy demand_update on public.demand_records
  for update using (
    public.is_staff()
    or (vendor_id = auth.uid() and created_at > now() - interval '24 hours')
  ) with check (
    public.is_staff()
    or (vendor_id = auth.uid() and created_at > now() - interval '24 hours')
  );

drop policy if exists demand_delete on public.demand_records;
create policy demand_delete on public.demand_records
  for delete using (
    public.is_staff()
    or (vendor_id = auth.uid() and created_at > now() - interval '24 hours')
  );

-- ---------- report_config ----------
drop policy if exists report_config_select on public.report_config;
create policy report_config_select on public.report_config
  for select using (public.is_staff());

drop policy if exists report_config_modify on public.report_config;
create policy report_config_modify on public.report_config
  for all using (public.is_staff()) with check (public.is_staff());

-- =============================================================
-- STORAGE: bucket de fotos
-- =============================================================
insert into storage.buckets (id, name, public)
values ('demand-photos', 'demand-photos', false)
on conflict (id) do nothing;

drop policy if exists "demand_photos_read" on storage.objects;
create policy "demand_photos_read" on storage.objects
  for select using (
    bucket_id = 'demand-photos'
    and auth.role() = 'authenticated'
  );

drop policy if exists "demand_photos_insert" on storage.objects;
create policy "demand_photos_insert" on storage.objects
  for insert with check (
    bucket_id = 'demand-photos'
    and auth.role() = 'authenticated'
  );
