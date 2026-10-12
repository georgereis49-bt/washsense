# Auth/PostgREST e recuperação pós-COMMIT — execução nova

Base: 56732b28b065c2f383ac3054a27aa5728e8e7fb2. Nenhuma suíte anterior foi
reexecutada. Testes novos em Linux/Docker local, dados e credenciais efêmeros
fictícios; nenhum acesso à produção, deploy, merge ou aprovação de produção.

| Cenário | Resultado | Evidência / limite |
|---|---|---|
| Auth e PostgREST reais disponíveis | PASS | [log API](evidence/auth-postgrest-minimal.txt); GoTrue v2.197.0 e PostgREST v16.4 por digest |
| Signup, login senha e JWT emitido pelo Auth | PASS | Usuários @example.test; senha incorreta rejeitada |
| JWT inválido/ausente no PostgREST | PASS | HTTP 401/403; nenhum dado entregue |
| Leitura de organização alheia | PASS | JWTs reais admin A/B, técnico A e operador A retornam [] |
| UPDATE de máquina admin versus técnico/operador | PASS | HTTP real: 1 linha versus 0 linhas |
| Movimento de máquina entre unidades A | PASS | HTTP 200, 1 linha alterada |
| Admin membro A/B transfere máquina A→B | PASS | HTTP 400, SQLSTATE 23514 |
| Sensor multiunidade mesma organização | PASS | Técnico insere por HTTP 201; operador recebe 403 |
| Sensor com vínculos A/B via service_role | PASS | JWT local de serviço, HTTP 400, SQLSTATE 23514 |
| Logout/revogação de refresh | PASS | Auth HTTP 204; refresh subsequente HTTP 400 |
| Checkpoint anterior + três propostas COMMIT | PASS | [log recuperação](evidence/postcommit-recovery.txt) |
| Restauração pós-COMMIT em outro banco | PASS | Políticas, RLS/ACLs de tabela/schema/coluna, defaults, helpers, constraints e todas as linhas sintéticas iguais à baseline |
| Banco endurecido preservado durante recuperação | PASS | Comparação confirma que apenas o banco de destino recebeu o checkpoint |
| Comportamento/permissões antigos recuperados | PASS | UPDATE de operador antigo e TRUNCATE grant retornam, exatamente como checkpoint; não reabrir automaticamente em produção |
| Consulta sanitizada única | PASS local | Validada em PG17.11: 19 tabelas, seis helpers e 760 verificações efetivas; NÃO executada remotamente |
| Stack Supabase completo/gerenciado | BLOCKED | Somente PG/Auth/PostgREST; não houve Studio, Realtime, Storage, gateway, SMTP ou Edge Functions |
| Equivalência com schema real antes da produção | BLOCKED | Falta pacote estrutural revisado completo e baseline exata, conforme seção abaixo |
| Recuperação operacional de produção/PITR/config/roles externas | BLOCKED | Ensaio cobre checkpoint PostgreSQL sintético, não disaster recovery de Supabase gerenciado |

## Componentes mínimos e execução

Imagem PostgreSQL 17.11 já em cache, usada anteriormente. Imagens oficiais novas:

- `supabase/gotrue@sha256:1736a63078f5922b198c4cbe50f80ab9a2d3b54fe8b7b6cfb2e9dc5dbbc12c6b`;
- `postgrest/postgrest@sha256:d155c6718ed9a9f990d159a2ab7c0a3f16944dbb6d0a0344557421042acfe0df`.

Não foi necessária Supabase CLI nem infraestrutura adicional. Registry foi usado
somente para obter essas imagens oficiais; nenhum projeto Supabase foi contatado.
Rede Docker internal inspecionada; três serviços com zero portas publicadas.
HTTP usa apenas IPs dos containers obtidos por inspeção na rede criada pela suíte,
sem proxy e sem redirects. Containers/volumes/rede de execução foram removidos.

Credenciais DB, senha de usuários e chave JWT são geradas em memória para cada
execução e descartadas; nenhum secret/env/URL de produção é usado. Logs publicados
contêm apenas PASS e versão. Não servir estes testes numa máquina exposta.

```bash
python3 -u supabase/tests/auth_api/test_minimal.py
python3 -u supabase/tests/recovery/test_postcommit.py
```

Exigem Docker socket Linux local e as imagens pinadas já em cache. Os testes
recusam Docker remoto, não fazem pull implícito e removem somente seus recursos.
Auth depende do hostname interno do DB e usa suas próprias migrations locais;
PostgREST conecta por authenticator NOINHERIT e aplica o papel do JWT verificado.

