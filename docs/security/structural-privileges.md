# WashSense — Etapa 2.7: privilégios estruturais atuais e futuros

Projeto: `eydrrfuzfcxcqdivvued`. Branch: `security/stage-2-3-structural-privileges`.
Esta preparação não executa SQL remoto, migration, deploy ou merge. Os arquivos
`.sql.pending` permanecem fora de `supabase/migrations` e NÃO estão aprovados
para produção. A Etapa 1 e o código da aplicação permanecem preservados.

## Evidências e limites

Segundo o inventário remoto informado pelo usuário, há 19 tabelas públicas,
todas do tipo `r`, de `postgres`, com RLS habilitada. Nas 19 tabelas, `anon` e
`authenticated` têm efetivamente TRUNCATE, TRIGGER, REFERENCES e MAINTAIN:
152 combinações positivas. Isso NÃO prova 152 grants diretos.

Nas etapas anteriores, foram informados 78 grants diretos dos três primeiros
privilégios nas 13 tabelas originais, FORCE RLS desabilitado nesse escopo,
ausência de ACLs por coluna no relatório e ausência de PUBLIC examinada.
Esses resultados não devem ser extrapolados para as seis tabelas adicionais.
A origem de MAINTAIN nas 19 tabelas também precisa de confirmação detalhada.

Não há conexão remota utilizada nesta etapa. Os resultados abaixo relativos
à execução são exclusivamente de PostgreSQL isolado com fixtures sintéticas.

## Lista explícita das 19 tabelas

| Grupo | Tabelas |
| --- | --- |
| Organização | organizations, organization_members, units |
| Recursos | machines, reservoirs, devices, sensors |
| Leituras | machine_readings, reservoir_readings |
| Financeiro | payments, subscriptions |
| Operação | alerts, maintenance |
| Acrescentadas na Etapa 2.7 | audit_logs, consumption_records, machine_cycles, plans, profiles, reservoir_refills |

Não usar `ALL TABLES IN SCHEMA` nem acrescentar objetos automaticamente. Uma
vigésima tabela não pertence à lista sem inventário e aprovação próprios.

## Arquivos e pré-validação

- `supabase/security/20261012_structural_privileges_preflight.sql`: somente
  leitura, com BEGIN READ ONLY/ROLLBACK; consulta apenas catálogos.
- `supabase/security/20261012_harden_structural_privileges.sql.pending`:
  revogação condicional dos quatro privilégios nas 19 tabelas.
- `supabase/security/20261012_structural_privileges_verify.sql`: asserções
  somente leitura pós-migração para as 152 combinações e REFERENCES por coluna.
- `supabase/security/20261012_harden_default_privileges.sql.pending`: proposta
  separada de defaults futuros dos criadores postgres e supabase_admin.
- `supabase/tests/structural_privileges/test_isolated.py`: runner Docker isolado.

O preflight lista existência, tipo, proprietário, RLS/FORCE RLS, ACLs de tabela
 e coluna, privilégios efetivos, roles/memberships, caminhos transitivos e
 default ACLs globais/public. Também mostra metadados de funções, EXECUTE,
 dependências catalogadas e vínculos de triggers, sem corpos de funções,
 senhas, tokens ou registros da aplicação.

A seção `grant_provenance` retorna 152 registros quando o escopo existe:

- `effective`: resultado de has_table_privilege;
- `expected_direct_grant`: existe grant direto por postgres, sem grant option;
- `unexpected_direct_grant`: existe grant direto de outro grantor ou com grant option;
- `direct_grants`: grantor e grant option das concessões diretas relevantes.

Antes de aprovação, todas as combinações precisam estar efetivas, com origem
 direta esperada e sem origem direta divergente. Isso não substitui a inspeção
 de PUBLIC/herança/callers. Ausência em pg_depend NÃO prova ausência de
 dependências: SQL textual/dinâmico, PL/pgSQL e serviços externos exigem análise.

## Rascunho das tabelas atuais

Propõe REVOKE TRUNCATE, TRIGGER, REFERENCES, MAINTAIN somente de anon e
 authenticated, nas 19 tabelas enumeradas, usando RESTRICT.

Pré-condições, verificadas em todo o escopo antes de qualquer revogação:

