# WashSense — tarifa automática de energia

A tela de Energia recebe somente **distribuidora** e **grupo tarifário**. A consulta da tarifa é feita server-side por uma Supabase Edge Function, que consulta a base oficial da ANEEL.

A ANEEL informa que o conjunto de tarifas de aplicação contém TE e TUSD e é atualizado semanalmente. Fonte: https://dadosabertos.aneel.gov.br/dataset/tarifas-distribuidoras-energia-eletrica

## 1. Configurar o front-end

Edite `supabase-config.js`:

```js
window.WASHSENSE_SUPABASE = {
  url: 'https://SEU-PROJETO.supabase.co',
  anonKey: 'SUA_ANON_KEY',
  energyFunction: 'lookup-energy-tariff'
};
```

Use somente a **anon/publishable key**. Nunca coloque a `service_role` no navegador.

## 2. Deploy da Edge Function

Na pasta do projeto Supabase:

```bash
supabase functions deploy lookup-energy-tariff --no-verify-jwt
```

A função recebe:

```json
{"distributor":"Enel São Paulo","group":"B"}
```

E retorna TE, TUSD, modalidade, classe, posto, unidade e vigência.

## 3. Banco para persistência

O arquivo `supabase-energy-tariffs.sql` cria `energy_tariffs` e `unit_energy_settings` para armazenar a tarifa selecionada por unidade. A função de consulta pode depois ser expandida para gravar snapshots e atualizar automaticamente.

## 4. Produção

Para produção, o ideal é manter a consulta/cache no Supabase, adicionar autenticação da aplicação e rate limiting. O navegador não deve acessar a ANEEL diretamente.
