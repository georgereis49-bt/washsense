import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

const pages = ['index', 'login', 'dashboard', 'details', 'finance', 'settings', 'report'];
const scripts = ['dashboard.js', 'details.js', 'finance.js', 'settings.js', 'report.js', 'energy.js'];

test('all published MPA entrypoints exist', () => {
  for (const page of pages) assert.ok(existsSync(page + '.html'), page);
});
test('all published MPA entrypoints are emitted in dist', () => {
  for (const page of pages) assert.ok(existsSync('dist/' + page + '.html'), page);
});
test('all known browser scripts parse with Node', () => {
  for (const file of scripts) {
    assert.ok(existsSync(file), file);
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  }
});
test('all internal page navigation targets resolve to a published page', () => {
  for (const page of pages) {
    const html = readFileSync(page + '.html', 'utf8');
    for (const match of html.matchAll(/\bhref=[\"']([^\"']+\.html)(?:[?#][^\"']*)?[\"']/g)) {
      assert.ok(existsSync(match[1]), page + ' links to missing ' + match[1]);
    }
  }
});
test('no service-role secret literal is committed in browser scripts', () => {
  for (const file of scripts) {
    const code = readFileSync(file, 'utf8');
    assert.doesNotMatch(code, /(?:SUPABASE_SERVICE_ROLE_KEY|sb_secret_[a-zA-Z0-9_-]{10,})\s*[:=]\s*[\"']/);
  }
});
test('billing frontend calls server functions, not direct Asaas API with secret', () => {
  const code = readFileSync('finance.js', 'utf8');
  assert.doesNotMatch(code, /api\.asaas\.com\/v3/);
  for (const name of ['asaas-get-pix', 'asaas-get-boleto', 'asaas-pay-credit-card', 'asaas-set-recurring-card']) {
    assert.ok(code.includes(name), 'billing call not found: ' + name);
  }
});