1. PostgreSQL 17; executor postgres; existência de service_role.
2. anon/authenticated existentes, sem superuser ou BYPASSRLS.
3. Tabelas comuns, proprietário postgres, RLS habilitada e FORCE RLS desabilitado.
   FORCE RLS das seis adicionais precisa ser confirmado; uma divergência aborta.
4. Cada um dos quatro direitos deve ser direto, concedido por postgres,
   sem grant option nem concessão direta adicional divergente.
5. Ausência de concessões estruturais a PUBLIC e de REFERENCES por coluna
   a PUBLIC/anon/authenticated. Esses casos requerem proposta específica.

Pós-condições: os 152 privilégios efetivos devem ser falsos, assim como
 REFERENCES por coluna para os dois papéis. Herança residual causa rollback.
 DML efetivo de todos os papéis, ACLs de coluna, direitos estruturais dos demais
 papéis, owner, RLS/FORCE RLS e políticas devem permanecer iguais.

Não altera SELECT/INSERT/UPDATE/DELETE, EXECUTE, funções, triggers, constraints,
 índices, service_role ou concessões administrativas legítimas. Não executa
 TRUNCATE de dados. Snapshot e verificações usam somente metadados; a
 preservação de registros é testada somente em fixtures sintéticas.

## Rascunho de default privileges — revisão mantida

Já contempla os mesmos quatro privilégios. Permanece separado, limitado a
 defaults de TABELAS em public criadas efetivamente por postgres/supabase_admin.
 Exige os 16 grants diretos esperados (2 criadores × 2 grantees × 4 direitos),
 sem grant option. Preserva DML, outros grantees, sequências e funções.
 Não altera ACLs de tabelas existentes.

Defaults por schema somam-se aos globais. O rascunho recusa grants estruturais
 globais relevantes a PUBLIC/anon/authenticated: um REVOKE em public não os
 neutralizaria. Defaults globais, outros criadores e schemas ficam pendentes
 de inventário e aprovação própria. Defaults não são herdados automaticamente
 de outro criador e não dependem apenas do proprietário final do objeto.

Não adiciona memberships, não assume acesso gerenciado a supabase_admin e não
 executa SET ROLE para obter privilégios. O executor deve ter autorização real
 para alterar esses defaults; erros nativos abortam a transação.

## Compatibilidade investigada e pendências

| Componente | Privilégios preservados | Verificação pendente no Supabase isolado |
| --- | --- | --- |
| PostgREST | DML e EXECUTE; impersonação e RLS inalteradas | Leituras e RPCs reais, incluindo profiles/plans e logs |
| Auth | Schemas auth, EXECUTE/USAGE e supabase_auth_admin inalterados | Hooks personalizados, criação de perfil e auditoria |
| Realtime | SELECT/RLS, schema realtime e publicação inalterados | Postgres Changes, Broadcast/Presence e papéis dos serviços |
| Edge Functions/Asaas | service_role, EXECUTE e código inalterados | Callers financeiros, cron e manutenção sem cobrança |
| Energia/IoT | DML, sequências e identidades de serviço inalterados | Ingestão, consumo, ciclos, reposições e jobs de manutenção |
| Administração | Ownership e direitos de outros papéis preservados | Jobs que porventura executem manutenção como anon/authenticated |

MAINTAIN permite VACUUM, ANALYZE, CLUSTER, REFRESH MATERIALIZED VIEW, REINDEX e
 LOCK TABLE. A revogação pode bloquear jobs legítimos que usem indevidamente
 papéis humanos para essas operações. Não há evidência de tal dependência no
 frontend; isso não certifica os serviços remotos. A necessidade deve ser
 avaliada por caller, sem reabrir os grants gerais automaticamente.

Fontes oficiais consultadas na revisão anterior:

