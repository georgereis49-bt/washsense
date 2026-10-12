-- WashSense — estrutura para tarifas de energia
-- Fonte de referência: dados públicos ANEEL (TE/TUSD e bandeiras).

create table if not exists public.energy_tariffs (
  id uuid primary key default gen_random_uuid(),
  distributor_name text not null,
  agent_code text not null,
  tariff_group text not null check (tariff_group in ('A','B')),
  subgroup text,
  tariff_mode text,
  tariff_class text,
  tariff_subclass text,
  tariff_detail text,
  time_post text,
  unit_tertiary text,
  tusd numeric,
  te numeric,
  valid_from date,
  valid_to date,
  source text not null default 'ANEEL',
  source_resource_id text,
  fetched_at timestamptz not null default now(),
  unique (agent_code, tariff_group, subgroup, tariff_mode, tariff_class, tariff_subclass, time_post, valid_from)
);

create index if not exists idx_energy_tariffs_agent_group on public.energy_tariffs(agent_code, tariff_group);
create index if not exists idx_energy_tariffs_validity on public.energy_tariffs(valid_from, valid_to);

create table if not exists public.unit_energy_settings (
  unit_id uuid primary key references public.units(id) on delete cascade,
  distributor_name text not null,
  agent_code text,
  tariff_group text not null check (tariff_group in ('A','B')),
  tariff_id uuid references public.energy_tariffs(id),
  automatic_updates boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.energy_tariffs enable row level security;
alter table public.unit_energy_settings enable row level security;

drop policy if exists energy_tariffs_select_authenticated on public.energy_tariffs;
create policy energy_tariffs_select_authenticated
on public.energy_tariffs for select to authenticated
using (true);

drop policy if exists unit_energy_settings_select_members on public.unit_energy_settings;
create policy unit_energy_settings_select_members
on public.unit_energy_settings for select to authenticated
using (has_unit_access(unit_id));

drop policy if exists unit_energy_settings_insert_managers on public.unit_energy_settings;
create policy unit_energy_settings_insert_managers
on public.unit_energy_settings for insert to authenticated
with check (has_unit_access(unit_id) and has_org_role((select organization_id from public.units where id=unit_id), array['admin','manager']));

drop policy if exists unit_energy_settings_update_managers on public.unit_energy_settings;
create policy unit_energy_settings_update_managers
on public.unit_energy_settings for update to authenticated
using (has_unit_access(unit_id) and has_org_role((select organization_id from public.units where id=unit_id), array['admin','manager']))
with check (has_unit_access(unit_id) and has_org_role((select organization_id from public.units where id=unit_id), array['admin','manager']));

-- A ingestão/atualização de tarifas deve usar service_role/Edge Function,
-- não o navegador do cliente.
