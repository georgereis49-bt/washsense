# WashSense 3.0 — Atlântico Preciso

Implementação na branch `redesign/atlantico-premium-v3`, baseada em `redesign/integrated-platform` (`8d9e093d68f6df899dabd2e35cc7d68cf3a58dd7`). Nenhum merge/deploy/migration/operação no Supabase de produção.

[Galeria interativa das capturas](gallery.html) · [Antes](screenshots/before/dashboard-light.png) · [Dashboard claro](screenshots/round2/visao-geral-light-desktop.png) · [Dashboard escuro](screenshots/round2/visao-geral-dark-desktop.png) · [Mobile](screenshots/round2/visao-geral-light-mobile.png)

## Implementação

- Dashboard nativo React com hierarquia editorial, métricas em faixa, curva SVG interativa, referência comparativa explicitamente ilustrativa, eficiência circular, reservatórios volumétricos, parque de equipamentos com filtro e prioridades. Mantidos os dados demonstrativos, os períodos e o cálculo de energia da base.
- Sistema visual independente dos CSSs antigos dos módulos: tokens Atlântico Preciso, camadas, superfícies, inputs, tabelas, modais, sombras, estados, teclado e motion com `prefers-reduced-motion`. Inter para leitura; Manrope self-hosted para títulos. A nova dependência é somente `@fontsource/manrope` (licença incluída em fonts/).
- Shell compacto com navegação integrada, sidebar recolhível/mobile, conta e busca de módulos via Ctrl/⌘ K. Deep links e cache de filtros/rascunhos preservados.
- Máquinas: diretório de equipamentos, destaque de ciclo e análise. Reservatórios: identidade volumétrica e vínculo ao equipamento. Consumo: curva, distribuição em donut e comparação. Alertas: fila priorizada e histórico com superfícies diferentes.
- Financeiro: assinatura em destaque, próxima cobrança, ledger antes da descoberta de planos e diálogos no mesmo sistema visual. IDs/data attributes usados pelo controlador preservados. O controlador financeiro é byte a byte igual à base.
- Energia: composição e tarifa em grades responsivas, mantendo consulta/payload/cache/ICMS/fórmula. Controlador de energia byte a byte igual à base; o novo dashboard usa a mesma fórmula e chave de armazenamento.
- Relatórios: editor lateral no desktop, configuração em coluna no mobile, documento em camada própria e exportação CSV/PDF existente. Corrigida a representação dos milhares brasileiros nas barras (1.280 kWh → 1280, não 1), sem alterar valores/tabelas/export.
- Configurações: navegação horizontal e estúdio de formulários. Rascunhos e cadastro demonstrativo de produtos mantidos; não foi inventada persistência no banco.
- Login completamente reconstruído: campos e handlers Supabase preservados, tema persistente, senha visível/oculta, recuperação, demonstração e suporte. Regras de sessão/logout e proteção do financeiro em demo mantidas.

## Verificação

**Suíte completa: 27 PASS.** Após acabamento final de ícones e contraste de gráficos escuros, 11 cenários afetados foram reexecutados: **11 PASS**. A composição final de alertas foi validada novamente nos quatro layouts/temas: **1 PASS**; o baseline do dashboard foi comparado sem atualizar imagens: **1 PASS**.

- `npm run build`: PASS; nove HTMLs de produção, incluindo app e URLs legadas. Nenhum arquivo SQL, pending, credencial, backend, docs ou testes na saída pública examinada.
- `npm run typecheck`: PASS (target ES2020 preservado).
- `npm test -- --workers=1 --update-snapshots`: 27 PASS, incluindo navegação sem reload, retenção de filtros/rascunhos/tema, deep links, redirecionamento anônimo, proteção do financeiro demo, CSV, foco de gráfico, filtros de máquinas, busca, login, recuperação e contraste WCAG 2.1 AA com axe.
- Regressões financeiras interceptam e verificam leituras filtradas por organização e abertura/fechamento do diálogo sem mutações. Regressões ANEEL validam `{distributor:'Enel',group:'B3'}` e o mesmo custo entre energia/dashboard.
- Viewports: 390, 768, 1440 e 1920 px. As capturas regulares cobrem todos os nove módulos + login, em claro/escuro e desktop/mobile (40 por rodada), além de tablet/widescreen.
- Testes bloqueiam todos os hosts externos por padrão; exceções são somente interceptações sintéticas de Supabase. Nenhuma chave privada, registro real ou cobrança. Sem chamada real a Auth/Asaas/ANEEL/IoT.

