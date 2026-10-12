# WashSense Dashboard v7.0 — Dashboard interativo

Versão demonstrativa da plataforma WashSense com navegação para telas detalhadas.

## Como executar

```bash
npm run dev
```

Ou, se estiver usando o projeto anterior, mantenha o Vite rodando e abra:

- `dashboard.html` — visão geral
- `details.html?view=reservatorios` — análise de reservatórios
- `details.html?view=maquinas` — análise de máquinas
- `details.html?view=consumo` — inteligência de consumo
- `details.html?view=alertas` — central de alertas
- `details.html?view=relatorios` — indicadores gerenciais

## O que foi adicionado

- Cards, máquinas, reservatórios, alertas e gráficos clicáveis.
- Tela de detalhes por módulo.
- Gráficos de tendência e distribuição.
- KPIs para apoiar decisão operacional.
- Previsão de autonomia e ponto de reposição.
- Consumo por ciclo e por máquina.
- Energia, corrente, disponibilidade e ciclos.
- Histórico de ocorrências e manutenção.
- Ações recomendadas dentro das telas.
- Navegação pela barra lateral entre módulos.

Os números ainda são dados de demonstração. A próxima etapa é substituir os dados estáticos por consultas ao Supabase e, posteriormente, pelos dados reais recebidos via MQTT.


### Imagens padrão de equipamentos
A v7.5 usa imagens de referência de lavadora e secadora industriais carregadas por URL para o protótipo visual. Em produção, recomenda-se substituir por imagens licenciadas/próprias do catálogo da WashSense.

## v8.0 — Energia automática
- Nova aba Configurações > Energia.
- Cliente informa distribuidora e grupo tarifário.
- Consulta prototípica direta à base pública ANEEL.
- TE/TUSD convertidos para R$/kWh.
- Custo estimado exibido no dashboard.
- SQL + Edge Function skeleton para integração de produção com Supabase.
