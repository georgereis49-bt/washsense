# Grants DML baseados no código — base ba5d87c

**PASS para a proposta e testes locais; BLOCKED para homologar todos os módulos ou aprovar concessões de energia em produção.** Não há justificativa versionada para ampliar os grants operacionais das 19 tabelas. As cinco leituras financeiras já estão concedidas no snapshot; o caminho principal da proposta é um no-op nesse estado.

Proposta: `supabase/security/20261012_minimal_application_dml.sql.pending`, fora de migrations. As três propostas anteriores permaneceram byte a byte iguais. Não foi modificado o site, o financeiro, o schema remoto, RLS, funções existentes ou configurações de produção.

## Evidência e matriz por tabela

S=SELECT, I=INSERT, U=UPDATE, D=DELETE. “—” significa **nenhuma nova concessão justificada**, sem revogar privilégios existentes. S financeiro: preservar o SELECT de tabela atual; se faltar, conceder somente as colunas comprovadas pelo código, não SELECT de tabela. Os quatro papéis de negócio compartilham `authenticated`; RLS existente limita as linhas, não há novas permissões de escrita por papel.

| Tabela | anon: necessidade confirmada | authenticated: necessidade confirmada | service_role: necessidade confirmada/estado preservado |
|---|---|---|---|
| organizations | — | S id/name para o embed financeiro | — |
| organization_members | — | S organization_id/role; user_id para filtro do próprio usuário | CRUD atual, dependência backend não versionada; não ampliar nem revogar nesta proposta |
| units | — | — | — |
| machines | — | — | — |
| reservoirs | — | — | — |
| devices | — | — | — |
| sensors | — | — | — |
| machine_readings | — | — | — |
| reservoir_readings | — | — | — |
| payments | — | S colunas consultadas pelo financeiro | CRUD atual, dependência backend não versionada; não ampliar nem revogar nesta proposta |
| subscriptions | — | S colunas consultadas pelo financeiro | —; escritas Asaas não confirmadas |
| alerts | — | — | — |
| maintenance | — | — | — |
| audit_logs | — | — | — |
| consumption_records | — | — | — |
| machine_cycles | — | — | — |
| plans | — | S id/name/description/price_monthly/max_units/max_machines/max_devices | — |
| profiles | — | — | —; automação de criação remota não versionada |
| reservoir_refills | — | — | — |
| energy_tariffs (fora do snapshot) | — | — | S/I/U **condicionais**, para o upsert versionado; nenhum D |
| unit_energy_settings (fora do snapshot) | — | — | — |

Não se presume que as duas tabelas de energia estejam ausentes do remoto. Sua estrutura existe em SQL versionado, mas não está comprovada pelo inventário fornecido. Os CRUD já existentes de service_role em pagamentos/membros são fatos do snapshot, **não recomendação de necessidade mínima**; remover ou ampliar depende do backend real.

Evidências:

- `finance.js:769`: organization_members filtrado por auth.getUser().id e embed organizations(id,name).
- `finance.js:893`: assinatura, filtro organization_id e ordenação started_at; `:1003`: plano; `:1095` e `:2487`: pagamentos e consulta de status, filtros organization_id/provider_payment_id e ordenação created_at. Não há INSERT/UPDATE/DELETE/RPC diretos nesses fluxos. Colunas completas estão em `supabase/tests/dml/contracts.py` e na proposta.
- `login.html:1073` e `:1226`: Supabase Auth (login/recuperação), não consultas de tabelas public como anon. Nenhum grant public anônimo necessário para esses endpoints.
- `settings.js:5`, `:22`: dados de demonstração e salvamento de estado visual; `dashboard.js:9`, `report.js:2`, `details.js`: dados locais/renderização, sem consultas Supabase. `energy.js:36` salva localStorage; `:88` chama a função HTTP, sem escrita em unit_energy_settings.
- `supabase/functions/lookup-energy-tariff/index.ts`: consulta diretamente ANEEL, não banco Supabase.
- `supabase/functions/sync-energy-tariffs/index.ts:6` e `:44`: cliente service_role e upsert em energy_tariffs; conflito de oito campos. PostgreSQL/PostgREST exigiram SELECT além de INSERT/UPDATE, mesmo com retorno mínimo. A função é descrita como esqueleto no próprio arquivo; implantação/agendamento remotos não foram confirmados, e a necessidade é condicional à sua execução autorizada.
- RLS real de organizations/subscriptions/payments usa participação organizacional; organization_members SELECT usa user_id=auth.uid(); plans SELECT é catálogo compartilhado. A política de plans incluir anon não justifica conceder SELECT anônimo sem chamada comprovada. As políticas INSERT/UPDATE/DELETE de membros não concedem DML por si próprias.

