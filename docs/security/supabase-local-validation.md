# Etapas 3.17–3.18 — procedimento de validação Supabase isolado

Preparação pendente de aprovação. Não executar os passos de instalação da proposta
nesta tarefa. Nenhum projeto Supabase remoto deve ser vinculado. O roteiro não
usa credenciais, usuários, dumps de dados, webhooks ou pagamentos de produção.
Os testes PostgreSQL anteriores são complementares, não substituem este roteiro.

## Preparação Windows/PowerShell — Etapa 3.18

Usar [o roteiro Windows e seus gates](supabase-lab-windows.md) e os scripts em
`tools/supabase-lab`. Manifesto independente com pins/aprovações pendentes;
nenhum script inicia stack ou importa SQL. Os comandos Unix abaixo são referência
histórica para etapa futura, não instrução para iniciar o ambiente na Etapa 3.18.

## Pré-condições e limites atuais

O checkout não contém supabase/config.toml, schema completo versionado ou inventário
completo de ACLs/policies/corpos de funções. Supabase CLI não está instalada neste
ambiente; Docker está disponível. Nenhum stack Supabase local foi iniciado.
Essas lacunas impedem afirmar que um teste fiel esteja pronto para execução.

Antes de executar, aprovar um pacote sanitizado, **somente estrutura**, contendo
DDL das 19 tabelas, enums, constraints, índices, grants de tabela/coluna/schema,
políticas e funções necessárias com owners/search_path/EXECUTE/defaults. Incluir
vínculos profiles/auth.users, sem registros, URLs de produção, chaves, senhas ou
segredos embutidos em funções. Registrar hash e origem do pacote. Não usar dump
completo nem importar linhas de organization_members/clientes. A confirmação de
66 triggers internos não exige recriá-los manualmente: serão gerados pelas FKs.

Homologar e fixar versão do CLI e digests das imagens, incluindo PostgreSQL 17;
registrar `supabase --version`, `docker --version` e `SHOW server_version` no
manifesto de execução. O teste anterior usou 17.11; isso não garante equivalência
com o remoto 17.6. Registrar configurações Auth, schemas expostos, Realtime,
extensões e roles divergentes. Sem esses pins e o pacote estrutural, a
reprodutibilidade é um procedimento preparado, ainda não demonstrado.

## Criar o laboratório (execução futura autorizada)

Usar máquina descartável com Docker, sem credenciais de produção, CLI homologada
já instalada e diretório temporário fora do checkout. Não copiar .env, arquivos
financeiros ou arquivos internos da aplicação. Nunca usar `supabase link`,
`db push`, `db pull`, deploy ou parâmetros --linked/URLs remotas neste roteiro.

```bash
umask 077
LAB_DIR=$(mktemp -d /tmp/washsense-supabase-local.XXXXXX)
cd "$LAB_DIR"
supabase init
supabase --version > cli-version.txt
docker --version > docker-version.txt
```

Revisar o config.toml gerado: project_id exclusivo, db.major_version=17, Auth
email/senha com confirmação local habilitada, recuperação/redirecionamento
apenas loopback, SMTP local capturado pelo serviço de email do stack. Desabilitar
provedores externos, hooks HTTP e funções automáticas. Não servir as Edge
Functions do repositório (a sincronização ANEEL faz fetch externo).

Aplicar política de rede do laboratório: APIs acessíveis apenas via loopback e
bloquear saída dos containers para serviços externos; manter comunicação interna
Docker. Validar com tentativa controlada de conexão externa negada e email
entregue apenas à caixa local. Docker pode publicar portas em todas as interfaces:
verificar bindings efetivos após start e bloquear por firewall se necessário;
configurar bind compatível com a versão homologada. Não assumir que localhost
na URL protege a porta. Instalação/download de imagens deve ocorrer antes do
bloqueio de saída.

```bash
supabase start
supabase status --output json > local-status.json
chmod 600 local-status.json
```

Não exibir local-status.json: pode conter chaves locais. O runner deve ler o
arquivo sem logging, aceitar apenas host 127.0.0.1/localhost/[::1], portas do
laboratório e project_id esperado. Recusar project ref remoto, URLs externas ou
variáveis SUPABASE_* herdadas. Psql, HTTP e runner usam somente bindings locais
verificados. As chaves locais são geradas pelo stack, nunca solicitadas no chat.

Importar o pacote estrutural aprovado com psql local, ON_ERROR_STOP e transação,
sem runner de migrations. Validar o destino antes da conexão. Este procedimento
**não fornece nem executa** o pacote ausente. Não substituir os helpers por
fixtures permissivas para afirmar equivalência ao ambiente real.

## Fixtures e canais de execução

