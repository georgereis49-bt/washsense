# Etapa 3.17 — auditoria consolidada e preparação Supabase local

**Pendente de aprovação.** Nenhum SQL remoto, migration, deploy ou merge foi
executado. Os rascunhos dos 152 privilégios permanecem intocados. Esta revisão
altera apenas documentação; SQL, preflight e testes anteriores não foram alterados.
Base desta revisão: fb784c656f4fdc3f52d0ee04a801e72059f52497.

## Evidências e diferenças em relação à Etapa 3.6

Schema confirmado pelo usuário: UUIDs; units.organization_id obrigatório e FK
para organizations; devices/machines/reservoirs.unit_id obrigatórios; device_id
obrigatório em sensors; reservoir_id/machine_id opcionais e simultaneamente
permitidos; maintenance.unit_id obrigatório e device_id/machine_id opcionais.
As dez FKs descritas têm ON DELETE CASCADE. Não há XOR nem nova cardinalidade.
A confirmação foi fornecida pelo usuário, não inspecionada remotamente nesta tarefa.

A regra aprovada admite unidades diferentes na mesma organização. A proposta:

- mantém device_id obrigatório e verifica cada associação preenchida;
- valida INSERT/UPDATE de manutenção pelo tenant de maintenance.unit_id;
- compara organizações OLD/NEW, inclusive para usuários membros de dois tenants;
- protege units.organization_id e unit_id dos três recursos-pai;
- recusa schema com nullability/FKs divergentes, associações preexistentes
  incoerentes, baseline de políticas alterada ou políticas permissivas adicionais;
- usa guards AFTER em todo UPDATE dos pais, que observam NEW final após
  outros triggers BEFORE, mesmo quando o campo protegido não consta do SET;
- substitui a lacuna conhecida dos pais por uma proposta conservadora de
  imutabilidade da organização, ainda sujeita a aprovação operacional.

## Evidências remotas consolidadas nesta etapa

Fonte: resultados remotos informados pelo usuário em 12/10/2026. Não houve
consulta remota nesta tarefa; os resultados não são medições executadas pelo agente.

| Item | Confirmado | Interpretação e limite |
|---|---|---|
| Integridade | Zero registros inconsistentes em sensors e maintenance | Com ambas vazias, não valida integridade de futuras gravações nem concorrência |
| Triggers | 66 triggers internos PostgreSQL, habilitados, nas seis tabelas; nenhum personalizado | São objetos internos, não os seis guards propostos; preservá-los. Não prova ausência de rotinas externas |
| Índices | Relacionamentos principais indexados, exceto maintenance.device_id e maintenance.machine_id | Ausência pode afetar joins/CASCADE e locks em volume; medir antes de propor índices |
| Volume | 1 unidade, 3 reservatórios; devices, machines, sensors e maintenance vazias | Não há cenário remoto multiunidade nem amostra representativa para desempenho |
| Helpers | has_device_access, has_machine_access, has_reservoir_access e has_unit_access usam auth.uid() e organization_members; has_org_role verifica também papel | Membership não substitui autorização de ação; ACLs, ownership e corpos completos continuam importantes |
| Configuração dos helpers | Todos SECURITY DEFINER, search_path=public | Configuração confirmada, exploração não comprovada |
| Schema public | anon/authenticated/service_role têm USAGE, sem CREATE; postgres/supabase_admin têm USAGE e CREATE | Clientes não podem criar objetos em public diretamente. Verificar herança, outros schemas e RPCs privilegiadas |

## Riscos remanescentes de funções privilegiadas

SECURITY DEFINER executa com privilégios do proprietário: confirmar owner,
BYPASSRLS/FORCE RLS, assinatura exata, SQL dinâmico e semântica do corpo completo.
Não classificar o atributo isoladamente como vulnerabilidade explorável.

