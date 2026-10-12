# Etapa 3.6 — propostas condicionais de autorização operacional

Nenhum SQL remoto foi executado. Não aplicar esta proposta em produção.
Os rascunhos da revogação dos 152 privilégios não foram modificados.

## Evidência, escopo e limitações

O usuário informou lacunas de papel em machines_update_managers,
maintenance_update_technicians, sensors_insert_technicians e
sensors_update_technicians. Não estão versionados os corpos completos das
políticas, helpers, schema de sensores ou regras de transferência remotas.
Os testes reproduzem expressões equivalentes em um modelo sintético, com
grants explicitamente concedidos SOMENTE nas fixtures. Eles não demonstram
exploração no projeto remoto: ACLs podem bloquear INSERT/UPDATE antes de RLS.

Arquivos novos:

- `supabase/security/20261012_rls_preflight.sql`: catálogos somente leitura.
- `supabase/security/20261012_harden_operational_rls.sql.pending`: proposta
  transacional fora de migrations, bloqueada sem contrato e baseline revisados.
- `supabase/tests/rls/test_isolated.py`: PostgreSQL 17 em Docker descartável.

Não há alteração da aplicação, autenticação, financeiro, ANEEL, IoT ou build.

## Matriz proposta — requer aprovação de negócio

| Ação | admin | manager | technician | operator |
| --- | --- | --- | --- | --- |
| Atualizar máquina | Sim | Sim | Não | Não |
| Atualizar manutenção | Sim | Sim | Sim | Não |
| Inserir/atualizar sensor | Sim | Sim | Sim | Não |
| Transferir entre unidades acessíveis da mesma organização | Papel da ação e acesso no destino | Igual | Somente nas ações técnicas permitidas | Não |
| Transferir entre organizações | Não neste fluxo | Não | Não | Não |

Nada concede INSERT/UPDATE ou modifica SELECT/DELETE. O escopo por unidade
continua delegado aos helpers existentes. Se técnicos precisarem alterar
campos específicos de máquinas ou operadores atualizarem campos específicos
de manutenção, a matriz deve ser refinada ANTES da aprovação; RLS controla
linhas, não uma lista de colunas editáveis.

## SQL proposto e avaliação de OLD/NEW

O rascunho altera somente as quatro políticas nomeadas por ALTER POLICY.
Conserva comandos, papéis e expressões originais, acrescentando condições
por AND. Conserva inclusive o comportamento de WITH CHECK omitido (fallback
de USING). Não transforma outras políticas, nem remove restrições existentes.

- Máquinas: USING exige acesso anterior e admin/manager na unidade anterior;
  WITH CHECK exige condição anterior e admin/manager na unidade resultante.
- Manutenção: mesma estrutura, incluindo technician.
- Sensores: USING/ WITH CHECK incluem papel admin/manager/technician, acesso a
  TODOS os recursos preenchidos e organização única entre esses recursos.
  INSERT possui apenas WITH CHECK, sem USING.

O OR original, isoladamente, pode aceitar um vínculo acessível e outro não
autorizado. A nova condição AND verifica cada vínculo não nulo. Mesmo um usuário
com acesso a A e B não pode criar uma associação que misture A e B.

USING não autoriza NEW; WITH CHECK não verifica sozinho o contexto OLD.
Um usuário administrador em A e B pode satisfazer ambos. Por isso, a proposta
inclui um guard de integridade para UPDATE de machines/maintenance e INSERT/
UPDATE de sensors, comparando organizações anteriores e resultantes. Essa é
uma regra de negócio proposta, NÃO uma regra remota já comprovada.

## Contrato de schema — não presumir compatibilidade

O exemplo SQL assume UUIDs e os seguintes caminhos:

```
machines.unit_id       -> units.id -> units.organization_id
maintenance.unit_id    -> units.id -> units.organization_id
devices.unit_id        -> units.id -> units.organization_id
reservoirs.unit_id     -> units.id -> units.organization_id
sensors.device_id / reservoir_id / machine_id -> respectivos pais
```

Cada tabela precisa ser comum, de postgres e possuir RLS. As quatro políticas
precisam ser permissivas, dirigidas exclusivamente a authenticated e ter os
comandos esperados. Outros formatos provocam recusa para revisão.

Se reservoirs deriva unidade por machine_id, ou sensors possui organization_id/
unit_id próprios, o SQL precisa ser adaptado e retestado. Esses campos não são
inventados ou tratados automaticamente. Os helpers existentes precisam possuir
as assinaturas e a semântica requeridas; devem ser inspecionados antes da execução.

A proposta permite um ou vários vínculos não nulos, desde que coerentes e
acessíveis. Não impõe XOR: ainda não sabemos se o negócio exige exatamente um.
Essa cardinalidade também precisa ser aprovada.

## Novos helpers: justificativa e superfície privilegiada

Consultas de política com joins executados como authenticated podem exigir
SELECT sobre pais que o usuário não possui. A proposta NÃO concede tais grants.
Ela introduz helpers restritos SECURITY DEFINER, de postgres, search_path
pg_catalog, referências qualificadas e sem SQL dinâmico a partir do usuário.

- Dois helpers booleanos de autorização recebem EXECUTE apenas para
  authenticated (além dos privilégios administrativos/defaults preservados).
- O resolver de organização não é exposto a PUBLIC/anon/authenticated.
- O guard retorna apenas NEW ou erro genérico, não dados privados.
- Os helpers originais não são redefinidos.
- Nome já existente provoca recusa, não sobrescrita.

