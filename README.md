# WashSense — Plataforma integrada

Interface SaaS para gestão de lavanderias com a identidade Atlântico Preciso, navegação SPA, temas claro/escuro e suporte responsivo.

```sh
npm ci
npm run dev
```

- `/index.html`: site público.
- `/login.html`: autenticação Supabase.
- `/app.html#/visao-geral`: plataforma autenticada.
- `/app.html#/visao-geral?demo=1`: demonstração explicitamente identificada, sem acesso a pagamentos.

A plataforma reúne visão geral, máquinas, reservatórios, consumo, energia, alertas, financeiro, relatórios e configurações. URLs anteriores continuam funcionando através de redirecionamentos compatíveis.

```sh
npm run typecheck
npm run build
npm test
```

Os testes de navegador usam Chromium instalado em `/usr/bin/chromium`; configure `PLAYWRIGHT_CHROMIUM_PATH` quando necessário. Testes de integração de UI usam fixtures e bloqueiam pagamentos reais.

Consulte [a documentação do redesign](docs-redesign.md) para arquitetura, validação e limitações dos dados demonstrativos existentes. As integrações financeiras e tarifárias mantêm seus contratos originais; não há alteração de banco, RLS ou Edge Functions nesta migração.
