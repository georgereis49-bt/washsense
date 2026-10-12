// WashSense — esqueleto da sincronização server-side com a ANEEL.
// Em produção, agende esta Edge Function (ex.: diariamente) e grave snapshots
// em public.energy_tariffs usando SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const RESOURCE_ID = 'fcf2906c-7c32-4b9b-a637-054e7a5234f4';
const ANEEL = 'https://dadosabertos.aneel.gov.br/api/3/action/datastore_search_sql';

Deno.serve(async () => {
  const sql = `SELECT "SigAgente","DatInicioVigencia","DatFimVigencia","DscSubGrupo","DscModalidadeTarifaria","DscClasse","DscSubClasse","DscDetalhe","NomPostoTarifario","DscUnidadeTerciaria","VlrTUSD","VlrTE" FROM "${RESOURCE_ID}" WHERE ("DatFimVigencia" IS NULL OR "DatFimVigencia" >= CURRENT_DATE) ORDER BY "DatInicioVigencia" DESC LIMIT 10000`;
  const response = await fetch(`${ANEEL}?sql=${encodeURIComponent(sql)}`);
  if (!response.ok) return new Response('ANEEL request failed', { status: 502 });
  const payload = await response.json();
  if (!payload.success) return new Response('ANEEL query failed', { status: 502 });

  const records = payload.result.records.map((r: any) => ({
    distributor_name: r.SigAgente,
    agent_code: r.SigAgente,
    tariff_group: String(r.DscSubGrupo || '').startsWith('A') ? 'A' : 'B',
    subgroup: r.DscSubGrupo,
    tariff_mode: r.DscModalidadeTarifaria,
    tariff_class: r.DscClasse,
    tariff_subclass: r.DscSubClasse,
    tariff_detail: r.DscDetalhe,
    time_post: r.NomPostoTarifario,
    unit_tertiary: r.DscUnidadeTerciaria,
    // ANEEL publica estes valores na unidade original da base; a aplicação
    // converte para R$/kWh no momento do cálculo.
    tusd: Number(String(r.VlrTUSD ?? 0).replace(',', '.')),
    te: Number(String(r.VlrTE ?? 0).replace(',', '.')),
    valid_from: r.DatInicioVigencia || null,
    valid_to: r.DatFimVigencia || null,
    source: 'ANEEL',
    source_resource_id: RESOURCE_ID,
    fetched_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from('energy_tariffs').upsert(records, {
    onConflict: 'agent_code,tariff_group,subgroup,tariff_mode,tariff_class,tariff_subclass,time_post,valid_from'
  });
  if (error) return new Response(error.message, { status: 500 });

  return Response.json({ ok: true, imported: records.length });
});
