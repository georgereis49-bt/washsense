# Etapa 3.21 — armazenamento local e diretórios do laboratório

Base: e4f9205f38e731d33ec6c74da70978ac63f54921, branch de segurança.
Nenhum serviço iniciado, SQL/migration executado ou banco remoto acessado.
SQLs protegidos, manifesto/flags e aplicação preservados.

## Problemas e correções

A validação anterior aceitava o temporário como pressuposto de localização local.
Um TEMP/TMP UNC ou drive mapeado poderia satisfazer o prefixo, antes da inspeção
filesystem. Também o temporário em si com separador final podia passar como
subdiretório. Essas validações foram reforçadas sem autorizar execução de serviços.

- Get-NormalizedLocalPath exige caminho absoluto de filesystem. Recusa UNC,
  namespaces de dispositivo/extended UNC, URLs, providers, drive-relative,
  sintaxe Windows no Linux e ADS/colon em caminhos não permitidos. Normaliza
  componentes . e .. antes de operações. Caminhos relativos deixam de ser aceitos.
- Assert-LabDirectory comprova armazenamento tanto do temporário retornado pelo
  OS quanto do destino antes de Test-Path/Get-Item; temporário precisa estar sem
  reparse points, e destino deve ser subdiretório estrito, não a própria raiz.
- Windows: Get-PSDrive deve ser FileSystem com raiz de drive convencional,
  sem DisplayRoot/redirecionamento divergentes, e DriveInfo.DriveType deve ser
  Fixed. Network, Unknown, removable e metadados indisponíveis falham. Mapeamentos
  detectados são rejeitados antes de consultar DriveInfo. Nenhum share é enumerado.
- Linux: /proc/self/mountinfo é consultado localmente, usando o mount mais
  específico com limite de componente. Mounts iguais ambíguos com tipo não
  permitido falham. Somente tmpfs/ramfs/ext2/ext3/ext4/xfs/btrfs comprovam storage
  para o laboratório; NFS/CIFS/SMB/FUSE/9p/overlay e desconhecidos são recusados.
  Metadata ausente/inválida falha; não existe fallback de aprovação.
- Assert-NoReparsePath normaliza e inspeciona ancestrais de cima para baixo.
  No Windows comprova drive antes dos probes. No Linux verifica o mount de cada
  ancestral antes de Get-Item, bloqueando acessos a mounts de rede. Overlay é
  aceito SOMENTE para inspeção de metadados de ancestrais/checkout (como /),
  nunca como prova de backing local para temp/destino do laboratório.
- New-LabWorkspace, pré-requisitos, runtime, verificação de credenciais e artifacts
  utilizam caminhos normalizados nas operações posteriores. Não se valida um
  caminho normalizado para depois ler seu original com link/.. distinto.
- O runner estático valida o destino antes de criar suas próprias fixtures.
  Seu temporário remoto/desconhecido também bloqueia os testes, sem contornar gates.

Essas regras são conservadoras: volumes removíveis, macOS e laboratórios Linux
sobre overlay/FUSE ficam bloqueados. Não alterar allowlists para conseguir PASS;
uma nova configuração requer justificativa e revisão. Nenhuma flag foi habilitada.
O manifesto continua pendente e o laboratório não foi iniciado.

## Testes efetivamente executados

PowerShell 7.4.6 Linux, -NoProfile, no ambiente Debian 13. /tmp foi identificado
por mountinfo como tmpfs; o checkout está sobre overlay. Não foi consultado daemon
Docker nem executado o script runtime/full prerequisites.

- Test-LabScripts.ps1: **79 checks aprovados**, exit 0.
- Test-LabPrerequisites.ps1 -StaticOnly: PASS, exit 0, Readiness NOT approved.
- git diff --check aprovado.
- SHA-256 dos seis SQLs protegidos e manifesto comparado ao início: idênticos.

A suíte mantém os 42 checks da Etapa 3.19 e adiciona 37:

