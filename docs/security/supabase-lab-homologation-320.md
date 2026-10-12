# Etapa 3.20 — homologação documental, sem serviços

Base: eb4f9317dd161d5a6846d867c8a06eacbf0ca316, branch de segurança.
Data das verificações: 12/10/2026. Estado: homologação operacional incompleta.
Somente leitura de versões/fontes públicas e testes estáticos; nenhum SQL,
Supabase, daemon/container Docker iniciado, migration, deploy ou acesso ao banco.

## Verificações efetivamente executadas

| Item | Resultado observado | Limite |
|---|---|---|
| Sistema | Debian GNU/Linux 13 (trixie) | Não é Windows 11 |
| PowerShell | 7.4.6 em /tmp/pwsh746/pwsh, execução -NoProfile | Não instalado no PATH; build Linux, não teste Windows |
| Cliente Docker | docker --version: 28.4.0, build d8eb465 | Não equivale à versão do server ou Docker Desktop; não executados info/version de daemon |
| Supabase CLI | Não encontrada no PATH | Sem CLI --version, instalação ou start |
| Test-LabScripts.ps1 | 42 checks aprovados, exit 0 | Mocks/fixtures locais; sem chamada real de Docker, HTTP ou SQL |
| Test-LabPrerequisites.ps1 -StaticOnly | PASS, exit 0 | Readiness NOT approved; não executado modo full |
| Fontes oficiais | Release CLI v2.120.0 e código da tag consultados | Candidata documental, não homologada/instalada |
| Proteção de artifacts | Hashes dos seis SQLs e scripts/manifest comparados ao início | Inalterados; flags não habilitadas |

Consulta de versões usa apenas o binário cliente: não usar `docker version`,
`info` ou `ps` nesta etapa. Não se executa o código do repositório de referência,
seus instaladores, testes ou exemplos de start; apenas se lê a fonte pública.

## Referências oficiais verificadas e limites de acesso