## Proposta e limites de segurança

Primeira transação: executor postgres/PostgreSQL 17, authenticated sem SUPERUSER/BYPASSRLS, USAGE existente, tabelas postgres/RLS habilitada/FORCE RLS desabilitado. Verifica as cinco políticas SELECT reais, recusa políticas permissivas adicionais SELECT/ALL, bloqueia concorrência DDL com locks limitados a cinco segundos e valida as colunas. Concede apenas SELECT das colunas ainda sem permissão. Não cria ACLs redundantes quando SELECT já existe. Não remove SELECT de tabela atual: isso exigiria avaliar consumidores remotos não versionados. Compara políticas/flags antes e depois.

Segunda transação independente: energia fica **desabilitada por padrão**, com NOTICE explícito BLOCKED/PENDING. Só concede S/I/U a service_role mediante aprovação explícita e baseline exata revisada da tabela (colunas/defaults/ACLs de coluna, constraints, ACL de tabela, políticas e triggers), owner/RLS/versão/executor/USAGE e BYPASSRLS legítimo de service_role. Não altera política, função, trigger ou grants de outros papéis. Os GUCs de aprovação foram usados exclusivamente no laboratório com metadata sintética do SQL versionado. Essa execução não aprova o contrato remoto.

Não concede DELETE, privilégios estruturais, EXECUTE, permissões globais, ALL TABLES ou novos default privileges. Não acrescenta UPDATE/INSERT às tabelas operacionais apenas para exercitar RLS. Nenhum grant em subscriptions ou organization_members permite autoelevação pela proposta.

**Risco residual existente:** defaults públicos preservados pelas propostas anteriores ainda incluem DML amplo para objetos novos. Uma tabela criada pode herdar concessões além desta matriz. Isso precisa constar da revisão de ACLs da energia; não se presume que o GRANT explícito apague direitos preexistentes. Os testes da energia revogam os defaults herdados **somente na fixture descartável** para medir o incremento mínimo; não são instruções para produção.

## Resultados executados

| Cenário | Resultado | Evidência/limite |
|---|---|---|
| Proposta no snapshot real: nenhum aumento de ACL | PASS | Comparação das ACLs antes/depois; cinco SELECTs já existem |
| Restauração de leituras quando grants faltam | PASS | Somente na fixture, removidos SELECTs financeiros; proposta adicionou somente SELECT de coluna |
| Consulta exata ao plano, incluindo max_devices | PASS | Coluna consta no novo snapshot; incluída na proposta após falha inicial da lista incompleta de colunas do teste |
| Coluna financeira não consultada asaas_customer_id | PASS para negação | Sem grant no cenário de restauração mínima; HTTP 403/42501 |
| Política SELECT permissiva adicional | PASS para bloqueio | Proposta recusou drift e preservou ACLs |
| Leituras financeiras A/B | PASS | PostgreSQL real com claims fictícias; Auth/PostgREST real com JWTs locais |
| Embed organization_members → organizations e filtros | PASS | Consulta equivalente à usada no frontend, somente vínculos do próprio usuário |
| Admin/manager/technician/operator e participante de duas organizações | PASS | Seis contas fictícias; foreign rows ocultas, participante duplo vê suas duas organizações |
| Anônimo lendo cinco tabelas; usuário escrevendo financeiro/membros | PASS para negação | INSERT/UPDATE/DELETE, inclusive alteração de role, HTTP 403/42501 e permission denied SQL |
| Login, senha inválida, logout, refresh revogado | PASS | GoTrue real local |
| Composição com três propostas anteriores | PASS | Aplicadas somente no banco descartável; defaults como supabase_admin, demais como postgres |
| Multiunidade e transferência dentro da organização | PASS | INSERT sensor/manutenção e UPDATE dos três recursos por proprietário BYPASSRLS |
| Transferência entre organizações e alteração da unidade | PASS para negação | Triggers das propostas anteriores recusaram mudanças e vínculos cruzados |
| Writes operacionais authenticated/service_role via API | PASS para negação / BLOCKED para negócio autorizado | Sem grants comprovados; não inventados. Não afirma execução do trigger como service_role |
| Energia sem baseline aprovado | PASS para bloqueio | Nenhum grant aplicado; exceção ao habilitar sem baseline |
| Upsert tarifário INSERT e UPDATE no mesmo registro | PASS local | PostgREST real, ON CONFLICT de oito colunas e return=minimal; estrutura versionada, não remota |
| Upsert sem SELECT | PASS para negação | HTTP 403/42501, provando necessidade de S |
| DELETE tarifário por service_role; escrita por usuário | PASS para negação | HTTP 403/42501 |
| Energia remota, cobrança/Asaas, ingestão IoT | BLOCKED | Metadados/implementações correspondentes não disponíveis; nenhum fornecedor externo chamado |

