# Testes integrados de segurança — resultados executados

Base: 25e44583d2787ef09ae7ac2d740491da0e1d74f0, branch de segurança.
Execução em 12/10/2026; PostgreSQL **17.11 (Debian 17.11-1.pgdg13+2)**,
Docker cliente/server 28.4.0, Linux Codex. Ambas as suítes finais encerraram com exit 0.

## Evidência e isolamento

S = [stdout da suíte estrutural](evidence/integrated-postgres17-structural.txt).
R = [stdout da suíte integrada RLS](evidence/integrated-postgres17-rls.txt).
São logs reais da execução final, sem dados de clientes ou credenciais.

Docker socket local validado antes do daemon e explícito em todas as chamadas.
Imagem em cache fixada:
`postgres:17@sha256:2d2b8998d31037bf721cfdf764d76ba74171b4fab3431b7f72c27c56ddbdf9e3`.
Containers únicos, --pull=never, --network=none, sem portas publicadas; configuração
confirmada por docker inspect ANTES do SQL. Psql por docker exec, sem URL remota.
Clusters/volumes de cada suíte descartados por finally. Trust exclusivamente
no cluster sintético isolado; nenhum token/senha real usado. Não houve Asaas,
ANEEL, cliente real, Auth externo, acesso à produção, deploy ou merge.

Três .sql.pending revisados foram executados só em testes: privilégios de tabelas,
default privileges e autorização/integridade RLS. Na suíte RLS, os três foram
aplicados no MESMO banco com 19 tabelas, após os contratos/preconditions locais.
GUC de contrato aprovado foi setado exclusivamente na conexão sintética exigida
pelo rascunho, sem modificar o manifesto/flags de aprovação do laboratório.
Não executar esses comandos em projeto remoto.

## Matriz de execução PostgreSQL puro

| Cenário | Resultado | Evidência real |
|---|---|---|
| Isolamento/nenhuma porta/nenhuma rede/pin em cache | PASS | S/R: inspeção de network e PortBindings |
| 19 tabelas × 2 papéis × 4 direitos estruturais (152) | PASS | S: grants efetivos ausentes e verify aprovado |
| TRUNCATE executado como anon/authenticated | PASS | S: ambos permission denied; dados preservados |
| CREATE TRIGGER executado como anon/authenticated | PASS | S: ambos permission denied |
| CREATE FK/REFERENCES com schema de teste próprio | PASS | S: ambos permission denied sobre tabela alvo |
| MAINTAIN/ANALYZE como anon/authenticated | PASS | S: ambos ignorados com warning permission denied; não interpretar exit 0 como autorização |
| Default privileges dos dois criadores / 16 combinações futuras | PASS | S: quatro direitos ausentes; DML/sequence/EXECUTE/service e outro schema preservados |
| Grants de coluna, funções, constraints, triggers, RLS e dados | PASS | S/R: snapshots/asserts e leituras autorizadas preservados |
| Três propostas no mesmo banco | PASS | R: structural + defaults aplicados antes de RLS; verify estrutural repetido após operações |
| Duas organizações, duas unidades cada, quatro papéis em cada | PASS | R: fixtures UUID e matriz admin/manager/technician/operator |
| Máquina UPDATE admin/manager; technician/operator negados | PASS | R: rowcount 1/0 esperado por papel A/B |
| Manutenção UPDATE e sensor INSERT/UPDATE técnico autorizado | PASS | R: permitidos para admin/manager/technician; operator negado |
| Acesso/alterações fora da organização, memberships duplos | PASS | R: leitura/UPDATE foreign 0; mistura e transferência rejeitadas |
| USING/WITH CHECK, acesso a cada vínculo, ausência de DML GRANT | PASS | R: destino sem papel rejeitado, unidade bloqueada rejeitada, grants removidos dão permission denied |
| Máquina/device/reservatório/maintenance mudando unidade no mesmo tenant | PASS | R: UPDATE RETURNING 1, inclusive service_role |
| Sensor e manutenção multiunidade, vínculos opcionais simultâneos | PASS | R: INSERT/UPDATE coerentes aceitos |
| Vínculos entre organizações, inexistentes, device obrigatório | PASS | R: RLS/trigger/FK rejeitam os casos; nenhum estado parcial |
| Transferência cross-tenant por admin A/B | PASS | R: máquinas/sensores/manutenções rejeitados |
| Cross-tenant via service_role, bypass RLS | PASS | R: máquinas/devices/reservatórios/units/sensores/manutenções rejeitados pelos guards |
| UPDATE de unit.organization_id e BEFORE alterando campo fora do SET | PASS | R: guards AFTER rejeitam transferência |
| FK e ON DELETE CASCADE | PASS | S: FK/trigger legítimos; R: DELETE device remove sensor ligado; ROLLBACK restaura |
| Concorrência READ COMMITTED/REPEATABLE READ/SERIALIZABLE | PASS | R: threads de criação/transferência; apenas tentativas válidas passam |
| Contenção concorrente efetiva, após liberação | PASS | R: pg_stat_activity confirmou holder PgSleep e waiter Lock; service_role foreign UPDATE negado após desbloqueio |
| Rollback de operações e falhas pré-COMMIT | PASS | S/R: dados/metadados restaurados; 26 recusas abaixo |
| Recusa de repetição, tabela fora do escopo | PASS | S: repeat draft recusado; unlisted_table intacta |

