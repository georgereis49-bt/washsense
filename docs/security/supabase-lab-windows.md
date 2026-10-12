# Etapa 3.18 — laboratório Windows/PowerShell preparado

Base: commit 10040e8faede2457ef4b8464c16f747373d0887f, branch
security/stage-2-3-structural-privileges. Preparação apenas: stack não iniciado,
nenhum SQL remoto/local, migration ou .sql.pending executado; aplicação intocada.
A PR deve continuar em rascunho. Este material não autoriza testes ou produção.

## Homologação documental — Etapa 3.20

[Versões disponíveis, catálogo oficial e regra definitiva](supabase-lab-homologation-320.md).
Transferências entre organizações são proibidas inclusive para service_role;
esta decisão não habilita flags nem aprova aplicação do SQL. Pins continuam
pendentes até homologação operacional no Windows.

## Revisão estática posterior — Etapa 3.19

[Relatório de revisão e 42 checks aprovados](supabase-lab-review-319.md).
Os resultados de 18 checks abaixo são históricos da Etapa 3.18. Os cinco scripts
foram reforçados sem iniciar serviços ou executar SQL; validação Windows continua
pendente e as aprovações do manifesto permanecem false.

## Arquivos e inventário de versões

Manifesto: `tools/supabase-lab/lab.manifest.json`. Identidade própria
`washsense-security-lab-318`, destinos loopback, portas reservadas 54321–54324,
Auth/email exclusivamente locais e todas as aprovações desabilitadas.
Configuração independente não significa ambiente iniciado.

| Dependência | Estado e requisito |
|---|---|
| Windows | Windows 11 x64 em máquina/VM dedicada a homologar; validação Windows ainda não executada |
| PowerShell | 7.4.6 ou superior; parser/guards testados em 7.4.6 Linux; não usar Windows PowerShell 5.1 |
| Docker Desktop/Engine | Linux containers em endpoint named pipe local; versão do Desktop e backend WSL2/Hyper-V devem ser registradas e homologadas |
| Docker server | Histórico local 28.4.0; dockerServerExact permanece null até homologação no Windows, não é pin de produção |
| Supabase CLI | supabaseCliExact null; instalação/versionamento ainda pendentes; não inventar versão compatível |
| PostgreSQL | Major 17 obrigatório; remoto informado 17.6, teste PostgreSQL puro anterior 17.11 |
| Imagens Supabase | Lista de referências por digest vazia; bloqueio obrigatório até fechar inventário do CLI escolhido |

7.4.6 é o mínimo de capacidade exercitado nesta preparação, não recomendação
para instalar um patch antigo: homologar patch suportado e atualizado no Windows.

O digest histórico de postgres:17 pertence ao teste PostgreSQL puro: não é a imagem
Supabase PostgreSQL com suas extensões e não preenche o inventário Supabase.
Registrar CLI/binário (hash/verificação do fornecedor), Docker Desktop/Engine,
backend, arquitetura e todos os digests do stack homologado. Nenhum download
ou atualização automática é realizado pelos scripts. O laboratório só será
reproduzível operacionalmente depois de preencher/revisar esses pins e artifacts.

## Scripts e comandos autorizados nesta preparação

Usar pwsh -NoProfile, diretório do checkout e usuário dedicado sem credenciais
Supabase/Asaas/DB. Não desativar ExecutionPolicy globalmente. Verificar origem,
hashes e assinatura dos scripts conforme política local.

```powershell
pwsh -NoProfile -File .\tools\supabase-lab\Test-LabScripts.ps1
pwsh -NoProfile -File .\tools\supabase-lab\Test-LabPrerequisites.ps1 -StaticOnly
```

Esses comandos verificam parser, manifest e guards com fixtures inertes/mocks;
não executam Docker, Supabase, SQL ou HTTP. O runner pode criar e apagar apenas
um diretório temporário próprio para manifests e arquivo sintético inerte.

Para preparar um diretório novo (sem stack, sem CLI init):