Logs: [suíte completa](evidence/full-regression.txt), [TypeScript](evidence/typecheck.txt), [build](evidence/build.txt), [acabamento final](evidence/final-polish.txt), [composição de alertas](evidence/alert-composition.txt) e [comparação dos baselines](evidence/baseline-assert.txt).

## Duas rodadas de revisão visual

1. `screenshots/round1`: renderização real em Chromium, 40 capturas. Revisados todos os módulos; comparado o dashboard ao baseline versionado da base. Identificados: itálico causado por `<i/>` inválido no HTML do login; valores de tarifa colados por seletores incompatíveis; barras do relatório lendo pontos de milhar como decimais. Ajustados também leitura das legendas, escala/grade do gráfico e diferenciação de consumo/alertas.
2. `screenshots/round2`: nova renderização em todos os temas/viewports após correções. Revisados alinhamento, proporções, tabelas, gráficos, contraste, logo transparente, desktop/mobile e login. Acabamento adicional troca glifos ausentes por SVG, melhora distinção de segmentos/barras no tema escuro e remove a área vazia do card de tendência de alertas; as capturas são atualizadas pelos testes afetados. Baselines Playwright do dashboard foram atualizados após a mudança visual intencional, preservando a imagem anterior em before/.

Falhas iniciais de contraste/timeouts e markup foram corrigidas; não se considera build como prova de qualidade visual. O laboratório compartilha recursos: um worker evita competição entre browsers, e o timeout maior da auditoria de oito módulos permite concluir todas as asserções; nenhuma auditoria foi desativada.

## Escopo e limites

A landing page institucional e o retorno de pagamento não foram reconstruídos: os dez módulos solicitados, incluindo autenticação, são o foco. React/SPA já existe na base; controladores DOM são mantidos onde a reescrita colocaria integrações em risco. O dashboard é novo, não um iframe da tela antiga. Os estilos antigos dos módulos deixam de ser importados; arquivos históricos permanecem no repositório para rastreabilidade.

Demonstrações de operação continuam demonstrações. Integrações IoT e dados reais de módulos que não estão implementados/versionados na base não foram fabricados. Fixtures HTTP validam regressão do contrato do frontend, não funcionamento do backend remoto ou cobranças. Sem teste em Safari/iOS/Android físico; validação visual e automatizada feita no Chromium Linux. Auditoria axe não substitui avaliação assistiva humana completa.

A lógica financeira, as Edge Functions, `supabase.ts`, assets da marca e `vite.config.ts` não possuem diferenças contra a base. A lógica Auth existente permanece, com adição somente de fontes/tema de apresentação no arquivo de login. Nenhuma mudança em RLS/grants/funções do banco.

Alterações locais anteriores em README.md/vite.config.ts foram preservadas em `stash@{0}` (`Preserve local Stage1 files before premium redesign`) e `/workspace/scratch/washsense-stage1-preserved.patch`; não foram sobrescritas nem misturadas à branch nova.

## Reprodução

```sh
npm ci --cache /tmp/washsense-npm-cache
npm run typecheck
npm run build
npm test -- --workers=1
```

O cache em /tmp evita a localização de HOME sem permissão de escrita neste ambiente. Não foi desativada verificação de integridade/TLS. Playwright usa `/usr/bin/chromium` ou `PLAYWRIGHT_CHROMIUM_PATH`; preview local é iniciado pela configuração. Para refazer capturas: `VISUAL_ROUND=round2 npm test -- --grep 'premium screenshots'`. As imagens de revisão não entram em dist, por `publicDir:false` e assets explícitos.

## Publicação para revisão

PR deve ser Draft, com base `redesign/integrated-platform`, para revisar somente esta evolução. A API `api.github.com` respondeu 403 no CONNECT do proxy e o `gh` GraphQL também recebeu Forbidden. Git fetch/push são uma capacidade diferente; um push não comprova autorização para criar PR. O corpo proposto está em PR.md. Não se registra link de PR sem criação confirmada.

Foi salvo um rascunho de configuração do ambiente adicionando somente `api.github.com` aos domínios personalizados, preservando `mcp.supabase.com` e os presets existentes. A ferramenta confirmou `status:saved` e `requires_publish:true`. Isso não ativa o acesso atual: é preciso revisar/salvar/publicar nas configurações do ambiente. Após ativação, a autorização específica da API ainda precisa ser verificada. Scripts, secrets e membership de repositórios não foram substituídos.