search_path=public não é prova de injeção. A ausência de CREATE dos três papéis
reduz o caminho de criação direta em public, mas não elimina criação indireta
por RPC privilegiada, herança ou efeitos de nomes não qualificados. Revisar
relações não qualificadas e pg_temp: o schema temporário pode preceder public
na resolução de relações/tipos quando não explicitamente posicionado; isso
exige capacidade de criar temporários e caminho de execução SQL, não se deve
presumir acesso via PostgREST. pg_catalog é pesquisado implicitamente antes
quando não explicitamente colocado. Revisar também overloads e funções chamadas.
Uma mudança de search_path só poderá ser proposta após inspecionar o corpo e
resolver nomes explicitamente; nada disso é alterado nesta etapa.

EXECUTE pode vir de PUBLIC, grants diretos, memberships ou default privileges
(um default não comprova ACL de função existente). Inspecionar proacl e
has_function_privilege para assinaturas exatas, além de USAGE do schema e schemas
expostos pelo PostgREST. EXECUTE permite invocação, mas a função ainda pode negar
por auth.uid()/papel; helper booleano autorizado não equivale a escrita arbitrária.
Prioridade alta se alguma RPC executável sem autorização tiver escrita privilegiada
ou controlar memberships; sua existência não foi comprovada pelos dados fornecidos.

Verificar chamadas anon, authenticated e service_role sem UID/com UID sintético.
service_role com bypass não cria auth.uid() automaticamente: helpers podem retornar
false sem usuário, enquanto guards identity-neutral devem continuar funcionando.
As novas funções propostas permanecem com search_path=pg_catalog e nomes
qualificados; revisar ACLs geradas por defaults no stack local antes de aprovação.

## Matriz de autorização

| Operação | admin | manager | technician | operator |
|---|---|---|---|---|
| UPDATE de máquina | Sim | Sim | Não | Não |
| UPDATE de manutenção | Sim | Sim | Sim | Não |
| INSERT/UPDATE de sensor | Sim | Sim | Sim | Não |
| Vínculos entre unidades da mesma organização | Conforme operação e acesso existente | Igual | Igual | Não nas operações acima |
| Transferência de organização no fluxo proposto | Não | Não | Não | Não |

Cada Sim depende do GRANT SQL efetivo, das restrições originais e do acesso
à unidade/recurso. Não são concedidos novos privilégios DML. INSERT de manutenção,
SELECT/DELETE e outras políticas não são ampliados ou redefinidos.

Somente quatro políticas são alteradas por AND, conservando comandos, papéis,
USING e WITH CHECK originais (incluindo fallback de CHECK para USING).
USING autoriza a linha antiga; WITH CHECK autoriza a nova. Máquinas exigem
admin/manager na organização da unidade correspondente; manutenção inclui
technician. Sensores exigem papel técnico autorizado na organização comum e
acesso a TODOS os recursos preenchidos, além da condição original com OR.
Um admin em A e B não pode misturar os tenants. A integridade não substitui
a autorização nem acrescenta grants. RLS controla linhas, não colunas editáveis.

## Integridade, concorrência e restrição administrativa

O guard de sensor resolve o tenant a partir do dispositivo obrigatório e
compara reservatório e máquina opcionais. O de manutenção usa a unidade
obrigatória e compara dispositivo/máquina opcionais. Referências inexistentes
ou incoerentes geram erro genérico, sem devolver dados. As FKs existentes
continuam garantindo existência e CASCADE; nenhuma constraint é removida.

A proteção proposta **proíbe qualquer alteração de units.organization_id** e
qualquer mudança de organization via devices/machines/reservoirs.unit_id,
mesmo para recursos sem filhos e mesmo para service_role. Movimentos de unidade
dentro do tenant permanecem permitidos. Também proíbe transferir sensores e
manutenções completos para outra organização por UPDATE. Isso é deliberadamente
mais restritivo que somente impedir filhos incoerentes e requer aprovação.
Não representa afirmação de que transferências administrativas são ilegítimas.