```powershell
$lab = Join-Path ([IO.Path]::GetTempPath()) ('washsense-lab-' + [guid]::NewGuid().ToString('N'))
pwsh -NoProfile -File .\tools\supabase-lab\New-LabWorkspace.ps1 -LabRoot $lab
```

O script copia apenas o manifesto pendente. Rejeita destino existente, fora do
temporário ou ancestral reparse point. Não copia .env, aplicação, credenciais,
SQLs ou configuração de produção. Não cria supabase/config.toml nem faz init.
Revisar ACL do diretório com Get-Acl e restringir acesso ao usuário do laboratório
antes de guardar status/chaves locais; o script não altera ACLs da máquina.

## Bloqueios objetivos antes dos testes (execução futura)

`Test-LabPrerequisites.ps1 -LabRoot <diretório> -ManifestPath <manifesto local>`
falha com erro se qualquer pré-condição faltar. Não inicia stack mesmo se passar.
Executar esse modo apenas em revisão futura do laboratório Windows.

1. Windows/PowerShell suportados, root explícito e perfil dedicado revisado.
2. Ausência de variáveis SUPABASE/ASAAS/DB/PG e overrides Docker. Valores não são
   lidos/exibidos. Recusa token files conhecidos, .env, project-ref e reparse points.
3. CLI/Docker com versões exatas revisadas; CLI só invocada com --version.
4. Context Docker local named pipe e daemon Linux; TCP/SSH/remoto recusados antes
   de consultar daemon. Nenhuma seleção/alteração de contexto automática.
5. Digests de imagens homologadas e já em cache; não há pull. Falha de cmdlet de
   portas não é interpretada como porta livre; listeners IPv4/IPv6 bloqueiam início.
6. Pacote estrutural e config.toml revisados, com SHA-256 correspondente e nomes
   simples dentro do laboratório (sem traversal). Config deve declarar major 17,
   identidade/portas do manifesto, Auth local e desligar serviços externos.
7. Evidência de política de egress revisada e com hash, aprovações explícitas de
   início e testes. Flags/hashes não são mecanismo de autorização: registrar revisor,
   contexto e evidência fora do código; não trocar false por true para contornar gates.
8. Configuração completa/portas de serviços opcionais da versão escolhida: desativar
   analytics/pooler se desnecessários ou propor inventário adicional revisado. Não
   permitir portas desconhecidas para fazer um start passar.

A checagem de credenciais não prova ausência de todo segredo: OS Credential
Manager/keychain, caminhos adicionais do CLI, perfis personalizados e artifacts
externos exigem revisão humana. `cleanOsProfileReviewed` e
`credentialStoreReviewApproved` começam false e bloqueiam prontidão. Não pedir
nem fornecer segredos privados no chat. Não fazer login CLI no perfil do lab.

Não existe script de start/import/migration nem encaminhamento arbitrário de
argumentos CLI neste pacote. Os scripts impedem os caminhos que controlam;
não são firewall nem impedem um administrador de executar ferramentas à parte.

## Pacote estrutural sanitizado: obtenção e revisão

Nenhuma exportação é executada nesta etapa. Um responsável autorizado deve,
em tarefa separada, preparar exportação **somente schema/metadados** por ferramenta
oficial em canal autorizado, sem db pull, dump de dados ou cópia de produção para
o runner. Não solicitar credenciais no chat. Autorizar previamente a inspeção/
exportação, destino e acesso ao arquivo. Não usar arquivos de tokens como insumo.

Conteúdo necessário: 19 tabelas, enums/extensões necessários, colunas e nullability,
PK/FK/constraints/índices, ACLs de tabela/coluna/schema/função/defaults, policies,
assinaturas/corpos/owners/search_path dos helpers e dependências de auth.users.
A estrutura Auth gerenciada deve vir do stack local: revisar diferenças antes
de importar objetos da aplicação; não sobrescrever schemas internos Supabase.
Os 66 triggers internos serão gerados pelas constraints, não copiados à mão.

Revisão por dois responsáveis, em viewer/editor que não execute SQL:

- verificar ausência de COPY/INSERT de linhas, arquivos de dados e dumps de auth;
- identificar segredos embutidos em funções, comentários, defaults, URLs, hooks,
  FDWs, subscriptions, jobs pg_cron, chamadas HTTP/dblink e comandos externos;
