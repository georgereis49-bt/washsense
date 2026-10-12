# WashSense — auditoria inicial das Edge Functions implantadas (2026-10-12)

**Origem:** leitura direta de metadados e código das funções no projeto Supabase `eydrrfuzfcxcqdivvued`. **Nenhuma chamada a endpoint financeiro, SQL de escrita, deploy ou pagamento foi realizada.** A existência e a versão implantada não provam funcionamento ponta a ponta.

## Inventário confirmado no Supabase remoto

| Função | Versão | verify_jwt | Situação |
| --- | ---: | --- | --- |
| lookup-energy-tariff | 9 | false | ACTIVE |
| infinitepay-webhook | 3 | false | ACTIVE |
| asaas-create-subscription | 2 | true | ACTIVE |
| asaas-webhook | 3 | false | ACTIVE |
| asaas-get-pix | 1 | true | ACTIVE |
| asaas-get-boleto | 1 | true | ACTIVE |
| asaas-pay-credit-card | 4 | true | ACTIVE |
| asaas-set-recurring-card | 3 | true | ACTIVE |

`sync-energy-tariffs` está versionada no GitHub, mas **não aparece na lista de funções implantadas**.

## Achados de segurança que bloqueiam aprovação do financeiro

**CRÍTICO — asaas-webhook (v3):** o código faz `if (webhookToken) { ... validar ... }`. Se `ASAAS_WEBHOOK_TOKEN` estiver ausente ou vazio, **aceita requisições sem validar token**, mesmo com `verify_jwt=false`. A função usa `SUPABASE_SERVICE_ROLE_KEY` para upsert em `payments` e atualizar `subscriptions`. A configuração real do secret não foi lida. Corrigir para **falhar fechado** quando o secret não existir; validar origem/token antes de qualquer escrita; testar eventos repetidos e fora de ordem.

**ALTO — asaas-create-subscription (v2):** `verify_jwt=true` no gateway, porém o código recuperado não chama `auth.getUser()` nem confirma que o `organizationId` enviado no corpo pertence ao usuário. Aceita `value` do cliente (padrão 149) e cria cliente/assinatura no Asaas Sandbox. JWT válido **não equivale a autorização por organização**. Adicionar verificação de sessão, papel autorizado, plano/valor server-side, e proteção contra duplicidade antes de ativar fluxo.

**ALTO — asaas-webhook:** atualiza status de assinatura baseado em eventos e `externalReference` do payload, sem ledger de idempotência de eventos nem verificação de ordenação de estado demonstrada no código recuperado. O upsert de pagamento por `provider,provider_payment_id` ajuda a evitar duplicação da linha, mas **não garante processamento idempotente do evento nem protege contra regressão de status**. A escrita em `subscriptions` não verifica explicitamente o erro retornado.

**MÉDIO — infinitepay-webhook (v3):** `verify_jwt=false`, recebe e registra payload sem autenticação explícita no código; não grava nem ativa assinaturas. Ainda não deve ser considerado fonte confiável de confirmação de pagamento.

**PENDÊNCIA — asaas-get-pix, asaas-get-boleto, asaas-pay-credit-card, asaas-set-recurring-card:** funções ativas com `verify_jwt=true`. As duas de consulta verificam usuário e filtram cobrança por organização. As duas de cartão têm autenticação e consultas por organização no código; falta teste isolado detalhado de autorização, repetição, payload, erros e tratamento de dados de cartão. O código das quatro funções não está no GitHub. As chamadas Asaas recuperadas usam Sandbox; isso **não comprova** que a configuração financeira está pronta para produção.

## Próxima execução técnica

1. Recuperar e versionar as oito funções com revisão para não introduzir credenciais nem publicar código inseguro como deploy automático.
2. Criar correções propostas para webhook (falhar fechado, idempotência e transições), criação de assinatura (autorização organizacional e preço server-side) e tratamento de dados de cartão.
3. Rodar testes isolados com Asaas simulado, JWT fictício e banco descartável; testar cross-tenant, replay, webhook sem token, eventos fora de ordem e falhas parciais.
4. Inspecionar, em leitura, políticas reais de `payments`, `subscriptions` e permissões; não executar SQL de escrita em produção.
5. Reavaliar liberação apenas após resultados reproduzíveis e plano de rollback.

**Estado:** AUDITORIA INICIAL; FINANCEIRO NÃO LIBERADO PARA PRODUÇÃO. Nenhum deploy/migração/pagamento efetuado.