Essa estratégia evita a corrida de um trigger que apenas consulta filhos:
a identidade organizacional de cada pai existente permanece invariável.
As leituras de integridade não precisam disputar uma mudança permitida de tenant,
porque nenhuma mudança dessa natureza é permitida pelo guard. Movimentos de
unidade dos pais tomam locks FOR SHARE nas unidades OLD/NEW em ordem de UUID;
esses locks impedem exclusão/alteração de chave da unidade durante a transação.
FKs continuam coordenando referência/exclusão dos recursos. Bloqueios, deadlocks
ou falhas de serialização devem abortar e ser tratados com retry limitado pelo
serviço; não se recomenda ignorar erros.

A instalação proposta toma SHARE ROW EXCLUSIVE nas seis tabelas antes de ler
baseline e validar dados, evitando corrida entre checagem inicial e instalação.
Isso bloqueia escritores e DDL durante a transação. lock_timeout=5s e
statement_timeout=30s limitam impacto; em tabelas grandes a validação pode
exigir janela dedicada e medição em clone isolado. Não executar agora.

Não são criadas colunas organization_id redundantes: FKs compostas exigiriam
mudança mais ampla de schema. CHECK com subconsulta não resolve a integridade
relacional. Uma futura transferência legítima precisa de fluxo transacional
explícito, dependências completas, locks e aprovação separados. Não desabilitar
guards/RLS como procedimento normal. service_role continua com BYPASSRLS e seus
grants originais, mas passa a respeitar a nova regra de integridade.

A garantia depende de triggers habilitados e de nenhuma rotina privilegiada
contorná-los (session_replication_role, DDL, superuser). Inspecionar jobs,
replicação, RPCs e triggers existentes antes da aprovação. CASCADE de exclusão
permanece o comportamento existente, com o mesmo risco operacional de apagar
filhos; não foi alterado para compensar transferências.

## Helpers e metadados necessários

Funções novas SECURITY DEFINER, owner postgres, search_path=pg_catalog,
referências qualificadas, sem SQL dinâmico controlado pelo usuário. Apenas os
dois helpers booleanos de autorização recebem EXECUTE para authenticated.
Resolvers e função de trigger não ficam acessíveis a PUBLIC/anon/authenticated.
Defaults administrativos de funções precisam ser revisados. Nenhum helper
existente é redefinido. Nome de helper existente provoca recusa.

Antes de aprovação, executar o preflight SOMENTE LEITURA por conexão autorizada,
em tarefa própria. Este trabalho não o executa remotamente. Ele retorna:

- baseline completa de políticas das três tabelas, não só nomes;
- tipos, nullability, ACLs de coluna, owner e RLS;
- grants DML efetivos, constraints/FKs, triggers e índices;
- signatures, SECURITY DEFINER, search_path/volatilidade/ACLs dos helpers;
- atributos dos papéis e defaults de EXECUTE para funções.

A configuração e a semântica geral dos helpers foram confirmadas; ainda revisar
corpos completos/ACLs por canal seguro, memberships e
permissões por coluna, FORCE RLS, FK ON UPDATE/deferrabilidade, funções/triggers
privilegiados e alterações concorrentes por serviços. Os contratos de políticas
TO authenticated/permissivas e ausência de outras políticas permissivas de
escrita devem coincidir. Os valores GUC de contrato aprovado e baseline exata
são guardas contra aplicação acidental, não substitutos da aprovação humana.

## Matriz de testes sintéticos PostgreSQL 17

Comando: `python3 supabase/tests/rls/test_isolated.py`.
Docker descartável, sem portas expostas; imagem oficial fixada por digest,
claims simuladas e dados exclusivamente sintéticos. Nenhuma chamada Supabase,
Auth real, cobrança ou ingestão real. Grants da fixture existem só no teste.

