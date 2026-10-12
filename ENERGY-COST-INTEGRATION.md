# WashSense — Custo estimado de energia

## Configuração desta versão
- Localidade fixa: São Paulo/SP
- Distribuidora fixa: Enel SP
- Perfil tarifário fixo: B3 — Demais classes
- TE + TUSD: consulta automática à ANEEL
- Bandeira tarifária: consulta automática à ANEEL
- ICMS: 18% para Demais classes em SP, aplicado por dentro na estimativa
- PIS/PASEP: alíquota nominal 1,65%, mas alíquota efetiva mensal varia; NÃO entra no cálculo
- COFINS: alíquota nominal 7,60%, mas alíquota efetiva mensal varia; NÃO entra no cálculo
- CIP/COSIP: não entra no cálculo nesta versão

## Observação exibida ao cliente
O valor apresentado é uma estimativa. PIS/PASEP e COFINS têm alíquotas efetivas que podem variar mensalmente conforme a apuração da distribuidora. A CIP/COSIP também não é incluída.

## Fórmula da estimativa
1. Tarifa base = TE + TUSD
2. Soma o adicional da bandeira vigente
3. Aplica ICMS de 18% por dentro:
   custo estimado/kWh = (TE + TUSD + bandeira) / (1 - 0,18)
4. Multiplica pelo consumo monitorado.

Fonte tarifária: ANEEL.
Referências tributárias: Enel São Paulo.
