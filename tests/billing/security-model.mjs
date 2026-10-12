export function verifyWebhookToken(expected, received) {
  if (typeof expected !== 'string' || expected.length < 24) return false;
  if (typeof received !== 'string' || received.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ received.charCodeAt(i);
  return diff === 0;
}

export function authorizeBillingOrganization(userId, organizationId, memberships) {
  if (!userId || !organizationId || !Array.isArray(memberships)) return false;
  return memberships.some(m => m.user_id === userId && m.organization_id === organizationId && (m.role === 'owner' || m.role === 'admin'));
}

export function resolvePlanPrice(planId, plans) {
  if (!planId || !Array.isArray(plans)) return null;
  const plan = plans.find(p => p.id === planId && p.active === true);
  if (!plan || !Number.isSafeInteger(plan.amount_cents) || plan.amount_cents <= 0) return null;
  return plan.amount_cents;
}

export function acceptEventOnce(event, processedIds) {
  if (!event || typeof event.id !== 'string' || !event.id.trim() || !Array.isArray(processedIds)) return false;
  return !processedIds.includes(event.id);
}

export function shouldApplyPaymentStatus(current, incoming, eventTime, lastEventTime) {
  const allowed = ['PENDING', 'OVERDUE', 'CONFIRMED', 'RECEIVED', 'REFUNDED'];
  if (!allowed.includes(incoming)) return false;
  if (lastEventTime && (!eventTime || Date.parse(eventTime) <= Date.parse(lastEventTime))) return false;
  if (['CONFIRMED', 'RECEIVED', 'REFUNDED'].includes(current) && ['PENDING', 'OVERDUE'].includes(incoming)) return false;
  if (current === 'REFUNDED' && incoming !== 'REFUNDED') return false;
  return true;
}