| Grupo | Casos e resultado esperado |
|---|---|
| Papéis | A/B × admin/manager/technician/operator: permitir ou negar conforme matriz |
| Isolamento | Leituras e UPDATE de recursos alheios negados no modelo sintético |
| Dupla participação | Admin A/B não transfere; técnico A/operator B não escreve em B |
| Sensores | INSERT/UPDATE multiunidade; vínculos simultâneos; device obrigatório; inexistentes e mistura A/B rejeitados |
| Manutenção | INSERT/UPDATE com vínculos opcionais e multiunidade; device ou machine estrangeiro rejeitado |
| Pais | Trocas de unidade no mesmo tenant permitidas; mudança de tenant de units/devices/machines/reservoirs rejeitada |
| Concorrência | Sessões simultâneas: movimento permitido + criação; transferência inválida + criação; mudança de tenant da unidade sob READ COMMITTED/REPEATABLE READ/SERIALIZABLE |
| Autorização separada | WITH CHECK no destino, bloqueio de unidade, resolver privado e ausência de GRANT DML |
| Preservação | Dados sintéticos, ACLs de tabelas/colunas, constraints, helpers anteriores e políticas de leitura preservados |
| Recusa transacional | Schema divergente, nullability, FK ausente, dados incoerentes, baseline/política adicional e contrato não aprovado |

Também se testa um trigger BEFORE que muda unit_id fora do SET e criação de
dispositivo/sensor no mesmo comando CTE.

Testes concorrentes exercitam interleavings limitados; não são prova exaustiva.
A segurança da proposta se apoia também na invariância do tenant dos pais.
Repetir em Supabase isolado com schema/ACLs/helpers reais, Auth/PostgREST,
Realtime, Edge Functions, financeiro sem cobranças e ingestão simulada.
Medir locks, throughput, deadlocks e efeitos de triggers reais. Testar CASCADE,
constraints diferidas, cargas em lote, rollback de transações e retries no clone.
Não concluir compatibilidade operacional só pelo PostgreSQL sintético.

## Implantação e recuperação pendentes

1. Revisar preflight, restrições de transferência e dependências dos serviços.
2. Restaurar apenas estrutura/metadados em Supabase isolado, criar fixtures
   sintéticas e capturar baseline completa de policies, grants, triggers e funções.
3. Executar proposta e testes; ensaiar carga e recuperação; obter aprovação explícita.
4. Planejar janela e backup/recovery aprovados, verificar novamente baseline e
   manter os rascunhos fora de supabase/migrations até aprovação própria.
5. Verificações posteriores: quatro políticas com condições antigas preservadas,
   seis guards habilitados, novos helpers com ACLs previstas, grants/constraints
   inalterados e smoke tests de serviços sem cobranças.

Antes de COMMIT, qualquer erro reverte toda a proposta. Após COMMIT, não usar
DROP CASCADE nem restaurar políticas permissivas automaticamente. Uma reversão
precisa restaurar as quatro políticas EXATAMENTE da baseline aprovada, remover
apenas os seis triggers e cinco helpers criados após verificar dependências,
e conservar ACLs/FKs/objetos anteriores. Ensaiar essa reversão em clone;
preferir correção progressiva quando reabriria vulnerabilidades. Esta etapa
não fornece nem executa rollback de produção automaticamente.

Resultado histórico da Etapa 3.9, não reexecutado na Etapa 3.17: suíte aprovada em PostgreSQL 17.11, incluindo os casos de
concorrência e sete recusas/rollback de contrato, schema, baseline e dados.
`git diff --check` aprovado; SHA-256 dos quatro arquivos anteriores de
privilégios confirmado sem diferenças. Nenhum teste remoto foi realizado.

Procedimento e matriz do stack local: [Supabase isolado](supabase-local-validation.md).
Na Etapa 3.17 foram executadas apenas verificações documentais, de diff e hashes;
não foram iniciados serviços nem executados SQL/migrations/testes de aplicação.

Pendências para aprovação: ACLs/corpos completos de helpers, baseline completa
de schema/policies/grants, versões homologadas do stack local, autorização da restrição de transferência também para service_role,
fluxos administrativos legítimos, desempenho e testes do stack Supabase isolado.
