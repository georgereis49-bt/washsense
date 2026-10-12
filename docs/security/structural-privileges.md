# WashSense: primeira restrição de privilégios estruturais

Projeto de referência: `eydrrfuzfcxcqdivvued`. Nenhum comando desta preparação
foi executado no Supabase remoto. A Etapa 1 e o código da aplicação permanecem
preservados.

## Situação: rascunho pendente de inventário remoto e aprovação

O usuário confirmou PostgreSQL 17, proprietário `postgres`, RLS habilitada,
FORCE RLS desabilitado e privilégios efetivos TRUNCATE, TRIGGER e REFERENCES
para `anon` e `authenticated`. Não foi fornecida a origem completa das ACLs,
grants por coluna, grant options ou herança. Privilégio efetivo não comprova
que a API permita executar a operação.

Por isso, **não há migração executável em `supabase/migrations/`**. O arquivo
`supabase/security/20261012_harden_structural_privileges.sql.pending` é um
rascunho para revisão, não uma migração aprovada para o ambiente remoto.
O sufixo e a localização evitam sua inclusão automática em `supabase db push`.
Não o renomeie/mova nem execute em produção antes da revisão.

## Problema e escopo

RLS não filtra TRUNCATE. TRIGGER e REFERENCES são privilégios estruturais
sem necessidade identificada nos fluxos do navegador. Esta proposta revoga
somente esses três privilégios de tabela de `anon` e `authenticated`.

Lista explícita baseada nos nomes informados nas etapas anteriores:

- organizations, organization_members, units;
- machines, reservoirs, devices, sensors;
- machine_readings, reservoir_readings;
- payments, subscriptions, alerts, maintenance.

Cada nome precisa ser reconfirmado pelo preflight. Não são incluídas outras
tabelas por padrão, inclusive tarifas de energia. A proposta não amplia
SELECT/INSERT/UPDATE/DELETE, não corrige RLS e não altera default privileges.

## Pré-validação somente leitura

No SQL Editor autorizado, execute exclusivamente o conteúdo de
`supabase/security/20261012_structural_privileges_preflight.sql`. Ele usa
BEGIN READ ONLY/ROLLBACK e retorna somente metadados: servidor, existência,
tipo/proprietário/RLS das tabelas, privilégios efetivos, ACLs de tabela e coluna,
papéis, herança e default ACLs. Não consulta linhas da aplicação, senhas,
tokens, corpos de funções ou configurações secretas.

Além do relatório, inspecione por metadados os callers RPC/DDL e dependências
de grants. Não invoque funções que possam produzir efeitos. Confirme que
nenhum serviço legítimo usa os papéis humanos para operações estruturais.
Não envie credenciais privadas no chat.

## Pré-condições e recusa segura

O rascunho exige:

1. PostgreSQL 17 e executor `postgres`.
2. Existência de `anon`, `authenticated` e `service_role`; os dois primeiros
   não podem ser superusuários nem ter BYPASSRLS.
3. As 13 relações devem ser tabelas comuns, de `postgres`, com RLS habilitada
   e FORCE RLS desabilitado, conforme a evidência fornecida. Partições ou
   relações diferentes precisam de revisão separada.
4. Os três grants devem ser diretos, concedidos por `postgres`, sem grant
   option. **Isso ainda não foi confirmado no remoto.**
5. Não pode existir grant estrutural de tabela a PUBLIC, nem REFERENCES por
   coluna a PUBLIC/anon/authenticated. Esses casos precisam de escopo próprio.
6. Ao final, todos os privilégios estruturais efetivos desses dois papéis,
   inclusive REFERENCES por coluna, devem ser falsos. Herança ou grants
   adicionais que mantenham acesso causam erro e rollback integral.
7. DML efetivo de todos os papéis, ACLs de coluna, privilégios estruturais de
   outros papéis, propriedade, estado de RLS e políticas devem permanecer iguais.

Todas as pré-condições de tabelas são verificadas antes dos REVOKEs.
RESTRICT evita revogações em cascata. O bloco é transacional, com timeouts de
lock (5 segundos) e comando (30 segundos). Não é idempotente: repetir uma
execução concluída gera recusa em vez de ocultar divergências.