| Grupo adicionado | Casos | Resultado |
|---|---:|---|
| Política Windows por metadata sintética | 7 | Fixed aceito; network/unknown/removable/mapping/provider/UNC rejeitados |
| Classificação filesystem Linux sintética | 10 | tmpfs/ext4 aceitos; nfs/nfs4/cifs/smb3/fuse.sshfs/9p/overlay/unknown rejeitados |
| Mounts específicos, ambíguos, ausentes e inválidos | 4 | Rejeitados antes de acesso ao destino |
| Caminhos UNC/namespace/URL/provider/drive-relative/relativo | 8 | Rejeitados sem shares ou probes de rede |
| Normalização e diretório local existente | 2 | Aceitos |
| Raiz do temporário, prefixo semelhante e escape por .. | 3 | Rejeitados |
| Política de inspeção de ancestral overlay versus CIFS | 2 | Overlay metadata aceito; CIFS metadata rejeitado |
| Temporário UNC simulado com sentry de probes | 1 | Rejeitado antes de qualquer prova/storage/ancestry IO |

Os testes novos de Windows usam apenas objetos sintéticos. O caso de TEMP UNC
substitui a função de obtenção do temporário e instala sentry de prova de storage;
as funções são restauradas em finally. Nenhum compartilhamento real é acessado.
Os symlinks reais anteriores são locais, no Linux; fixtures não contêm credenciais,
dados de clientes ou SQL executável. Arquivo .sql.pending inerte é apenas hashed,
nunca executado, e todas as fixtures próprias são removidas.

## Limites e homologação Windows pendente

Executar posteriormente em Windows 11/PowerShell 7 sob conta dedicada:

1. Diretório TEMP/TMP em volume local Fixed/NTFS, com subdiretório normal e . / ..
   normalizados, diferenças de caixa, barras e separadores finais. Confirmar que
   a raiz do temporário não passa e que paths não normalizados não são reutilizados.
2. UNC e namespaces \??/\\?\ /\\.\: usar somente paths sintéticos e mocks, sem
   shares reais. Testar drives mapeados/PSDrives com metadata substituída e prova
   de que nenhum Get-Item/Test-Path no destino ocorre após rejeição. Não é necessário
   conectar a um share para testar a política.
3. Coleta real de metadata de drive LOCAL, Get-PSDrive/DisplayRoot/DriveInfo, acesso
   negado, nomes não convencionais/subst/redirecionamentos. Mocks Linux não provam
   comportamento dos APIs Windows. Se não puder comprovar Fixed local, bloquear.
4. Junctions/symlinks/reparse points reais criados entre diretórios locais de teste,
   incluindo raiz, ancestral, artifact e alvo ausente. Requer permissões locais
   apropriadas; não elevar privilégios silenciosamente nem remover a proteção.
5. ACL NTFS restrita, perfil/credential store e TEMP configurados antes dos testes.
   Sem alterar o temporário global, usar processo de teste isolado; não ler tokens.

No Linux, comprovação por mountinfo é uma política no namespace do processo, não
atestado físico do hardware/backing de volumes; classes desconhecidas são negadas.
Ainda ensaiar leitura negada de mountinfo, escapes octais, bind mounts, mounts
sobrepostos e mudanças de namespace em runner isolado. Não usar shares reais.

Race residual: outro processo privilegiado/com escrita pode trocar mounts,
junctions ou artifacts depois da validação. Não há lock atômico entre inspeção e
uso; não apresentar guards como isolamento contra administrador host malicioso.
Conta dedicada, ACLs restritas e política de OS são pré-condições; concorrência
adversarial de diretórios requer ensaio separado no Windows. Não emitir afirmação
de prontidão com base apenas nos checks sintéticos.

## Próxima etapa

Storage guard corrigido; homologação operacional continua pendente: Windows,
Desktop/CLI/images, pacote sanitizado, configuração, ACLs/credential store/egress.
Nenhum script novo de startup, importação ou SQL. Pins e aprovações continuam
pendentes. Publicar a branch não autoriza produção, merge ou ready-for-review.
Estado Draft da PR não alterado; confirmação pela API permanece uma pendência
quando o acesso GitHub GraphQL estiver disponível.