A fixture usa definições revisadas do teste RLS anterior via AST, sem executar seu
runner. Duas organizações/quatro unidades, dados falsos e memberships locais.
Apenas componentes HTTP são reais: schema de aplicação/helpers são sintéticos,
auth.uid() é adaptado para claims verificadas do PostgREST em PostgreSQL vanilla.
JWT de usuário não é simulado manualmente: é emitido em signup/login reais.
JWT service_role é assinado somente com a chave local fictícia. Não confundir
esta cobertura com equivalência de Auth ou helpers/config gerenciados de produção.

## Falhas novas encontradas e resolvidas no bootstrap local

Auth precisou ownership de auth.uid() para sua migration inicial. A configuração
GoTrue desta versão usa GOTRUE_JWT_DEFAULT_GROUP_NAME, confirmada no código oficial
v2.197.0; a variável sem _NAME deixava papel vazio no token, rejeitado pelo
PostgREST. Corrigidos somente o bootstrap e a configuração do teste descartável.
Fonte: [GoTrue config](https://github.com/supabase/auth/blob/4eee58f296d9698a1c2c0ae14d7a0b379c7622d3/internal/conf/configuration.go).

Portas em rede internal não ficaram publicadas como esperado; foram removidas
e as chamadas passaram a usar exclusivamente endereços internos inspecionados.
As execuções finais dos dois testes encerraram com exit 0. Nenhuma falha da
proposta SQL foi comprovada, portanto nenhum rascunho SQL existente foi alterado.

## Procedimento de recuperação efetivamente testado

1. Capturar snapshot lógico de metadados/dados sintéticos e checkpoint pg_dump
   custom ANTES do endurecimento, dentro do container descartável.
2. Aplicar e COMMIT das três propostas na conexão local, com baseline/contrato
   da fixture; confirmar mudança de estado.
3. Criar um SEGUNDO banco e usar pg_restore --exit-on-error a partir do checkpoint.
4. Comparar políticas, ACLs/schema/coluna, defaults, funções, constraints e linhas
   ao snapshot anterior; confirmar que o banco endurecido continua diferente.
5. Verificar comportamento anterior no destino recuperado; destruir todo o lab.

É recuperação por restauração isolada, não SQL inverso em produção nem DROP
CASCADE. O checkpoint desaparece ao destruir o container porque não contém dados
reais. Em produção o backup deve ser durável, incluir roles/config relevantes,
ter integridade verificada e estratégia aprovada de restauração/cutover. Restaurar
RLS/grants antigos pode reabrir falhas: não reconectar clientes automaticamente.
Sessões/JWTs/config Auth, Realtime e workers não foram restaurados neste ensaio.

## Metadados exatamente pendentes

Schema completo NÃO foi indispensável para os testes novos acima. Para aprovar
aplicação em produção, são necessários: colunas/defaults/enums/PK/FK/checks/índices
reais das 19 tabelas; políticas completas e todos os papéis; grants efetivos de
tabela/coluna/schema/EXECUTE e herança; helpers/corpos/owners/search_path e suas
dependências; defaults dos criadores; triggers customizados ou internos e estado;
extensões e configuração de schemas/publications/RPCs/serviços/hook externos.

Uma única consulta somente leitura preparada:
[remote_metadata_sanitized.sql](/workspace/washsense/supabase/security/remote_metadata_sanitized.sql).
Não executada em produção. Um responsável autorizado poderá obter esse inventário
por canal autorizado, sem compartilhar credenciais. Ela não lê tabelas de usuários,
clientes, pagamentos ou auth; nomes desconhecidos de papéis são rotulados other.

Para evitar secrets embutidos em defaults/checks/functions, expressões e corpos
são retornados como fingerprints, NÃO texto. Isso detecta diferenças, mas não
reconstitui DDL nem comprova semântica. A baseline exata das quatro políticas e
corpos sanitizados dos helpers ainda precisam de revisão segura do pacote estrutural.
pg_depend não descobre todo SQL dinâmico/refs de PLpgSQL; configuração Auth,
providers, SMTP, webhooks e Edge secrets não são inventariáveis por esse SELECT.
Ausência no resultado não prova ausência de serviço/função remoto.

## Preservação e publicação

Somente dois testes novos, uma consulta de metadados, este relatório e logs.
Aplicação, manifesto/flags e seis SQLs anteriores intactos por hashes. Não houve
nova execução das suítes aprovadas. Estado da PR não alterado; manter Draft e
sem merge. A consulta da API GitHub continua sujeita ao bloqueio Forbidden.
