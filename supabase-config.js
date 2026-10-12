// ============================================================
// WashSense — Configuração Supabase
// ============================================================

window.WASHSENSE_SUPABASE = {
  url: 'https://eydrrfuzfcxcqdivvued.supabase.co',

  anonKey: 'sb_publishable_bSyIXlAmtRqYmJhhZHlGQA_uwitMMDj',

  energyFunction: 'lookup-energy-tariff'
};


// ============================================================
// Cliente Supabase
// ============================================================

if (
  typeof window.supabase !== 'undefined' &&
  typeof window.supabase.createClient === 'function'
) {

  window.washsenseSupabase = window.supabase.createClient(
    window.WASHSENSE_SUPABASE.url,
    window.WASHSENSE_SUPABASE.anonKey
  );

} else {

  console.error(
    'WashSense: biblioteca do Supabase não foi carregada antes do supabase-config.js'
  );

}