Criar Auth users sintéticos pela Admin API local `/auth/v1/admin/users`, usando
apenas service key local. Criar duas organizações A/B, pelo menos duas unidades
por organização, dispositivos/máquinas/reservatórios em cada unidade; sensores
e manutenções com e sem associações opcionais. Preencher somente campos
obrigatórios reais identificados no pacote. Usar IDs e emails sintéticos
`admin-a@example.test`, `manager-a@example.test`, `technician-a@example.test`,
`operator-a@example.test`, equivalentes B, admin A/B e technician A/operator B.
Senhas efêmeras geradas no runner; não incluí-las em logs ou commits.

Permitir confirmação manual local da primeira fixture; criar outra sem
confirmação para testar o fluxo de confirmação. Criar memberships por conexão
administrativa local, nunca pelo papel cliente durante bootstrap. Não inserir
dados diretamente em auth.users como substituto da API Auth.

Separar três canais:

1. HTTP Auth/PostgREST com access token emitido por login real local; apikey anon
   local e Authorization do usuário. Não simular Auth somente com GUC.
2. SQL local com SET LOCAL ROLE e claims da versão instalada, em transação,
   para isolar GRANT, RLS e integridade; essas claims simuladas não validam JWT.
3. HTTP/SQL service_role local sem identidade de usuário, para bypass e guards.

O runner não deve registrar tokens, senhas, chaves ou respostas inteiras. Registrar
apenas ID do caso, status HTTP/SQLSTATE, contagem sanitizada, duração e resultado.
Nenhum caso pode depender do projeto eydrrfuzfcxcqdivvued, de clientes existentes,
de chaves privadas remotas ou da disponibilidade de Asaas/ANEEL.

## Baseline, proposta e recuperação (somente laboratório)

Executar o preflight de leitura local e capturar baseline completa das políticas,
ACLs, funções, constraints e triggers. Confirmar schema/nullability/CASCADE,
owners/RLS, defaults e a origem das permissões. Comparar a cópia estrutural com
metadados aprovados; diferenças são bloqueios, não motivo para conceder DML.

Na conexão SQL local, uma checagem de EXECUTE/TEMP (somente metadados) pode usar:

```sql
BEGIN READ ONLY;
SELECT p.oid::regprocedure AS signature, p.proowner::regrole AS owner,
       p.prosecdef, p.proconfig, p.proacl, r.rolname,
       has_function_privilege(r.oid,p.oid,'EXECUTE') AS effective_execute
FROM pg_proc p CROSS JOIN pg_roles r
WHERE p.pronamespace='public'::regnamespace
  AND p.proname IN ('has_device_access','has_machine_access',
    'has_reservoir_access','has_unit_access','has_org_role')
  AND r.rolname IN ('anon','authenticated','service_role');
SELECT rolname, has_database_privilege(oid,current_database(),'TEMP') AS temporary
FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role');
ROLLBACK;
```

Essas consultas não substituem a inspeção de memberships, defaults e corpos
completos. No cenário adversarial SQL local, criar objeto temporário homônimo
somente se o papel possuir TEMP, invocar helper e verificar resolução e ausência
de elevação. Registrar separadamente se esse caminho não existe na API HTTP.

Após autorização própria para o laboratório, executar o .sql.pending diretamente
com executor postgres local, ON_ERROR_STOP, contrato revisado e JSON exato da
baseline nos GUCs documentados no relatório. Manter o arquivo fora de migrations.
Não executar rascunhos dos 152 privilégios como dependência desta suíte.

Na baseline e na proposta usar o mesmo manifesto de versões, fixtures e carga.
Separar a matriz de grants reais (que pode negar DML antes de RLS) de uma fixture
SQL adicional explicitamente identificada para exercitar políticas sem grant
correspondente. Nunca adicionar grants ao cenário fiel para fazê-lo passar.

Ensaiar falha antes de COMMIT (schema/baseline divergentes, locks indisponíveis,
dados incoerentes): snapshot posterior deve coincidir com baseline inteira.
Para rollback pós-COMMIT, preparar e revisar script local .sql.pending que
restaure exatamente as quatro políticas da baseline e remova apenas os seis
novos triggers/cinco helpers, sem CASCADE, após verificar dependências. Script
não está disponível nesta etapa: é pendência antes de ensaiar reversão cirúrgica.
Também ensaiar recuperação por recriação do laboratório a partir do pacote
estrutural + fixtures, sem copiar dados reais. Nunca fazer rollback amplo de
produção nem restaurar políticas vulneráveis automaticamente.

## Matriz e critérios de aceitação

