import { createClient } from "@supabase/supabase-js";
// Existing public configuration. Authorization remains enforced by the API/RLS.
export const config = {
  url: "https://eydrrfuzfcxcqdivvued.supabase.co",
  anonKey: "sb_publishable_bSyIXlAmtRqYmJhhZHlGQA_uwitMMDj",
  energyFunction: "lookup-energy-tariff",
};
export const client = createClient(config.url, config.anonKey);