- [Privilégios PostgreSQL 17](https://www.postgresql.org/docs/17/ddl-priv.html).
- [ALTER DEFAULT PRIVILEGES](https://www.postgresql.org/docs/17/sql-alterdefaultprivileges.html).
- [Bootstrap Supabase](https://github.com/supabase/postgres/blob/develop/migrations/db/init-scripts/00000000000000-initial-schema.sql).
- [PostgREST](https://docs.postgrest.org/en/stable/references/auth.html).
- [Auth Hooks](https://supabase.com/docs/guides/auth/auth-hooks).
- [Realtime](https://supabase.com/docs/guides/realtime/authorization).

O bootstrap ALL e um GRANT ALL posterior podem reintroduzir os direitos.
 Revalidar defaults/ACLs após upgrades e novas migrações. Defaults DML
 preservados não garantem RLS para tabelas futuras: habilitar/configurar RLS
 antes da exposição de novos dados privados.

## Testes isolados e execução segura

Requisitos: Docker e Python 3. Na raiz do repositório:

```bash
python3 supabase/tests/structural_privileges/test_isolated.py
```

O runner fixa a imagem PostgreSQL 17 pelo digest
`sha256:2d2b8998d31037bf721cfdf764d76ba74171b4fab3431b7f72c27c56ddbdf9e3`.
 Cria container único sem portas publicadas, com trust apenas internamente,
 sem conexão remota ou credenciais reais. Remove somente seu container/volume.

As fixtures representam 19 tabelas mínimas, duas organizações sintéticas e
 uma tabela fora do escopo. Não reproduzem o schema, hooks ou serviços reais.
 Cobrem 152 direitos atuais, origem direta, REFERENCES por coluna, preservação
 de dados/grants/DML/RLS/funções/triggers/constraints e leituras autorizadas de
 organizações, assinaturas e pagamentos. Incluem recusa de repetição e testes
 de PUBLIC, origem diferente, grant option, herança, tabela ausente e FORCE RLS
 divergente, inclusive nas seis tabelas adicionadas.

O rascunho dos defaults é testado com tabelas futuras criadas por ambos os
 criadores: 16 direitos ausentes, DML/EXECUTE/sequências/service_role preservados,
 outro schema intacto e rollback para grants globais, grant option ou defaults
 faltantes. Nenhum teste representa autorização para produção.

Nesta revisão, os testes foram executados em PostgreSQL 17.11: 152 direitos
atuais e 16 futuros verificados, 16 cenários de recusa/rollback da proposta
atual e três dos defaults aprovados, além de recusa de repetição. FK/trigger
existentes continuaram funcionando para service_role. O build MPA produziu
as mesmas oito páginas e os mesmos 25 arquivos públicos. Não foram executados
testes remotos; o PostgreSQL 17.6 informado e a stack Supabase exigem validação própria.

## Rollback e aprovação

Ambos os rascunhos são transacionais, usam RESTRICT, lock_timeout=5s e
 statement_timeout=30s. Usar runner que pare no primeiro erro, como psql
 `-X -v ON_ERROR_STOP=1`. Não executar partes soltas. Repetição é recusada.

Antes de COMMIT, falhas causam rollback integral. Depois de COMMIT, não há
 restauração automática dos privilégios inseguros. Identificar o caller e
 preparar correção específica aprovada, preferindo identidade de serviço
 limitada. Uma exceção/restauração exige baseline e aprovação explícita.

As duas propostas são independentes: aplicar defaults não revoga grants
 existentes; falhar na segunda não reverte a primeira já concluída. Ordem
 proposta: inventário completo → testes Supabase isolados → defaults futuros
 → tabelas atuais → comparação de ACLs e regressão dos serviços.

Checklist obrigatório:

- [ ] Resultado detalhado das 152 origens diretas revisado; grant options ausentes.
- [ ] FORCE RLS das seis adicionais, PUBLIC e grants de coluna confirmados.
- [ ] Herança transitiva, papéis alcançáveis e impacto sobre outros papéis revisados.
- [ ] Defaults globais, criadores e autorização gerenciada confirmados.
- [ ] Baseline DML/EXECUTE/service_role e permissões administrativas registrado.
- [ ] Callers de MAINTAIN/TRUNCATE/TRIGGER/REFERENCES inventariados.
- [ ] Testes com schema real, Auth/Realtime/API/financeiro/IoT em ambiente isolado aprovados.
- [ ] Janela, timeouts, monitoramento e recuperação aprovados.
- [ ] Autorização explícita antes de mover qualquer rascunho para migrations.
