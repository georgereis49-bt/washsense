# Validação das definições reais — base 13cdb7e

**Resultado agregado: BLOCKED para aprovação/aplicação em produção.** A reconstrução pública e a execução das três propostas passaram localmente, mas o executor de default privileges precisa ser resolvido e as escritas operacionais por API estão bloqueadas pelos grants reais. Nenhuma falha de isolamento explorável foi demonstrada nesses caminhos bloqueados. Não foram alteradas as propostas SQL.

## Execução e evidências

Executados em PostgreSQL **17.11**, Docker local, exclusivamente estrutura fornecida e registros fictícios. Nenhum acesso ao Supabase remoto. Os runners reutilizam o executor/preflight/aplicação de `supabase/tests/rls/test_isolated.py`; o teste HTTP reutiliza o fluxo integrado GoTrue/PostgREST; recuperação reutiliza as mesmas asserções de inventário pós-COMMIT. Não foram repetidos testes estáticos Windows.

| Cenário | Resultado | Evidência/limite |
|---|---|---|
| Reconstrução das 19 tabelas, 154 colunas, 54 constraints e 55 índices | PASS | DDL executado com tipos/defaults/identities e FKs fornecidos; índices das PKs/UNIQUE criados pelas constraints |
| Equivalência dos 393 grants diretos | PASS | Comparação de todos os tuples tabela, grantee, grantor, privilégio e grant option; nenhum grant DML adicional |
| Equivalência das 41 políticas | PASS | Comparação de USING/WITH CHECK, comandos, papéis e permissividade em `pg_policy` |
| Seis helpers | PASS | `pg_get_functiondef` igual ao texto fornecido, normalizando CRLF; ACL fornecida preservada: PUBLIC/postgres/authenticated EXECUTE |
| 72 default grants em public | PASS | Comparação de criador/tipo/grantee/grantor/privilégio/grant option |
| Revogação dos 152 privilégios estruturais | PASS | Proposta fez COMMIT como postgres NOSUPERUSER com BYPASSRLS; suas verificações internas preservam direitos fora do alvo |
| Default privileges como postgres NOSUPERUSER | BLOCKED | Erro real `permission denied to change default privileges` para supabase_admin; transação desfeita, catálogo idêntico ao anterior |
| Default privileges como supabase_admin | PASS | COMMIT real no banco descartável; papel administrativo reproduzido com SUPERUSER |
| Objetos futuros de ambos os criadores | PASS | Sem os quatro privilégios estruturais para anon/authenticated; defaults DML existentes preservados |
| Proposta RLS contra as definições reais | PASS | Preflight/baseline local completo, quatro políticas e contratos de schema aceitos; COMMIT real |
| DML operacional via papéis SQL | PASS | anon/authenticated/service_role receberam `permission denied`; nenhuma concessão nova |
| Sensores/manutenções entre unidades da mesma organização | PASS | INSERTs reais como proprietário, inclusive sensor com dispositivo+reservatório+máquina simultâneos |
| Transferências de máquinas/dispositivos/reservatórios dentro da organização | PASS | UPDATEs reais como proprietário |
| Transferências dos três recursos entre organizações | PASS | Rejeitadas pelos triggers como proprietário BYPASSRLS |
| Mudança de organização da unidade e vínculos cruzados sensor/manutenção | PASS | UPDATEs reais rejeitados pelos triggers |
| Recuperação pós-COMMIT | PASS | pg_dump anterior → pg_restore em outra base; políticas, ACLs, defaults, funções, constraints, flags RLS e todos os registros fictícios comparados |
| Auth real local | PASS | Cinco usuários fictícios, signup, login, senha incorreta, logout e refresh revogado |
| PostgREST/JWT e SELECT de organizations | PASS | Papéis de organizações A/B isolados; participante das duas vê somente A/B; JWT inválido e anônimo rejeitados |
| SELECT/INSERT/UPDATE operacional por HTTP | PASS para negação | HTTP 403, SQLSTATE 42501; grants reais mantidos para todos os cinco usuários e service_role no UPDATE examinado |
| Matriz de escritas admin/manager/technician/operator pela API | BLOCKED | Sem DML efetivo nas tabelas machines/sensors/maintenance; não concedido artificialmente |
| Trigger de integridade executado como service_role via API | BLOCKED | GRANT barra a operação antes do trigger. Execução pelo proprietário BYPASSRLS testa o trigger, não substitui este cenário |
| Supabase completo/Realtime/Storage/Edge Functions | BLOCKED | Executado PostgreSQL + Auth + PostgREST mínimo; demais serviços não executados |
| Limite exato de três sequences | BLOCKED | Transporte JSON arredondou bigint: `9223372036854776000`, superior a `9223372036854775807`; usadas identities padrão locais, sem afirmar equivalência dessa opção |