A página [release CLI v2.120.0](https://github.com/supabase/cli/releases/tag/v2.120.0)
foi acessada; a tag foi obtida por Git e resolve para
`753520fa7202ed5f8b25883a4c0aa7e5e9ad1fc4`. As referências abaixo usam esse commit:

- [README/instalação Windows](https://github.com/supabase/cli/blob/753520fa7202ed5f8b25883a4c0aa7e5e9ad1fc4/README.md): documenta Scoop e instalação por package manager; não foi executada.
- [Catálogo Dockerfile](https://github.com/supabase/cli/blob/753520fa7202ed5f8b25883a4c0aa7e5e9ad1fc4/apps/cli/src/shared/services/Dockerfile).
- [Artifacts/digests catalogados](https://github.com/supabase/cli/blob/753520fa7202ed5f8b25883a4c0aa7e5e9ad1fc4/packages/stack/src/Artifacts.ts).
- [Mapeamento slim/seleção de imagens](https://github.com/supabase/cli/blob/753520fa7202ed5f8b25883a4c0aa7e5e9ad1fc4/apps/cli/src/shared/services/slim-images.ts).
- [Configuração de db.major_version](https://github.com/supabase/cli/blob/753520fa7202ed5f8b25883a4c0aa7e5e9ad1fc4/packages/config/src/db.ts).

As páginas [Supabase local](https://supabase.com/docs/guides/local-development/cli/getting-started)
e [Docker Desktop Windows](https://docs.docker.com/desktop/setup/install/windows-install/)
responderam HTTP 403 neste ambiente. São referências oficiais para revisão
posterior, **não conteúdo verificado nesta tarefa**. Não certificar builds mínimos
Windows/WSL2, requisitos de RAM ou versões de Docker Desktop sem essa revisão.
URLs raw antigas retornaram 404; o catálogo foi lido por clone Git da tag oficial.

## Matriz candidata de versões/imagens — não habilita pins

As imagens abaixo são referências upstream do catálogo da CLI v2.120.0,
não imagens inspecionadas, baixadas ou executadas. Tags não são digests imutáveis.

| Componente | Versão/referência oficial candidata | Estado |
|---|---|---|
| PowerShell | 7.4.6 mínimo exercitado; escolher patch suportado atualizado | Linux estático aprovado; Windows pendente |
| Docker Desktop/Engine | Desktop Windows a escolher; cliente Linux observado 28.4.0 | Backend WSL2/Hyper-V, server e suporte Windows pendentes |
| Supabase CLI | v2.120.0, commit acima | Release consultada, compatibilidade operacional pendente |
| PostgreSQL | supabase/postgres:17.11.0.004 | Major 17 documental; remoto informado 17.6 não é equivalência de patch/extensões |
| Gateway | library/kong:2.8.1 | Catálogo upstream |
| Auth | supabase/gotrue:v2.197.0 | Fluxos locais pendentes |
| PostgREST | postgrest/postgrest:v16.4 | Grants/RPC/RLS pendentes |
| Realtime | supabase/realtime:v2.140.10 | Publication/RLS/eventos pendentes |
| Storage | supabase/storage-api:v1.79.36 | Dependências/configuration pendentes |
| Meta | supabase/postgres-meta:v0.100.0 | Escopo local apenas |
| Studio | supabase/studio:2026.10.05-sha-94b8b06 | Bindings e portas pendentes |
| Email local | axllent/mailpit:v1.31.3 | Sem SMTP externo; confirmação/recuperação pendentes |
| Edge runtime | supabase/edge-runtime:v1.77.4 | Não servir funções Asaas/ANEEL; efeitos externos bloqueados |
| Imagens opcionais | darthsim/imgproxy:v3.26.0, timberio/vector:0.58.0-alpine, supabase/logflare:1.52.0, supabase/supavisor:2.9.13 | Avaliar desativação conforme configuração, não presumir ausência |

Catálogo também tem PG14/15 e jobs differ/migra/pgprove: não são autorização
para usá-los nem dependência automática deste ensaio de PG17.

Exemplo de pin **documental** slim PG17 publicado em Artifacts.ts:
`ghcr.io/supabase/cli/postgres:17.11.0.004-r1@sha256:8fb7ae7cd0d8121c460c8756d7f2791ce9a19c3331b46987456dfa4f8b45d701`.
É evidência de fonte, não verificação de registry, plataforma ou cache. Catálogo
possui variantes upstream/slim; fechar inventário efetivo do binário/config antes
de preencher supabaseImages. A variável SUPABASE_USE_SLIM_IMAGES, documentada
na fonte, é bloqueada pelos guards atuais de presença SUPABASE_*; não habilitá-la
para contornar gates. Modo de imagem/configuração exige revisão própria.

Para homologar futuramente: fixar CLI/binário e checksum, Windows/arquitetura,
Desktop/server/backend, configuração e cada imagem por digest/plataforma;
verificar resolução no registry e cache em etapa autorizada. Não usar o digest do
postgres:17 puro dos testes anteriores como substituto do Supabase PostgreSQL.
Não selecionar versões individuais arbitrariamente a partir de releases latest.
O manifesto permanece com CLI/Docker null, imagens vazias e aprovações false.

## O que exige Windows e o que é portável

| Teste | Dependência |
|---|---|
| Parser, tipos do JSON, guards de URLs/flags, hashes e mocks | Portável PowerShell 7; executado em Linux |
| Named pipes reais, contexto Docker Desktop, engine Linux via WSL2/Hyper-V | Exige host Windows com Docker Desktop no alvo aprovado |
| Get-NetTCPConnection e erros de acesso/IPv4/IPv6 reais | Exige Windows; não é validado por mock Linux |
| Credential Manager, ACL NTFS, drives mapeados, UNC, junctions | Exige Windows; a revisão continua sem ler segredos |
| Versão/build suportado, WSL/Hyper-V, firewall Windows e egress Desktop | Homologar na máquina Windows 11 alvo e documentação do fornecedor |
| Auth, SQL grants/RLS/triggers, integridade, concorrência e desempenho | Tecnicamente portáveis num stack compatível; ainda não executados; aprovação final também exige ensaio no alvo Windows |

Windows 11 é o alvo escolhido pelo projeto, não uma afirmação de que Auth/PostgreSQL
só funcionem nesse OS. Docker Desktop não é necessário para parser/fixtures estáticas.
Os scripts de runtime foram intencionalmente restritos ao caminho Windows named pipe.

## Pacote estrutural sanitizado — critérios de obtenção

Nenhuma extração realizada. Exigir tarefa própria autorizada e canal seguro para
obter somente DDL/metadados; não usar link/pull/push, dump de linhas ou credenciais
no chat. Preparar artifact .sql.pending fora de migrations, autocontido,
revisado, com hashes e proveniência. Não executar automaticamente para validá-lo.

Cobrir as 19 tabelas confirmadas:
organizations, organization_members, units, machines, reservoirs, devices,
sensors, machine_readings, reservoir_readings, payments, subscriptions, alerts,
maintenance, audit_logs, consumption_records, machine_cycles, plans, profiles,
reservoir_refills.

Além das tabelas: enums/domains/sequences/defaults/generated columns, PK/FK e
ON UPDATE/DELETE/deferrabilidade/validação, unicidade/checks, índices, policies,
FORCE RLS, grants/coluna/schema/EXECUTE, role inheritance, owners/default privileges,
helpers/corpos/search_path e grafo completo de dependências de funções/views.
Incluir configuração de Auth/PostgREST/publications/extensões necessária como
metadata sanitizada; não copiar estrutura gerenciada auth/storage cegamente.
Serviços financeiros/telemetria podem depender de funções remotas não versionadas:
identificar, revisar e simular sem cobrança nem rede externa.

Recusar COPY/INSERT de dados reais, usuários auth, tokens, senhas, secret defaults,
URLs privadas, secrets dentro de funções, HTTP/dblink/FDW/jobs não revisados e
metacommands/includes inesperados. Não remover bodies de helpers e declarar
compatibilidade: cada sanitização/mudança deve aparecer como divergência.
Revisão dupla deve separar DML interno legítimo de função de registros copiados.
Constraints geram os triggers internos; não recriar manualmente os 66. Não criar
índices para maintenance.device_id/machine_id sem avaliação de desempenho.

Bloqueios restantes: schema completo não versionado, pacote ausente, CLI e digests
não homologados, config ausente, perfil limpo/egress não certificados. Os fatos
remotos fornecidos (tabelas/ACLs gerais/zero inconsistências) não substituem o pacote.

## Decisão definitiva e leitura da proposta SQL

A regra aprovada é: identidade organizacional imutável após criação, sem
transferências cross-tenant por nenhum papel, inclusive admin ou service_role.
Máquinas/dispositivos/reservatórios podem mover-se entre unidades da mesma
organização. Sensores/manutenções podem referenciar unidades distintas do mesmo
tenant. Esta decisão é definitiva; implementação e flags permanecem pendentes.

Leitura estática de `20261012_harden_operational_rls.sql.pending`:

- guard AFTER de units rejeita organization_id diferente de OLD;
- guards AFTER dos três pais comparam organizações de OLD.unit_id/NEW.unit_id,
  permitindo unidades diferentes apenas com organização igual;
- sensor exige device obrigatório e igualdade da organização de todos os vínculos;
- manutenção compara cada vínculo opcional à organização de unit_id;
- UPDATE de sensor/manutenção também compara OLD/NEW, impedindo transferência
  integral mesmo por usuário membro de A e B;
- triggers de integridade não dependem de RLS/auth.uid(), portanto o bypass
  service_role não cria exceção. Nenhum novo GRANT DML é concedido.

Conclusão: os guards são compatíveis com a regra aprovada para os caminhos de
INSERT/UPDATE cobertos. Isso é leitura de fonte, não homologação de execução ou
certificado sobre o schema real. O SQL permanece byte a byte inalterado.
Comentários/mensagem que sugerem separate reviewed workflow para cross-tenant
são legados; o código não implementa tal exceção. Propor correção apenas de
texto em etapa futura autorizada, sem relaxar a rejeição.

Antes da aprovação da implementação, validar caminhos externos aos UPDATEs
normais: owners/superuser/replicação podem contornar triggers, DELETE seguido de
recriação de um identificador pode escapar da noção de identidade histórica, e
RPCs/batches/jobs ainda precisam de inventário. Propor proibição de reutilização
de IDs ou proteção histórica apenas se esse caminho e a regra de identidade
lógica forem confirmados no schema. Nada disso autoriza transferências.

## Revisão posterior de storage — Etapa 3.21

A proposta de rejeitar TEMP/root UNC/mapeado foi implementada na revisão seguinte,
com [79 checks e limites documentados](supabase-lab-storage-321.md). Os riscos
abaixo são o diagnóstico histórico da Etapa 3.20, não indicação de que a validação
continue apenas por prefixo. A homologação Windows real continua pendente.

## Revisão dos scripts e riscos residuais

As correções da Etapa 3.19 seguem presentes: flags JSON booleanas, endpoint Docker
nomeado explícito, UNC/mapped drive para manifesto, paths/reparse points,
container:<id>, bindings e erros sanitizados. 42 checks continuam aprovados.
Não foi demonstrada nova exploração no ambiente atual, nem alterado um script.

Pontos concretos para revisão futura, sem alterar proteções agora:

1. Assert-LabDirectory confia que GetTempPath é local. Se TEMP/TMP do alvo Windows
   apontar para UNC/drive de rede, estar sob o temporário não comprova localização
   local. Pré-condição: temporário em volume local, perfil dedicado. Proposta
   justificada: rejeitar explicitamente UNC/drive mapeado também para TEMP/root
   antes de probes de filesystem, com mocks e testes Windows. Não foi exercitado
   nesse ambiente Linux nem aplicado nesta etapa.
2. Inspeção de links/hash não elimina troca concorrente por outro processo com
   escrita no diretório. ACLs restritas/conta isolada continuam obrigatórias;
   validar no Windows antes de tratar hash como garantia operacional.
3. Um hash aprovado de config/manifest não verifica automaticamente semântica,
   versão, firewall, egress ou ausência de segredos no Credential Manager.
   Guards complementam revisão humana; não habilitar flags para contornar lacunas.
4. Defaults locais podem ser públicos/previsíveis no código do fornecedor
   ([Defaults.ts](https://github.com/supabase/cli/blob/753520fa7202ed5f8b25883a4c0aa7e5e9ad1fc4/packages/stack/src/Defaults.ts)).
   Não transcrever seus valores, reutilizá-los em produção ou confiar em Auth
   local como barreira contra exposição da máquina. Exigir isolamento/loopback,
   proteção de artifacts e zero credenciais reais.

## Próxima etapa e critérios de avanço

Agora concluído: versões dos binários disponíveis, catálogo oficial versionado,
matriz de dependências Windows, critérios do pacote, decisão definitiva e teste
estático reexecutado. Homologação operacional **não concluída**.

Próxima etapa requer selecionar/homologar Windows/Desktop/CLI e arquitetura,
obter/revisar pacote e config, resolver TEMP/root local, validar Credential
Manager/ACLs e política de rede, fechar digests efetivos sem habilitar flags.
Iniciar stack, importar estrutura, executar SQL de teste ou proposta exige
aprovação própria posterior. Não há autorização de produção.

Estado de PR não alterado, sem ready-for-review/merge. A consulta de leitura
`gh pr view --json url,isDraft` voltou a retornar Forbidden na API GraphQL;
este relatório não certifica Draft remotamente. Confirmar manualmente o estado.
