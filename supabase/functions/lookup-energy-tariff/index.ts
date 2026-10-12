const ANEEL_RESOURCE = 'fcf2906c-7c32-4b9b-a637-054e7a5234f4';
const ANEEL_APIS = [
  'https://dadosabertos.aneel.gov.br/api/action/datastore_search',
  'https://dadosabertos.aneel.gov.br/api/3/action/datastore_search',
  'https://dadosabertos.aneel.gov.br/pt_BR/api/action/datastore_search',
];

const aliases: Record<string, string[]> = {
  'enel são paulo': ['ENEL DISTRIBUIÇÃO SÃO PAULO', 'ENEL DISTRIBUICAO SAO PAULO', 'ENEL SP', 'ENEL', 'ELETROPAULO'],
  'enel': ['ENEL DISTRIBUIÇÃO SÃO PAULO', 'ENEL DISTRIBUICAO SAO PAULO', 'ENEL SP', 'ENEL', 'ELETROPAULO'],
  'cpfl paulista': ['CPFL PAULISTA'],
  'cpfl piratininga': ['CPFL PIRATININGA', 'CPFL-PIRATININGA'],
  'cemig': ['CEMIG-D', 'CEMIG'],
  'neoenergia elektro': ['NEOENERGIA ELEKTRO', 'ELEKTRO'],
  'neoenergia coelba': ['NEOENERGIA COELBA', 'COELBA'],
  'equatorial': ['EQUATORIAL'],
  'light': ['LIGHT'],
};

