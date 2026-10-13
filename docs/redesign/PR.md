# WashSense 3.0 — cockpit Atlântico Preciso e redesign de todos os módulos

Base: redesign/integrated-platform
Head: redesign/atlantico-premium-v3
Estado solicitado: Draft

A SPA integrada ainda mantinha a composição visual dos HTMLs antigos. Esta mudança reconstrói o dashboard em React, substitui o sistema visual dos módulos e redesenha máquinas, reservatórios, consumo, energia, alertas, financeiro, relatórios, configurações e login, com temas claro/escuro e layouts próprios para mobile.

Os controladores financeiros e ANEEL, cliente Supabase, Edge Functions, logos e configuração de publicação permanecem sem alterações contra a base. Rotas, filtros, rascunhos, sessão e contratos existentes foram preservados. A única nova dependência é Manrope self-hosted para tipografia; gráficos e equipamentos usam SVG/CSS próprios. Corrigida somente a leitura visual dos milhares brasileiros nas barras do relatório, sem mudar dados/exportação.

Validação: build e TypeScript aprovados; suíte completa com 27 testes aprovados, mais 11 testes dos cenários afetados pelo acabamento final. Playwright/axe verificam acessibilidade, navegação, deep links, contraste, overflow, CSV, login/recuperação e contratos financeiros/ANEEL. Duas rodadas de capturas em dez telas, dois temas e desktop/mobile; tablet e widescreen também verificados. Nenhuma chamada à produção ou cobrança: fixtures interceptadas, tráfego externo bloqueado nos testes.

Ver docs/redesign/README.md, galeria gallery.html, screenshots/round1 e screenshots/round2 e logs em evidence/. Demonstrações operacionais continuam identificadas como demonstração. A validação de contratos com mocks não prova funcionamento dos serviços remotos. Nenhum SQL, migration, deploy ou merge executado.