Logs: [PostgreSQL](evidence/real-definitions-postgres17.txt) e [Auth/PostgREST](evidence/real-definitions-auth-postgrest.txt). Um exit code 0 indica execução completa das asserções e bloqueios esperados; não significa aprovação de produção.

## Divergências reais e correções necessárias

1. **Executor dos defaults:** o postgres fornecido é NOSUPERUSER. No grafo conhecido ele não tem autorização para alterar defaults de supabase_admin. A mesma proposta passou como supabase_admin, sem mudança de SQL ou concessões. Confirmar um executor administrativo legítimo para essa proposta, separadamente do executor postgres exigido pelas demais. Não conceder membership/superuser à aplicação para resolver isso. Faltam atributos de `supabase_privileged_role`, possíveis associações indiretas não incluídas e opções INHERIT/SET das memberships; portanto o erro local não prova que todos os caminhos administrativos remotos estejam bloqueados.
2. **DML operacional ausente:** funcionalidade está bloqueada por permissões, antes de RLS/triggers. Não corrigir ampliando grants dentro desta tarefa. Uma decisão futura de produto/autorização deve preceder qualquer proposta DML; nesse caso a matriz completa de escrita precisa ser novamente testada.
3. **Sequences:** se equivalência exata dessa opção for exigida, reexportar limites como texto decimal. A perda de precisão não é uma divergência das três propostas, que não alteram sequences.

Não foi encontrada divergência de tabelas/FKs/políticas/helpers/ACLs que exija alterar as três propostas. Nenhum SQL protegido, aplicação, financeiro, Asaas, ANEEL ou IoT foi modificado.

## Escopo e fidelidade

Snapshot sanitizado: `supabase/tests/snapshot/real_definitions.json`, SHA-256 `32284445515c4992d62ea061e8f0f34c54b888fb97ebe59dde62fbbcf7d0e4d9`. São 817 entradas. SQL de helpers/políticas recebeu somente decodificação dos escapes de apresentação de novas linhas, comprovada pelas comparações de catálogo. Foram revisados os defaults, FKs, índices e os seis corpos SQL de autorização antes da execução; não há chamadas externas nesses corpos.

A fonte cobre public e cinco papéis, não o schema interno completo de Auth nem toda a configuração dos serviços. O laboratório PostgreSQL puro usa uma tabela auth.users mínima somente para a FK de profiles e um accessor de claims fictícias. O teste HTTP usa migrations reais locais de GoTrue **v2.197.0** e PostgREST **v16.4**, imagens fixadas por digest nos scripts existentes, JWT e senhas exclusivamente gerados em memória. Perfis/memberships são cadastrados pelo proprietário após signup, sem presumir automações remotas de criação de profiles. `auth.uid()` é o accessor local de claims verificadas pelo PostgREST; as seis funções públicas fornecidas não foram substituídas por versões fictícias.

O teste puro preserva postgres NOSUPERUSER e BYPASSRLS. O papel exclusivo `lab_root` permite montar/restaurar o laboratório; nunca é um usuário da aplicação. CREATEDB/CREATEROLE de bootstrap e opções de memberships não exportadas são configurações locais, não fatos remotos. O teste HTTP usa o superusuário de bootstrap da imagem para instalar componentes locais; a validação do executor real foi feita separadamente no teste puro. Os testes não afirmam reconstrução integral de Auth, privilégios administrativos indiretos, ACLs de sequences ou defaults fora de public. Ausência dessas evidências não implica ausência remota.

Não foram repetidos testes concorrentes anteriormente aprovados: a proposta é idêntica e não surgiu divergência no contrato relacional. Os testes novos cobrem os caminhos listados acima. Desempenho sob carga real continua sem evidência.

## Reprodução

Executar no checkout da branch com Docker Linux local e as três imagens fixadas já disponíveis:

```sh
python3 supabase/tests/snapshot/test_real_schema.py
python3 supabase/tests/snapshot/test_real_api.py
```

O primeiro usa `--network=none`. O segundo cria rede Docker `--internal`, sem portas publicadas, e verifica os IPs dos seus próprios containers; HTTP sem proxy e sem redirects. Nenhum runner aceita URL remota ou credenciais de produção. Containers, volumes anônimos e rede próprios foram removidos ao finalizar.

Nenhum deploy, merge ou alteração do estado da PR foi realizado. As alterações locais preexistentes em README.md e vite.config.ts foram preservadas e excluídas desta entrega.