const norm = (v: unknown) => String(v ?? '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, ' ').trim().toLowerCase();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

function parseDate(value: unknown): number {
  const s = String(value ?? '').trim();
  if (!s) return 0;
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return Date.parse(`${br[3]}-${br[2]}-${br[1]}T23:59:59Z`);
  const iso = Date.parse(s);
  return Number.isNaN(iso) ? 0 : iso;
}

function isCurrent(value: unknown): boolean {
  const t = parseDate(value);
  return !t || t >= Date.now();
}

function numberFromText(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const s = String(value ?? '').trim().replace(/\s/g, '').replace(/R\$/gi, '');
  if (!s) return 0;
  let n = s;
  if (s.includes(',') && s.includes('.')) n = s.replace(/\./g, '').replace(',', '.');
  else if (s.includes(',')) n = s.replace(',', '.');
  const result = Number(n);
  return Number.isFinite(result) ? result : 0;
}

function text(v: unknown) { return String(v ?? '').trim(); }

function agentMatches(row: any, terms: string[]) {
  const agent = norm(row?.SigAgente);
  return terms.some(t => {
    const n = norm(t);
    return n && (agent === n || agent.includes(n) || n.includes(agent));
  });
}

function scoreRow(row: any, group: string) {
  const sg = norm(row?.DscSubGrupo);
  const mode = norm(row?.DscModalidadeTarifaria);
  const base = norm(row?.DscBaseTarifaria);
  const clazz = norm(row?.DscClasse);
  const subclass = norm(row?.DscSubClasse);
  const post = norm(row?.NomPostoTarifario);
  let s = 0;

  // Para uma lavanderia comercial em Grupo B, B3 convencional é o padrão esperado.
  if (group === 'B3') {
    if (sg === 'b3') s += 500;
    if (mode === 'convencional') s += 100;
    if (clazz.includes('comercial')) s += 80;
  } else if (group === 'B1') {
    if (sg === 'b1') s += 500;
    if (mode === 'convencional') s += 100;
  } else if (group === 'B2') {
    if (sg === 'b2') s += 500;
    if (mode === 'convencional') s += 100;
  } else if (group === 'B4') {
    if (sg === 'b4' || sg === 'b4a' || sg === 'b4b') s += 500;
    if (mode === 'convencional') s += 100;
    if (base === 'tarifa de aplicação') s += 100;
    if (clazz === 'nao se aplica') s += 30;
    if (clazz.includes('comercial')) s += 30;
    if (subclass.includes('nao se aplica')) s += 20;
    if (post === 'nao se aplica' || post === 'na') s += 20;
  }

  const te = numberFromText(row?.VlrTE);
  const tusd = numberFromText(row?.VlrTUSD);
  if (te > 0) s += 40;
  if (tusd > 0) s += 40;
  s += Math.min(parseDate(row?.DatInicioVigencia) / 1e12, 30);
  return s;
}

async function datastoreSearch(filters: Record<string, string>, limit = 1000) {
  const attempts: any[] = [];
  for (const api of ANEEL_APIS) {
    try {
      const response = await fetch(api, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'accept': 'application/json' },
        body: JSON.stringify({
          resource_id: ANEEL_RESOURCE,
          filters,
          limit,
          include_total: false,
        }),
      });
      const raw = await response.text();
      if (!response.ok) {
        attempts.push({ api, status: response.status, body: raw.slice(0, 300) });
        continue;
      }
      let payload: any;
      try { payload = JSON.parse(raw); } catch {
        attempts.push({ api, status: response.status, error: 'Resposta não-JSON' });
        continue;
      }
      if (!payload?.success) {
        attempts.push({ api, status: response.status, error: payload?.error ?? 'CKAN retornou success=false' });
        continue;
      }
      const records = Array.isArray(payload?.result?.records) ? payload.result.records : [];
      return { records, attempts };
    } catch (e) {
      attempts.push({ api, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return { records: [], attempts };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);

  try {
    const body = await req.json();
    const distributor = text(body?.distributor);
    const group = text(body?.group || 'B').toUpperCase();
    if (!distributor) return json({ error: 'Distribuidora obrigatória.' }, 400);
    if (!['A', 'B1', 'B2', 'B3', 'B4'].includes(group)) return json({ error: 'Subgrupo tarifário inválido.' }, 400);

    const terms = [...new Set((aliases[norm(distributor)] ?? [distributor]).map(norm).filter(Boolean))];
    const all: any[] = [];
    const diagnostics: any[] = [];

    // Em vez de usar q=ENEL, filtramos por subgrupo no próprio DataStore.
    // Isso evita depender do índice de texto do CKAN, que é o ponto que vinha falhando.
    const subgroupFilters = group === 'B3' ? ['B3'] : group === 'B1' ? ['B1'] : group === 'B2' ? ['B2'] : group === 'B4' ? ['B4', 'B4a', 'B4b'] : ['A4', 'A3', 'A2', 'A3a', 'A3b'];

    for (const subgroup of subgroupFilters) {
      const result = await datastoreSearch({ DscSubGrupo: subgroup }, 1000);
      diagnostics.push({ subgroup, records: result.records.length, attempts: result.attempts });
      all.push(...result.records);
      if (result.records.length) break;
    }

    let rows = all.filter(r => agentMatches(r, terms) && isCurrent(r?.DatFimVigencia));

    // Alguns registros podem aparecer com o nome sem acento ou razão social diferente.
    // Se nada foi encontrado, fazemos uma segunda busca sem filtro de subgrupo e limitamos
    // a uma quantidade segura, somente como fallback.
    if (!rows.length) {
      const fallback = await datastoreSearch({}, 5000);
      diagnostics.push({ fallback_records: fallback.records.length, attempts: fallback.attempts });
      rows = fallback.records.filter(r => agentMatches(r, terms) && isCurrent(r?.DatFimVigencia));
    }

    if (!rows.length) {
      return json({
        error: 'Tarifa não encontrada para os parâmetros informados.',
        debug: { distributor, group, searched_terms: terms, diagnostics, note: 'A consulta ao DataStore foi feita por filtros, sem depender da busca textual q.' },
      }, 404);
    }

    // Deduplicação.
    const unique = new Map<string, any>();
    for (const r of rows) {
      const key = [r?._id, r?.SigAgente, r?.DatInicioVigencia, r?.DscSubGrupo, r?.DscModalidadeTarifaria, r?.DscClasse, r?.DscSubClasse, r?.NomPostoTarifario, r?.VlrTUSD, r?.VlrTE].join('|');
      unique.set(key, r);
    }
    rows = [...unique.values()];

    rows.sort((a, b) => scoreRow(b, group) - scoreRow(a, group));
    const selected = rows[0];
    const unit = text(selected?.DscUnidadeTerciaria);
    const divisor = /mwh/i.test(unit) ? 1000 : 1;
    const te = numberFromText(selected?.VlrTE) / divisor;
    const tusd = numberFromText(selected?.VlrTUSD) / divisor;

    if (!(te > 0) && !(tusd > 0)) {
      return json({ error: 'A ANEEL retornou a distribuidora, mas não retornou valores TE/TUSD utilizáveis.', debug: { selected, diagnostics } }, 422);
    }

    return json({
      source: 'ANEEL',
      fetched_at: new Date().toISOString(),
      tariff: {
        distributor_name: selected?.SigAgente,
        group,
        subgroup: selected?.DscSubGrupo,
        mode: selected?.DscModalidadeTarifaria,
        class: selected?.DscClasse,
        subclass: selected?.DscSubClasse,
        detail: selected?.DscDetalhe,
        time_post: selected?.NomPostoTarifario,
        unit,
        te,
        tusd,
        base: te + tusd,
        valid_from: selected?.DatInicioVigencia,
        valid_to: selected?.DatFimVigencia,
      },
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Erro interno.' }, 500);
  }
});
