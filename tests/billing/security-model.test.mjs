import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyWebhookToken, authorizeBillingOrganization, resolvePlanPrice, acceptEventOnce, shouldApplyPaymentStatus } from './security-model.mjs';

const token = 'sandbox_webhook_token_at_least_24_chars';
test('webhook fails closed without configured token', () => {
  assert.equal(verifyWebhookToken(undefined, token), false);
  assert.equal(verifyWebhookToken('', token), false);
  assert.equal(verifyWebhookToken('short', 'short'), false);
});
test('webhook rejects absent or incorrect token', () => {
  assert.equal(verifyWebhookToken(token, undefined), false);
  assert.equal(verifyWebhookToken(token, token + 'x'), false);
  assert.equal(verifyWebhookToken(token, token.replace('sandbox', 'another')), false);
  assert.equal(verifyWebhookToken(token, token), true);
});
const members = [{ user_id: 'u1', organization_id: 'org1', role: 'owner' }, { user_id: 'u2', organization_id: 'org1', role: 'viewer' }];
test('billing authorization enforces membership, tenant and role', () => {
  assert.equal(authorizeBillingOrganization('u1', 'org1', members), true);
  assert.equal(authorizeBillingOrganization('u1', 'org2', members), false);
  assert.equal(authorizeBillingOrganization('u2', 'org1', members), false);
  assert.equal(authorizeBillingOrganization('u3', 'org1', members), false);
});
test('price comes from active server plan only', () => {
  const plans = [{ id: 'pro', active: true, amount_cents: 14900 }, { id: 'old', active: false, amount_cents: 1 }];
  assert.equal(resolvePlanPrice('pro', plans), 14900);
  assert.equal(resolvePlanPrice('old', plans), null);
  assert.equal(resolvePlanPrice('fake', plans), null);
});
test('replayed webhook event is rejected', () => {
  assert.equal(acceptEventOnce({ id: 'evt1' }, ['evt1']), false);
  assert.equal(acceptEventOnce({ id: 'evt2' }, ['evt1']), true);
  assert.equal(acceptEventOnce({ event: 'PAYMENT_RECEIVED' }, []), false);
});
test('old events and paid-to-pending regressions are rejected', () => {
  assert.equal(shouldApplyPaymentStatus('RECEIVED', 'PENDING', '2026-10-12T10:00:00Z', null), false);
  assert.equal(shouldApplyPaymentStatus('PENDING', 'RECEIVED', '2026-10-11T10:00:00Z', '2026-10-12T10:00:00Z'), false);
  assert.equal(shouldApplyPaymentStatus('PENDING', 'RECEIVED', '2026-10-12T10:00:00Z', null), true);
  assert.equal(shouldApplyPaymentStatus('REFUNDED', 'RECEIVED', '2026-10-12T10:00:00Z', null), false);
});
