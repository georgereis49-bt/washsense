export default function mount(document, location, window) {
const $e = s => document.querySelector(s);
const distributorInput = $e('#energyDistributor');
const groupInput = $e('#energyGroup');
const statusBox = $e('#tariffStatus');
const resultBox = $e('#tariffResult');
const refreshButton = $e('#refreshTariff');
const demoKwh = 1248;

const cfg = window.WASHSENSE_SUPABASE || {};
const hasSupabaseConfig = () => cfg.url && !cfg.url.includes('SEU-PROJETO') && cfg.anonKey && !cfg.anonKey.includes('SUA_ANON_KEY');

const STORAGE_KEY = 'washsenseEnergyConfigV2';

function setEnergyStatus(title, message, state='neutral') {
  if (!statusBox) return;
  statusBox.className = 'tariff-status ' + state;
  statusBox.innerHTML = `<span class="status-dot-ui"></span><div><strong>${title}</strong><p>${message}</p></div>`;
}
function moneyBR(v, digits=4) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString('pt-BR',{minimumFractionDigits:digits,maximumFractionDigits:digits}) : '—';
}
function moneyCurrency(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:2,maximumFractionDigits:2}) : '—';
}
function dateBR(v) {
  if (!v) return 'Vigente';
  const d = new Date(v + 'T00:00:00');
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString('pt-BR');
}
function num(id, fallback=0) {
  const n = Number($e(id)?.value);
  return Number.isFinite(n) ? n : fallback;
}
function saveConfig(config) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}
function getTaxInputs() {
  // Configuração fixa desta versão: São Paulo / Enel SP / Demais classes.
  // O ICMS é aplicado "por dentro". PIS/PASEP e COFINS não entram no cálculo
  // porque suas alíquotas efetivas variam mensalmente. CIP/COSIP também fica fora.
  return { icms: 0.18, pis: 0, cofins: 0, cip: 0 };
}
function calculateCost(config) {
  if (!config || !Number.isFinite(Number(config.base))) return null;
  const taxes = getTaxInputs();
  const tariff = Number(config.base) || 0;
  const flag = Number(config.flag?.additional_kwh) || 0;
  const preTaxKwh = tariff + flag;
  const grossKwh = preTaxKwh / (1 - taxes.icms);
  const total = grossKwh * demoKwh;
  return { tariff, flag, preTaxKwh, grossKwh, total, cip: 0, taxSum: taxes.icms, icms: taxes.icms };
}
function updateCost(config) {
  const calc = calculateCost(config);
  if (!calc) {
    $e('#costTariff').textContent = '—';
    $e('#costFlag').textContent = '—';
    $e('#demoTariffCost').textContent = '—';
    $e('#demoCost').textContent = '—';
    $e('#demoUnitCost').textContent = '—';
    $e('#energyCostTitle').textContent = 'Configure a tarifa';
    return;
  }
  $e('#costTariff').textContent = moneyCurrency(calc.tariff) + '/kWh';
  $e('#costFlag').textContent = calc.flag > 0 ? `${moneyCurrency(calc.flag)}/kWh` : 'R$ 0,0000/kWh';
  $e('#demoTariffCost').textContent = moneyCurrency(calc.preTaxKwh * demoKwh);
  $e('#demoCost').textContent = moneyCurrency(calc.total);
  $e('#demoUnitCost').textContent = moneyCurrency(calc.total / demoKwh) + '/kWh';
  $e('#energyCostTitle').textContent = moneyCurrency(calc.total);
  $e('#energyCostDescription').textContent = `Estimativa para ${demoKwh.toLocaleString('pt-BR')} kWh, incluindo TE + TUSD, bandeira e ICMS de 18%. PIS/PASEP, COFINS e CIP/COSIP não estão incluídos porque podem variar.`;
  const flagName = config.flag?.name || 'Não consultada';
  $e('#flagSource').textContent = `ANEEL · ${flagName}`;
}
function renderTariff(t) {
  $e('#tariffTitle').textContent = `${t.distributor_name || distributorInput.value} · ${t.subgroup || 'Grupo '+groupInput.value}`;
  $e('#tariffTE').textContent = moneyBR(t.te);
  $e('#tariffTUSD').textContent = moneyBR(t.tusd);
  $e('#tariffBase').textContent = moneyBR(t.base);
  $e('#tariffValidity').textContent = dateBR(t.valid_from);
  $e('#tariffMode').textContent = [t.mode,t.class,t.time_post].filter(Boolean).join(' · ') || 'Tarifa de aplicação';
  resultBox.hidden = false;
}