| Área | Procedimento | Resultado esperado / evidência |
|---|---|---|
| Auth | signup, confirmação por email local, login válido/inválido, refresh, logout/revogação e recuperação de senha | Novo login após recuperação; refresh antigo revogado conforme configuração; registrar TTL. Access JWT já emitido pode continuar válido até expirar, não assumir revogação imediata |
| Sessão | Token ausente, inválido e expirado nas APIs; usuário sem membership | Sem dados alheios. Guardas de páginas/logout na aplicação não são corrigidos nem validados por teste da API |
| RLS | A/B × quatro papéis, máquina UPDATE admin/manager, manutenção UPDATE e sensor INSERT/UPDATE admin/manager/technician | Matriz aprovada respeitada quando há DML; UPDATE negado pode retornar zero linhas, não exigir sempre HTTP 403 |
| Grants | has_table/column/function_privilege e tentativas SQL sob cada papel | Ausência de GRANT bloqueia antes de RLS; sem CREATE public; EXECUTE privado negado; grants antigos preservados |
| RPC/helpers | auth.uid() válido/ausente, memberships duplos, role correto/errado; chamadas HTTP de RPC apenas se expostas | Nenhuma escrita/elevação indevida; comportamento de helper falso distinto de erro de EXECUTE |
| Integridade sensor | INSERT/UPDATE com device obrigatório, ambos opcionais juntos, vínculos multiunidade A, inexistentes/misturados A/B | Mesma organização aceita; outros casos rejeitados e transação sem alterações parciais |
| Integridade manutenção | INSERT/UPDATE usando unit obrigatória, device/machine opcionais em outras unidades A | Válidos aceitos conforme autorização/grants; vínculos B rejeitados, inclusive via service_role |
| Pais | UPDATE de units.organization_id e unit_id dos três pais, com/sem filhos; movimentos A1→A2 | Troca de tenant rejeitada inclusive service_role; mesma organização permitida; registrar restrição administrativa pendente |
| Triggers | Catalogar internos antes/depois, seis guards novos, FK/CASCADE; BEFORE sintético que altera campo fora do SET | Internos intactos; guards habilitados; transformação indevida rejeitada. BEFORE adversarial só em cenário de teste separado |
| Concorrência | Duas conexões com barreiras explícitas, criação/edição do filho versus troca de unidade/tenant, exclusão CASCADE, ordem invertida, lote | Sem vínculos cruzados após commits; falhas/aborts permitidos sem perda parcial; repetir READ COMMITTED, REPEATABLE READ e SERIALIZABLE |
| service_role | CRUD autorizado local sem auth.uid(), associações coerentes e inválidas; tarefas simuladas de ingestão | Bypass RLS preservado, integridade aplicada; nenhum pedido financeiro real |
| Realtime | Subscription autenticada A/B, escrita válida/negada e transferência bloqueada | Sem eventos/dados indevidos conforme publication/RLS reais; configurar só o que consta do pacote aprovado |
| Recuperação | Falha pré-COMMIT, reversão revisada pós-COMMIT e laboratório recriado | Baselines de ACLs, políticas, funções e constraints restauradas conforme plano; dependências não apagadas |
| Desempenho | Cargas determinísticas crescentes com fixtures, EXPLAIN (ANALYZE, BUFFERS) local, latência p50/p95/p99, throughput, locks/deadlocks e tempo da validação inicial | Comparação baseline/proposta com mesmas condições; orçamento acordado antes do teste, sem inventar SLO |

Para concorrência usar barreiras/eventos e observar pg_locks/pg_stat_activity para
confirmar sobreposição; sleep isolado não comprova ordem. Registrar seeds,
iterações e estados finais. Um deadlock pode causar abort esperado; nunca
classificar perda parcial ou associação inválida como sucesso de retry.

Medir particularmente manutenção por device/machine, exclusões CASCADE e
validação inicial sob writers. A ausência dos dois índices não autoriza criá-los
agora. O volume remoto atual é pequeno e não representa crescimento SaaS.

Edge Functions financeiras, providers externos, OAuth, SMTP real, ANEEL e IoT
hardware não são equivalentes no stack local. Usar stub local de ingestão e
financeiro que registre zero chamadas externas; não afirmar compatibilidade
com código financeiro remoto não versionado. Configurações gerenciadas, secrets,
workers e comportamento de produção podem diferir do stack Docker.

## Encerramento e evidências

Salvar relatório sem segredos, manifesto de versões/digests, hashes do pacote,
baselines sanitizadas, resultados por caso e medições. Não versionar
local-status.json, tokens, dump de linhas ou credenciais locais. Descartar o
laboratório com `supabase stop --no-backup` apenas após confirmar diretório e
project_id; remover só arquivos/containers/volumes desta execução. Não atingir
outros stacks Docker.

Uma aprovação da proposta exige resolver lacunas de metadata e resultados do
stack isolado; PostgreSQL sintético e integridade remota vazia não bastam.
