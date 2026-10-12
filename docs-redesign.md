# WashSense — integrated platform redesign

The authenticated UI now runs in `app.html`, with React/TypeScript controlling a single sidebar, topbar, hash router, session guard and theme. Hash routes work on static hosts without rewrite rules. Old HTML URLs are small compatibility redirects that preserve equipment IDs, report types and configuration tabs; they no longer contain duplicate interfaces.

The existing operational markup and controllers live in `src/platform/modules`. Each controller is an ES-module initializer with a scoped document and navigation adapter. This keeps the established Supabase/Asaas/ANEEL flows while removing global selectors, document reloads and conflicting variables. Modules load on demand and stay mounted during navigation so filters and unsaved inputs survive. Backend schemas, RLS, Edge Functions and API contracts are unchanged. Finance reuses the shared Supabase client and remains unavailable in demonstration mode.

`src/platform/design` provides the Atlântico Preciso tokens, shared controls, loading/empty/error states and consistent presentation. The original logo remains transparent. Inter is self-hosted, icons use named Lucide imports, and motion respects reduced-motion preferences. Reports support browser PDF/print and CSV, with demonstration identification included in exports.

## Run and validate

```sh
npm ci
npm run dev
npm run typecheck
npm run build
npm test
```

Open `/login.html` for authentication, or `/app.html#/visao-geral?demo=1` for an explicitly identified demonstration. No payment actions are enabled in the demonstration.

Browser tests use `/usr/bin/chromium` by default. Set `PLAYWRIGHT_CHROMIUM_PATH` to another installed Chromium executable when needed. Snapshot baselines target Linux Chromium; use `npm run test:update` only for reviewed visual changes.

Tests exercise navigation without document reloads, entity links after refresh, filter/form retention, theme persistence, legacy links, keyboard controls, mobile layouts, WCAG checks, login and organization-scoped finance reads. Supabase responses are intercepted with fixtures; payment mutations are forbidden. Real Asaas payment processing and provider authorization are not exercised.

## Existing limitations retained

Operational metrics, equipment history and report datasets were demonstration data before this change and remain clearly identified. The settings controller supports session drafts rather than database persistence. Energy estimates still use the existing 1,248 kWh demonstration input, Enel SP/B3 mapping and 18% ICMS model; live tariff requests use the unchanged Edge Function. No additional IoT ingestion or organization persistence backend has been invented as part of a visual migration.

The module controllers intentionally remain JavaScript adapters rather than being rewritten wholesale into React business logic. New platform navigation and reusable platform components are TypeScript/React. This preserves the established integration behavior and provides a boundary for future component-by-component migration.

Work is isolated in `redesign/integrated-platform`, based on `origin/main`, so security branch commits and existing uncommitted README/Vite changes are excluded. No production deployment is performed.

## Validation result

The production build and TypeScript check pass. Sixteen Playwright tests pass, including screenshot comparisons and WCAG A/AA audits of operational modules in both themes at 390px, plus login and authenticated finance checks. Responsive navigation is also exercised at 768px and 1440px. The tariff lookup test checks the existing request body and confirms the cached dashboard updates with the same tariff/ICMS cost as the energy screen. CSV downloads identify demonstration data. No payment mutations or production deployment are performed.