Não altera service_role/postgres, EXECUTE, funções, triggers, constraints,
índices, estrutura, autenticação, Asaas, ANEEL ou código IoT. Não contém
TRUNCATE de dados. O rascunho lê apenas catálogos; a preservação de dados é
testada exclusivamente em fixtures sintéticas.

## Testes em ambiente isolado

Requisitos: Docker acessível, Python 3 e acesso à imagem oficial PostgreSQL 17.
Na raiz do repositório:

```bash
python3 supabase/tests/structural_privileges/test_isolated.py
```

O runner cria um container com nome único, sem portas publicadas, sem conexão
remota e sem credenciais reais. Autenticação trust é usada somente dentro
desse container descartável. Ele remove apenas seu próprio container e volume.

As fixtures são mínimas, com 13 tabelas e organizações A/B sintéticas. Não
representam o schema completo do Supabase e não simulam as RPCs financeiras,
os helpers reais ou ingestão IoT. Elas permitem verificar:

- ausência dos 78 privilégios efetivos de tabela (13 × 2 × 3);
- ausência de REFERENCES por coluna;
- RLS, políticas, grants DML/coluna e grants de outros papéis preservados;
- função e EXECUTE, constraints e triggers preservados;
- registros sintéticos intactos e leitura autorizada de organizations,
  subscriptions e payments preservada para A;
- tabela fora da lista intacta;
- recusa por tabela ausente, RLS divergente, proprietário divergente,
  PUBLIC, REFERENCES de coluna, grant option e grant direto ausente;
- rollback se herança mantiver acesso ou a revogação afetar outro papel;
- recusa de repetição e preflight somente leitura.

O runner fixa a imagem oficial pelo digest
`sha256:2d2b8998d31037bf721cfdf764d76ba74171b4fab3431b7f72c27c56ddbdf9e3`.
Os testes foram executados localmente em PostgreSQL 17.11: cenário positivo,
recusa de repetição e nove cenários de divergência/rollback passaram. Nenhum
teste foi executado no Supabase remoto. Testes com o schema real, API, Asaas e
ingestão continuam pendentes.

`supabase/security/20261012_structural_privileges_verify.sql` contém asserções
somente leitura pós-migração. Elas não substituem a comparação com o baseline
de grants e não testam leitura de dados reais. Antes de aprovar produção,
repita os testes em Supabase isolado com o schema real e dados sintéticos,
incluindo as leituras via API com identidades sintéticas e os serviços.

## Recuperação e compatibilidade

Falhas anteriores ao COMMIT devem resultar em rollback integral. Execute com
um runner que interrompa no primeiro erro; a configuração psql equivalente é
`-X -v ON_ERROR_STOP=1`. Não execute trechos isolados ou ignore erros.

Após COMMIT, não existe restauração automática dos grants inseguros. Em caso
de incompatibilidade, identifique o caller e prepare uma correção específica
aprovada, preferindo um papel de serviço limitado. Restaurar grants exige
decisão explícita, baseline revisado e nova análise de risco.

A revogação pode invalidar operações estruturais legítimas não inventariadas;
SQL concorrente pode causar timeout. Grants herdados podem causar recusa. Novas
tabelas ainda podem receber grants amplos via default ACLs: isso fica para uma
etapa separada. Riscos nas políticas e helpers continuam pendentes.

## Checklist antes de produção

- [ ] Preflight remoto revisado e lista das 13 tabelas reconfirmada.
- [ ] Origem dos grants, PUBLIC, herança e grants de coluna documentados.
- [ ] Dependências/callers de operações estruturais e grant options revisados.
- [ ] Baseline de DML, EXECUTE e permissões administrativas registrado.
- [ ] Testes com schema Supabase real e dados sintéticos aprovados.
- [ ] Compatibilidade das leituras financeiras e ingestão verificada sem cobranças.
- [ ] Janela, timeouts, monitoramento e procedimento de falha aprovados.
- [ ] Migração revisada e autorizada explicitamente antes de movê-la para migrations.
- [ ] Verificação pós-migração e comparação de baseline planejadas.

Salvar estes arquivos não autoriza execução remota ou deploy.