Novas funções e triggers são alterações de schema propostas e justificadas
por autorização sem novos grants DML e comparação OLD/NEW. Precisam de revisão
específica de ownership, defaults de funções, RPC exposure e privilégio EXECUTE.
Os guards também se aplicam a service_role: RLS bypass não dispensa integridade.
Serviços legítimos de transferência podem precisar de um fluxo próprio.

## Lacuna de integridade ainda aberta — bloqueia aprovação completa

O teste demonstra que UPDATE de devices.unit_id por um caminho fora desta
proposta pode invalidar vínculos de um sensor já existente. O mesmo problema
deve ser examinado para reservoirs e units.organization_id, bem como concorrência.
Não alterar suas políticas silenciosamente para esconder essa lacuna.

Após inspecionar o schema, considerar:

1. CHECK de cardinalidade. Exemplo somente para revisão:

   ```sql
   ALTER TABLE public.sensors ADD CONSTRAINT sensors_association_required
     CHECK (num_nonnulls(device_id, reservoir_id, machine_id) >= 1) NOT VALID;
   ```

   Se XOR for aprovado, a regra muda para = 1. Não executar nem validar contra
   registros reais nesta etapa. Não corrigir registros existentes automaticamente.
2. FKs compostas com organization_id/unit_id e unicidade correspondentes,
   quando esses campos realmente fizerem parte do modelo. Uma FK simples garante
   existência, não igualdade de organização entre múltiplos vínculos.
3. Guards nas alterações dos pais e unidade, ou um fluxo explícito e atômico de
   transferência. Qualquer ampliação deve ser aprovada separadamente.
4. Locks e testes concorrentes apropriados. Checagem em trigger por SELECT
   isolado não deve ser confundida com integridade concorrente garantida.

## Baseline, execução e recuperação

O preflight retorna policy_baseline com TODAS as políticas das três tabelas,
colunas/tipos/ACLs, privilégios efetivos, constraints e metadados dos helpers.
Não retorna registros nem corpos de funções. Grants por coluna também precisam
ser considerados. Supabase remoto, hooks e outras RPCs não foram invocados.

O rascunho exige que um revisor forneça a baseline exata, via configuração da
sessão `washsense.rls_policy_baseline`, e sinalize contrato revisado com
`washsense.rls_contract_approved=on`. Isso é uma guarda de preparação, NÃO um
mecanismo de autenticação nem aprovação automática de produção.

Recusa alterações de baseline e qualquer política permissiva adicional de
escrita/ALL que possa reabrir acesso por OR. Uma política apenas mais estrita
não neutraliza outra política permissiva ampla. As demais políticas não são
alteradas; ficam para revisão específica se causarem recusa.

Usar transação e runner que interrompa no primeiro erro; timeouts são 5s para
locks e 30s para comando. Falha anterior ao COMMIT faz rollback de políticas,
helpers e triggers juntos. Repetição é recusada. Após COMMIT, não restaurar
políticas permissivas automaticamente: revisar uma correção específica, baseline
e dependências antes de qualquer remoção/reversão de novos objetos.

## Testes isolados

```bash
python3 supabase/tests/rls/test_isolated.py
```

Docker sem portas publicadas, imagem oficial fixada pelo mesmo digest dos testes
anteriores; dados sintéticos e claims simuladas, sem tokens reais. As fixtures
criam os grants para testar RLS. O rascunho NÃO cria esses grants.

Cobertura:

- Duas organizações e quatro papéis em cada uma.
- Alterações próprias permitidas/negadas e alterações em outra organização.
- Leitura de máquinas/sensores de outra organização negada no modelo sintético;
  políticas de leitura preservadas, sem afirmar equivalência ao schema remoto.
- Usuário administrador das duas organizações e técnico A/operador B.
- Autorizações no destino verificadas independentemente do trigger em uma
  fixture controlada; vínculos de unidade sem acesso também são rejeitados.
- INSERT/UPDATE de sensores, múltiplos vínculos coerentes, vínculos misturados
  e nenhum vínculo; comparação OLD/NEW nas transferências.
- Guards de integridade para service_role e resolver privado inacessível.
- INSERT/UPDATE bloqueados quando os grants SQL são removidos.
- Preservação dos grants de tabela, políticas de leitura e dados sintéticos;
  todas as tentativas funcionais são revertidas.
- Recusa de contrato não aprovado, baseline alterada, schema incompatível e
  política permissiva adicional; nenhum novo helper persiste após erro.
- Diagnóstico explícito da lacuna de mudança dos pais; não é certificado de
  isolamento completo nem teste do schema remoto.

Antes de aprovação: obter definições reais, revisar helpers e regras legítimas,
resolver integridade dos pais/concorrência e testar em Supabase isolado com os
grants reais (incluindo coluna), RLS/roles reais, Auth, serviços e ingestão.
Nenhuma cobrança ou deploy deve ser realizado por estes testes.

Resultado desta preparação: testes executados em PostgreSQL 17.11 e aprovados
nos casos descritos. O diagnóstico de mudança dos pais foi reproduzido como
lacuna conhecida, não classificado como isolamento aprovado. Nenhum teste com
schema, Auth ou serviços do Supabase remoto foi executado. Os quatro arquivos
anteriores de privilégios foram comparados por SHA-256 e permanecem idênticos.
