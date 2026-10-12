# Etapa 3.19 — revisão estática do laboratório

Base: e10b91dadf3ab9dbc57671d66f18dc6f4458d810 na branch de segurança.
Nenhum Supabase/Docker iniciado, SQL executado, projeto remoto consultado,
migration/deploy/merge realizado. A aplicação e os SQLs anteriores foram preservados.

## Revisão e correções dos cinco scripts

| Arquivo | Achado / correção |
|---|---|
| Lab.Common.ps1 | Flags antes eram avaliadas por truthiness: uma string JSON "false" poderia satisfazer uma aprovação. Agora todas as flags devem ser booleanos reais. Contrato, paths/portas, allowlists vazias e mínimo PowerShell também são verificados |
| Lab.Common.ps1 | Raiz e ancestrais do laboratório agora são inspecionados de cima para baixo, sob o temporário local, antes de acessar descendentes. Links/reparse points de artifacts revisados são recusados. UNC/URL e drives mapeados de manifesto são bloqueados; erro de JSON não imprime seu conteúdo |
| New-LabWorkspace.ps1 | Usa validação compartilhada de root/ancestrais; continua copiando somente o manifesto para diretório novo, sem CLI, config, stack ou SQL |
| Test-LabPrerequisites.ps1 | Valida root antes de Test-Path/recursão. Inspeção de imagens usa endpoint Docker local fixado e aceita apenas referência completa por digest, sem argumento iniciado por opção |
| Test-LabRuntime.ps1 | Rejeita também network mode container:<id>, não apenas container/host. Exige aprovação de testes e perfil limpo; reutiliza verificação de bindings testável sem Docker. Endpoint das chamadas Docker é explícito |
| Test-LabScripts.ps1 | Ampliação de 18 para 42 checks no Linux, incluindo mocks positivos/negativos, flags malformadas, paths e symlinks; nenhuma chamada real de Docker/Supabase/HTTP |

O endpoint Docker é validado antes do daemon e passado explicitamente a info,
image inspect, ps e inspect. Uma troca do contexto padrão entre chamadas não
redireciona essas consultas. Os mocks verificam a fixação do endpoint e rejeição
do remoto antes de qualquer contato. URLs de Auth continuam IP loopback literal,
sem proxy ou redirects. Não foram adicionadas ferramentas de start/link/import.

Manifesto original inalterado: identidade exclusiva, produção apenas como ref
proibido, PostgreSQL major 17, quatro portas locais, Auth/email local, versões
CLI/Docker e images pendentes, todas as aprovações false. A validação estática
não converte essas pendências em prontidão operacional.

## Testes executados e resultados

Ambiente: Linux com PowerShell 7.4.6, arquivo previamente verificado contra o
manifesto SHA-256 oficial do release. PowerShell está em /tmp, sem alteração das
dependências da aplicação. Cache/config/data temporários, execução -NoProfile.

1. Antes das correções: Test-LabScripts.ps1 passou os 18 checks existentes;
   Test-LabPrerequisites.ps1 -StaticOnly passou. Isso evidenciou também a
   cobertura insuficiente dos casos agora adicionados.
2. Depois das correções: Test-LabScripts.ps1 passou **42 checks**, exit code 0.
3. Test-LabPrerequisites.ps1 -StaticOnly executado separadamente: PASS, exit 0,
   informando explicitamente Readiness NOT approved.
4. git diff --check aprovado; seis SQLs de segurança comparados por SHA-256
   e idênticos ao início da tarefa. Nenhum artifact SQL foi executado.

Cobertura dos 42 checks:

| Grupo | Quantidade | Resultado |
|---|---:|---|
| Parser dos cinco scripts | 5 | PASS |
| StaticOnly com comandos Docker/Supabase bloqueados por mocks | 1 | PASS |
| Manifesto entregue sem aprovações/pins fictícios | 1 | PASS |
| Manifestos/nomes/hashes inválidos | 17 | Rejeitados como esperado |
| JSON inválido com erro sanitizado | 1 | Rejeitado sem reproduzir corpo |
| Caminhos de manifesto UNC/URL | 2 | Rejeitados antes da leitura |
| Network mode host/container/container:id sintéticos | 3 | Rejeitados |
| Bindings públicos IPv4/IPv6 e porta extra sintéticos | 3 | Rejeitados |
| Binding loopback válido sintético | 1 | Aceito |
| Variável remota sintética (somente presença) | 1 | Rejeitada; variável removida em finally |
| Context Docker remoto via mock | 1 | Rejeitado sem daemon |
| Context local e endpoint explícito via mock | 1 | Aceito, nenhum Docker real |
| Artifact inerte com hash correspondente | 1 | Aceito, não executado |
| Symlinks reais locais de root, ancestor, artifact e manifesto sob link | 4 | Rejeitados |

As fixtures de arquivo são temporárias, não contêm tokens ou dados de clientes
e são removidas. Mock positivo não é teste do daemon real. Mensagem PASS não
significa autorização para iniciar stack ou testar proposta SQL.

## Pendências de Windows e execução futura

- PowerShell/Windows 11 homologado, diferenças de paths/providers/ACLs,
  UNC/drives mapeados e junctions/reparse points reais. Os quatro casos de symlink
  Linux não substituem Windows; no Windows o runner identifica esses casos como
  não executados, sem exigir permissões extras silenciosamente.
- Docker Desktop/backend Linux, named pipes reais, versões, imagens por digest,
  cmdlet Get-NetTCPConnection/IPv4/IPv6 e erros de permissão. Não executados aqui.
- Perfil OS isolado e Credential Manager: guards de presença não certificam
  ausência de todos os segredos. Revisão humana continua obrigatória.
- Pacote estrutural sanitizado, config.toml revisado/hashes, regras/evidência de
  firewall e egress: pendentes; scripts não configuram nem certificam firewall.
- Runtime local Auth, PostgreSQL/Supabase, fixtures, SQL/RLS, concorrência real,
  recuperação e desempenho: não executados, exigem aprovação própria.

O teste full de pré-requisitos e Test-LabRuntime.ps1 não foram invocados. Nenhuma
aprovação foi habilitada. Referência: [roteiro Windows](supabase-lab-windows.md).

Não alterar o estado da PR: manter Draft, sem ready-for-review ou merge.
A consulta GitHub da etapa anterior havia retornado Forbidden; nesta etapa não
se afirma confirmação remota do estado Draft. Push da branch não muda seu estado.