Execução: PostgreSQL 17.11, GoTrue v2.197.0, PostgREST v16.4, imagens fixadas por digest como nos testes existentes. Teste SQL usa Docker local `--network=none`; API usa rede `--internal` sem portas publicadas, HTTP sem proxies/redirects e IPs próprios inspecionados. Dados, usuários e credenciais exclusivamente fictícios. Não foi executado Supabase completo, Edge Functions/Deno ou ANEEL/Asaas. As chamadas PostgREST demonstram as operações do banco, não o processamento de arquivos ANEEL ou uma cobrança.

Logs finais: [PostgreSQL](evidence/minimal-dml-postgres17.txt) e [Auth/PostgREST](evidence/minimal-dml-auth-postgrest.txt), ambos runners exit 0. As falhas intermediárias foram de expectativa/lista de colunas do teste e corrigidas; não são vulnerabilidades confirmadas. Não há FAIL remanescente nas asserções finais. Containers/volumes/rede próprios removidos.

## Pendências e recuperação

Faltam as implementações de `asaas-get-pix`, `asaas-get-boleto`, `asaas-pay-credit-card`, `asaas-set-recurring-card` (referenciadas em finance.js:2231/:3895/:5593/:5776), seus clientes/papéis SQL/RPCs efetivos e funções privilegiadas associadas. Também falta implementação persistente de cadastro/edição operacional, ingestão IoT, auditoria e geração de relatórios do banco. Não se infere ausência desses componentes no remoto. Sem isso não é possível justificar grants financeiros de escrita, DELETE, leituras de telemetria ou gestão de membros.

Antes de habilitar energia: obter/revisar metadata sanitizada de energy_tariffs e dependências (schema, índices/chave de upsert, RLS/políticas, triggers e corpos das funções acionadas, grants diretos/coluna/efetivos, ownership, default privileges relevantes). Revisar autenticação/autorização do endpoint sync e execução de serviço, que não foram exercitadas. Não pedir nem exportar dados, tokens ou chaves privadas. O índice único de campos nullable do SQL versionado pode produzir duplicatas quando chaves forem NULL; não foi alterado nesta tarefa.

Registrar ACLs de tabela/coluna antes da aplicação futura. Se o estado real permanecer o snapshot fornecido, a primeira transação não muda nada. Se houver novas concessões de coluna, o rollback deve remover **apenas o delta** ausente no checkpoint, preservando grants anteriores. Na energia, registrar o delta S/I/U e restaurar somente esse delta, sem revogar direitos preexistentes ou restaurar privilégios estruturais. As duas transações são independentes: erro na energia não desfaz um COMMIT anterior da fase de leitura. A recuperação integral pós-COMMIT das propostas anteriores já está testada; não precisa ser repetida para o no-op atual.

Reprodução local: `python3 supabase/tests/dml/test_postgres.py` e `python3 supabase/tests/dml/test_auth_api.py`, com Docker Linux local e as imagens fixadas já disponíveis. Os runners reutilizam executor/fixture real/preflight existentes; não conectam ao remoto nem iniciam o site com configuração de produção.

Nenhum deploy/merge/alteração do estado da PR. Alterações preexistentes de README.md e vite.config.ts preservadas e excluídas da entrega.