- impedir endpoints/segredos reais, extensões ou rotinas com efeitos externos
  não revisados; owners/grants administrativos devem corresponder ao stack local;
- preservar definições de autorização; remoção de segredo deve ser registrada
  como divergência, não corrigir uma policy para fazer o teste passar;
- distinguir DML dentro de um corpo de função da inclusão de registros reais:
  regex simples não é certificação de sanitização;
- revisar statements executáveis, psql metacommands/includes e SQL dinâmico;
  uma exportação schema-only não é automaticamente segura para executar;
- registrar origem autorizada, data, revisores, diferenças e hash de todos arquivos.

Guardar o artifact como `structure.sql.pending` fora de supabase/migrations,
no laboratório, sem versionar dados/segredos. Um único arquivo autocontido
simplifica a verificação de hash; se houver dependências/includes, exigir manifesto
com hashes e revisão de cada arquivo antes de ampliar o tooling. Nada é importado
pelos scripts atuais. `reviewApproved`, `reviewRecord` e SHA-256 começam pendentes.
A sanitização bloqueia uso de artifacts suspeitos; não silenciar isso com flags.

## Rede e Auth: verificação futura, não executada agora

Homologar config.toml gerado pela versão pinada em workspace descartável em etapa
aprovada. Revisar conteúdo completo, hash e defaults; o manifesto sozinho não
configura Supabase. Cli start/init/import seguem fora desta etapa.

Docker pode publicar 0.0.0.0/:: por default; exigir loopback efetivo e firewall
que bloqueie acesso LAN/WAN. Bloquear egress dos containers sem impedir comunicação
interna/email local. Aprovar implementação específica do Docker Desktop/Windows
Firewall e registrar evidência; scripts não alteram firewall ou redes.
Testar saída externa negada, comunicação interna preservada e acesso remoto às
portas negado. Inspeção de ports/URL não demonstra egress bloqueado.

`Test-LabRuntime.ps1` é preparado para tarefa FUTURA, com stack já autorizado.
Usa label de projeto do CLI a homologar, inspeciona apenas containers do lab,
recusa host network/publicação não loopback/portas extras e faz GET sem redirects
na health Auth local (IP loopback literal, proxy e redirects desabilitados). Nenhum start, SQL, login/signup ou escrita. Falta de label
ou Auth health falha é bloqueio; não reinterpretar como sucesso. A versão escolhida
pode exigir apikey local na health: revisar esse detalhe sem enfraquecer os gates.

Depois ainda confirmar versão real do PostgreSQL, digests em runtime, grants,
schema, settings Auth reais e isolation egress. Health 200 não valida fluxo Auth.
Testar signup/confirmação/login/refresh/logout/recuperação usando usuários
@example.test e caixa de email local, chaves geradas no stack e nenhum provedor
externo. Nunca logar JWT, passwords ou service key. A matriz completa está em
[supabase-local-validation.md](supabase-local-validation.md).

## Resultados e próximas autorizações

Agora: documentação/manifest/scripts preparados; 18 verificações de parser e guards aprovadas via
PowerShell 7.4.6 Linux, com archive conferido contra SHA-256 do release oficial.
Não há equivalência Windows demonstrada. `git diff --check` e hashes de SQLs
protegidos verificados. Não se reexecutou a suíte PostgreSQL que aplica rascunho.

Ainda requerem aprovação/insumos: homologar versões/images no Windows; obter e
revisar pacote estrutural e config; validar perfil limpo/firewall/egress; iniciar
stack local em etapa própria; preparar e executar fixtures/testes Auth/SQL e
benchmark. Executar a proposta de segurança permanece uma aprovação separada.
Nenhuma autorização para produção, deploy, merge ou mudança de estado da PR.

Consulta do estado da PR via GitHub CLI falhou com `Forbidden` na API GraphQL.
Nenhum estado de PR foi alterado; confirmar manualmente que permanece Draft
antes de qualquer aprovação. Push da branch não equivale a merge ou ready-for-review.
