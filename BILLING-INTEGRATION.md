# WashSense — Financeiro / Billing

A aba `finance.html` é a interface do financeiro da assinatura do WashSense.

Inclui:
- plano atual;
- próxima cobrança;
- seleção de planos;
- forma de pagamento;
- PIX e boleto como opções de integração;
- histórico de pagamentos;
- estados pago/pendente;
- área de documentos.

Nesta versão, os dados são demonstrativos. Para produção, conectar a um gateway de pagamentos e persistir cobranças no Supabase.

## Estrutura sugerida
- `plans` — já existente.
- `subscriptions` — já existente.
- `billing_customers` — cliente no gateway.
- `payments` — cobranças e status.
- `payment_events` — webhooks/idempotência.

O gateway deverá gerar PIX/boleto e enviar webhooks para atualizar `payments` e o status da `subscriptions`.
