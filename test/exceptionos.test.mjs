// Purpose: Test scoped precedent reuse, stale approvals, conflicting evidence and advisory Jev integration.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createDesk, openCase, resolveCase, suggest, revokePrecedent, prepareERPChange, validateDesk } from '../src/index.mjs';
import { proposeWithJev } from '../src/jev.mjs';
import { catalog, order } from '../examples/fixtures.mjs';
const resolution = { sku: 'PAPER-A4-500', actor: 'reviewer', note: 'Verified supplier mapping.', expectedRevision: 0 };
const opened = () => openCase(createDesk(catalog), order, 'operator');
test('opening a case strips forged status and resolution fields', () => {
  const desk = openCase(createDesk(catalog), { ...order, status: 'resolved', resolution: {} }, 'operator');
  assert.equal(desk.cases[0].status, 'open'); assert.equal(desk.cases[0].resolution, undefined);
});
test('reviewed precedent applies only within the original tenant/customer/supplier/unit', () => {
  const original = opened(); const resolved = resolveCase(original, order.id, resolution);
  assert.equal(original.cases[0].status, 'open');
  let desk = openCase(resolved, { ...order, id: 'next', externalRef: ' old-paper ' }, 'operator');
  assert.equal(suggest(desk, 'next').proposedSku, resolution.sku);
  for (const change of [{ tenantId: 'other' }, { customerId: 'other' }, { supplierId: 'other' }, { unit: 'box' }]) {
    desk = openCase(resolved, { ...order, id: 'different', ...change }, 'operator');
    assert.equal(suggest(desk, 'different').proposedSku, null);
  }
});
test('conflicting reviewed mappings are surfaced instead of picking the most recent', () => {
  let desk = resolveCase(opened(), order.id, resolution);
  desk = openCase(desk, { ...order, id: 'second' }, 'operator');
  desk = resolveCase(desk, 'second', { ...resolution, sku: 'PAPER-A4-250' });
  desk = openCase(desk, { ...order, id: 'third' }, 'operator');
  assert.equal(suggest(desk, 'third').status, 'conflicting_precedents');
  desk = revokePrecedent(desk, desk.precedents[1].id, { actor: 'reviewer', reason: 'Incorrect second mapping' });
  assert.equal(suggest(desk, 'third').proposedSku, resolution.sku);
});
test('approval rejects stale revision, invalid units and inactive catalog targets', () => {
  assert.throws(() => resolveCase(opened(), order.id, { ...resolution, expectedRevision: 2 }), /Stale/);
  assert.throws(() => resolveCase(opened(), order.id, { ...resolution, sku: 'missing' }), /Target/);
  const desk = opened(); desk.catalog[0].active = false;
  assert.throws(() => resolveCase(desk, order.id, resolution), /inactive/);
});
test('catalog revisions invalidate both precedent suggestions and prepared changes', () => {
  let desk = resolveCase(opened(), order.id, resolution);
  desk = openCase(desk, { ...order, id: 'next' }, 'operator');
  desk.catalog[0].description = 'Changed specification';
  assert.equal(suggest(desk, 'next').proposedSku, null);
  assert.throws(() => prepareERPChange(desk, order.id), /Catalog changed/);
});
test('prepared proposals preserve quantities and stable idempotency keys without executing', () => {
  const desk = resolveCase(opened(), order.id, resolution);
  const a = prepareERPChange(desk, order.id), b = prepareERPChange(desk, order.id);
  assert.equal(a.idempotencyKey, b.idempotencyKey); assert.equal(a.quantity, order.quantity); assert.equal(a.execution, 'not_executed');
  assert.throws(() => prepareERPChange(opened(), order.id), /resolved/);
});
test('revocation blocks preparing the previously approved change', () => {
  let desk = resolveCase(opened(), order.id, resolution);
  desk = revokePrecedent(desk, desk.precedents[0].id, { actor: 'reviewer', reason: 'Withdrawn evidence' });
  assert.throws(() => prepareERPChange(desk, order.id), /revoked/);
});
test('invalid identities, duplicate cases and tampered audit chains are rejected', () => {
  assert.throws(() => openCase(opened(), order, 'operator'), /already/);
  assert.throws(() => openCase(createDesk(catalog), { ...order, quantity: 1.5 }, 'operator'), /Quantity/);
  const desk = opened(); desk.audit[0].actor = 'changed'; assert.throws(() => validateDesk(desk), /hash chain/);
});
test('Jev proposes an explicit catalog choice but cannot approve it', async () => {
  const desk = opened(), before = JSON.stringify(desk);
  const result = await proposeWithJev(desk, order.id, { provider: async ({ model, questions }) => ({ model, answers: { candidate: { type: 'choice', choice: 'candidate0', confidence: 1, probabilities: Object.fromEntries(Object.keys(questions.candidate.criteria).map(k => [k, k === 'candidate0' ? 1 : 0])) } } }) });
  assert.equal(result.proposedSku, 'PAPER-A4-500'); assert.equal(result.requiresReview, true); assert.equal(JSON.stringify(desk), before);
});
test('provider errors propagate and empty candidates need no API key', async () => {
  await assert.rejects(proposeWithJev(opened(), order.id, { provider: async () => { throw new Error('offline'); } }), /offline/);
  const desk = opened(); desk.catalog.forEach(p => { p.active = false; });
  assert.equal((await proposeWithJev(desk, order.id)).proposedSku, null);
});