async function queryViaSupabase(distributor, group) {
  const endpoint = `${cfg.url.replace(/\/$/,'')}/functions/v1/${cfg.energyFunction || 'lookup-energy-tariff'}`;
  const response = await fetch(endpoint, {
    method:'POST',
    headers:{'Content-Type':'application/json','apikey':cfg.anonKey,'Authorization':`Bearer ${cfg.anonKey}`},
    body:JSON.stringify({distributor,group})
  });
  const payload = await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(payload.error || `Supabase respondeu ${response.status}`);
  const tariff = payload.tariff || payload;
  if (!tariff || typeof tariff !== 'object' || !Number.isFinite(Number(tariff.base))) {
    throw new Error('A função não retornou uma tarifa válida.');
  }
  return tariff;
}

async function queryTariff() {
  const distributor = 'Enel SP';
  const group = 'B3';
  const distributorForApi = distributor && /^enel(?:\s+sp|\s+s[aã]o\s+paulo)?$/i.test(distributor) ? 'Enel' : distributor;
  if (!hasSupabaseConfig()) {
    setEnergyStatus('Conexão Supabase não configurada','Abra o arquivo supabase-config.js e informe a URL e a publishable/anon key.','error');
    return;
  }
  setEnergyStatus('Consultando ANEEL…','Buscando tarifa e bandeira vigentes na base oficial.','loading');
  resultBox.hidden = true;
  try {
    const tariff = await queryViaSupabase(distributorForApi,group);
    renderTariff(tariff);
    const config={
      distributor,group,agent:tariff.distributor_name,te:Number(tariff.te),tusd:Number(tariff.tusd),base:Number(tariff.base),
      start:tariff.valid_from,end:tariff.valid_to,mode:tariff.mode||'',subgroup:tariff.subgroup||'',class:tariff.class||'',time_post:tariff.time_post||'',
      flag: tariff.flag || null,
      source:'ANEEL',updatedAt:new Date().toISOString()
    };
    saveConfig(config);
    updateCost(config);
    const flagText = config.flag?.name ? ` Bandeira: ${config.flag.name}${Number(config.flag.additional_kwh)>0 ? ` (+${moneyBR(config.flag.additional_kwh,5)}/kWh)` : ''}.` : ' Bandeira não retornada pela API.';
    setEnergyStatus('Cálculo atualizado',`Tarifa e bandeira consultadas na base oficial da ANEEL.${flagText}`,'success');
  } catch (error) {
    setEnergyStatus('Não foi possível atualizar o cálculo',error.message || 'Verifique a configuração do Supabase e tente novamente.','error');
  }
}

function loadSavedEnergy() {
  try {
    const config=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
    if(!config)return;
    if (distributorInput) distributorInput.value='Enel SP';
    if (groupInput) groupInput.value='B3';
    renderTariff({distributor_name:config.agent||config.distributor,subgroup:config.subgroup||config.group,te:config.te,tusd:config.tusd,base:config.base,valid_from:config.start,mode:config.mode,class:config.class,time_post:config.time_post});
    updateCost(config);
    setEnergyStatus('Cálculo configurado','A última composição está salva neste navegador. Clique em “Atualizar cálculo” para consultar novamente a ANEEL.','success');
  } catch(_){}
}


refreshButton?.addEventListener('click',queryTariff);
distributorInput?.addEventListener('keydown',e=>{if(e.key==='Enter')queryTariff();});
groupInput?.addEventListener('change',()=>{if(distributorInput?.value.trim())queryTariff();});

loadSavedEnergy();

}