## Recusas/rollback de pré-condições — individualizados

PASS significa que o rascunho recusou o cenário inválido e o rollback esperado foi
verificado. Não significa que a configuração inválida tenha sido aceita.

| Cenário sintético | Resultado | Evidência |
|---|---|---|
| Grants — missing | PASS | S: refusal/rollback correspondente |
| Grants — rls | PASS | S: refusal/rollback correspondente |
| Grants — owner | PASS | S: refusal/rollback correspondente |
| Grants — public_grant | PASS | S: refusal/rollback correspondente |
| Grants — column_reference | PASS | S: refusal/rollback correspondente |
| Grants — grant_option | PASS | S: refusal/rollback correspondente |
| Grants — missing_direct | PASS | S: refusal/rollback correspondente |
| Grants — inherited | PASS | S: refusal/rollback correspondente |
| Grants — other_role | PASS | S: refusal/rollback correspondente |
| Grants — new_table_option | PASS | S: refusal/rollback correspondente |
| Grants — new_table_inherited | PASS | S: refusal/rollback correspondente |
| Grants — new_table_public | PASS | S: refusal/rollback correspondente |
| Grants — new_table_force | PASS | S: refusal/rollback correspondente |
| Grants — new_table_missing | PASS | S: refusal/rollback correspondente |
| Grants — maintain_inherited | PASS | S: refusal/rollback correspondente |
| Grants — new_table_grantor | PASS | S: refusal/rollback correspondente |
| Defaults — global_defaults | PASS | S: refusal/rollback correspondente |
| Defaults — missing_defaults | PASS | S: refusal/rollback correspondente |
| Defaults — default_option | PASS | S: refusal/rollback correspondente |
| RLS — extra | PASS | R: refusal/rollback correspondente |
| RLS — shape | PASS | R: refusal/rollback correspondente |
| RLS — nullable | PASS | R: refusal/rollback correspondente |
| RLS — badfk | PASS | R: refusal/rollback correspondente |
| RLS — dirty | PASS | R: refusal/rollback correspondente |
| RLS — drift | PASS | R: refusal/rollback correspondente |
| RLS — unapproved | PASS | R: refusal/rollback correspondente |

## Falha comprovada e correção

A primeira tentativa RLS falhou antes da fixture: pg_isready via socket podia
aceitar o servidor temporário do entrypoint, encerrado antes da primeira consulta.
A conexão subsequente retornou No such file or directory no socket. Corrigido
para pg_isready -h 127.0.0.1, que aguarda o servidor final (bootstrap não escuta TCP).
Ambas as suítes foram reexecutadas e passaram. Não houve falha comprovada nos SQLs
propostos; eles permanecem inalterados. Os testes também passaram a garantir
socket Docker local, rede none/sem portas e ausência de pull implícito.

## Limites e cenários não executados

| Cenário | Resultado | Bloqueio / menor ação necessária |
|---|---|---|
| Supabase completo: Auth real, login/JWT, PostgREST/RPC | BLOCKED | CLI/config local não disponíveis; não foi criado stack. Instalar/homologar CLI e configuração isolada, usar fixtures aprovadas sem link remoto |
| Realtime, Storage, Edge Functions/financeiro/ingestão reais | BLOCKED | Não há stack nem dependências remotas completas versionadas; disponibilizar estrutura revisada e stubs locais sem efeitos externos |
| Equivalência com schema/ACLs/helpers reais das 19 tabelas | BLOCKED | Pacote estrutural sanitizado completo ausente; fornecer somente DDL/metadados revisados, nunca linhas/tokens |
| Reversão cirúrgica após COMMIT de toda a proposta | BLOCKED | Não há SQL inverso revisado; não confundir com rollback transacional efetivamente testado |

Foram realmente executados testes PostgreSQL puro com auth.uid() simulado via
GUC e roles SQL, NÃO Auth Supabase. Nenhum teste Supabase completo foi executado.
A fixture estrutural usa tabelas mínimas com org textual para validar ACLs; a RLS
usa UUID/FKs/CASCADE dos vínculos confirmados, duas organizações/quatro unidades e
11 tabelas mínimas adicionais para completar o escopo de grants. Não é cópia do
schema remoto completo nem prova de exploração da configuração de produção.
DML grants são explícitos nas fixtures para testar políticas; não são concedidos
pelo rascunho nem afirmação dos privilégios atuais do projeto remoto.

Testes de concorrência por threads cobrem interleavings limitados. O novo caso
com barreira observada em pg_stat_activity prova contenção real sobre device;
não é prova exaustiva de todos os schedulings ou desempenho de produção.

Reprodução autorizada só em Docker local Linux, com a imagem pinada já em cache:

```bash
python3 -u supabase/tests/structural_privileges/test_isolated.py
python3 -u supabase/tests/rls/test_isolated.py
```

Publicação contém somente correções do harness/isolamento e cobertura integrada,
este relatório e logs. Aplicação, SQLs pendentes e manifesto preservados.
Rascunhos Windows em andamento ficaram fora desta entrega. Estado da PR não
alterado; sem merge/ready-for-review. A consulta de leitura à API GitHub voltou a retornar Forbidden (GraphQL),
impedindo confirmar Draft remotamente; nenhum estado da PR foi alterado.
