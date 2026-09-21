// Purpose: Manage order-reference exceptions and scoped, human-reviewed resolution precedents.
import { randomUUID } from 'node:crypto';
import { fingerprint } from '@gbesse/decisionpacks';
const ensure = (ok, message) => { if (!ok) throw new Error(message); };
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const reference = value => value.trim().normalize('NFKC').toUpperCase();
const scope = row => [row.tenantId, row.customerId, row.supplierId, reference(row.externalRef), row.unit];
const sameScope = (a, b) => JSON.stringify(scope(a)) === JSON.stringify(scope(b));

function validateItem(item) {
  for (const key of ['tenantId', 'supplierId', 'sku', 'description', 'unit']) ensure(nonempty(item?.[key]), `Catalog requires ${key}`);
  ensure(typeof item.active === 'boolean', 'Catalog requires active boolean');
}
function validateCase(row) {
  for (const key of ['id', 'tenantId', 'customerId', 'supplierId', 'externalRef', 'description', 'unit']) ensure(nonempty(row?.[key]), `Case requires ${key}`);
  ensure(Number.isSafeInteger(row.quantity) && row.quantity > 0, 'Quantity must be positive integer units');
}
export function validateDesk(desk) {
  ensure(desk?.schemaVersion === 1 && Array.isArray(desk.catalog) && Array.isArray(desk.cases) && Array.isArray(desk.precedents) && Array.isArray(desk.audit), 'Invalid desk document');
  desk.catalog.forEach(validateItem);
  const keys = desk.catalog.map(item => JSON.stringify([item.tenantId, item.supplierId, item.sku]));
  ensure(new Set(keys).size === keys.length, 'Duplicate catalog identity');
  desk.cases.forEach(row => { validateCase(row); ensure(['open', 'resolved'].includes(row.status) && Number.isSafeInteger(row.revision) && row.revision >= 0, 'Invalid case status or revision'); });
  ensure(new Set(desk.cases.map(c => c.id)).size === desk.cases.length, 'Duplicate case id');
  for (const p of desk.precedents) {
    validateCase({ ...p, id: p.id, description: p.note, quantity: 1 });
    ensure(nonempty(p.sku) && nonempty(p.actor) && ['active', 'revoked'].includes(p.status), 'Invalid precedent');
    ensure(desk.cases.some(c => c.id === p.sourceCaseId), 'Orphan precedent');
  }
  ensure(new Set(desk.precedents.map(p => p.id)).size === desk.precedents.length, 'Duplicate precedent id');
  let previous = null;
  for (const event of desk.audit) {
    const { hash, ...body } = event;
    ensure(body.previous === previous && hash === fingerprint(body), 'Broken audit hash chain'); previous = hash;
  }
  return desk;
}
function audit(desk, type, actor, details) {
  const body = { id: randomUUID(), at: new Date().toISOString(), type, actor, details, previous: desk.audit.at(-1)?.hash ?? null };
  desk.audit.push({ ...body, hash: fingerprint(body) });
}
export function createDesk(catalog) {
  return validateDesk({ schemaVersion: 1, catalog: structuredClone(catalog), cases: [], precedents: [], audit: [] });
}
export function openCase(desk, input, actor) {
  validateDesk(desk); validateCase(input); ensure(nonempty(actor), 'Actor is required');
  ensure(!desk.cases.some(c => c.id === input.id), 'Case id already exists');
  const next = structuredClone(desk);
  // Strip caller-supplied status/resolution fields; only reviewed operations can resolve a case.
  const row = Object.fromEntries(['id', 'tenantId', 'customerId', 'supplierId', 'externalRef', 'description', 'unit', 'quantity'].map(key => [key, input[key]]));
  next.cases.push({ ...row, status: 'open', revision: 0 });
  audit(next, 'case.opened', actor, { caseId: row.id });
  return next;
}
function findCase(desk, id) { const row = desk.cases.find(c => c.id === id); ensure(row, 'Unknown case'); return row; }
function eligibleCatalog(desk, row) { return desk.catalog.filter(item => item.active && item.tenantId === row.tenantId && item.supplierId === row.supplierId && item.unit === row.unit); }
export function candidates(desk, caseId) {
  validateDesk(desk); const row = findCase(desk, caseId);
  const words = new Set(row.description.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
  return eligibleCatalog(desk, row).map(item => ({ ...item, lexicalOverlap: [...new Set(item.description.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])].filter(w => words.has(w)).length })).sort((a, b) => b.lexicalOverlap - a.lexicalOverlap || a.sku.localeCompare(b.sku));
}
export function suggest(desk, caseId) {
  validateDesk(desk); const row = findCase(desk, caseId);
  const valid = eligibleCatalog(desk, row);
  const evidence = desk.precedents.filter(p => p.status === 'active' && sameScope(p, row) && valid.some(item => item.sku === p.sku && fingerprint(item) === p.catalogFingerprint));
  const targets = [...new Set(evidence.map(p => p.sku))];
  return { caseId, revision: row.revision, status: targets.length > 1 ? 'conflicting_precedents' : targets.length === 1 ? 'reviewed_precedent' : 'needs_review', proposedSku: targets.length === 1 ? targets[0] : null, precedentIds: evidence.map(p => p.id), candidates: candidates(desk, caseId).slice(0, 50) };
}
export function resolveCase(desk, caseId, { sku, actor, note, expectedRevision } = {}) {
  validateDesk(desk); const row = findCase(desk, caseId);
  ensure(row.status === 'open', 'Case is already resolved');
  ensure(row.revision === expectedRevision, 'Stale case revision');
  ensure(nonempty(actor) && nonempty(note), 'Resolution requires an actor and a reason');
  const item = eligibleCatalog(desk, row).find(item => item.sku === sku);
  ensure(item, 'Target is inactive, unknown, outside scope or has incompatible units');
  const next = structuredClone(desk), target = findCase(next, caseId), precedentId = randomUUID();
  target.status = 'resolved'; target.revision++;
  target.resolution = { sku, actor, note, catalogFingerprint: fingerprint(item), precedentId };
  next.precedents.push({ ...Object.fromEntries(['tenantId', 'customerId', 'supplierId', 'externalRef', 'unit'].map(k => [k, row[k]])), id: precedentId, sourceCaseId: caseId, sku, actor, note, status: 'active', catalogFingerprint: fingerprint(item) });
  audit(next, 'case.resolved', actor, { caseId, sku, note, precedentId });
  return next;
}
export function revokePrecedent(desk, precedentId, { actor, reason } = {}) {
  validateDesk(desk); ensure(nonempty(actor) && nonempty(reason), 'Revocation needs actor and reason');
  const next = structuredClone(desk), precedent = next.precedents.find(p => p.id === precedentId);
  ensure(precedent?.status === 'active', 'Unknown or already revoked precedent');
  precedent.status = 'revoked'; audit(next, 'precedent.revoked', actor, { precedentId, reason }); return next;
}
export function prepareERPChange(desk, caseId) {
  validateDesk(desk); const row = findCase(desk, caseId);
  ensure(row.status === 'resolved' && row.resolution, 'Only resolved cases can be prepared');
  const item = eligibleCatalog(desk, row).find(item => item.sku === row.resolution.sku);
  ensure(item && fingerprint(item) === row.resolution.catalogFingerprint, 'Catalog changed since review; obtain a fresh review');
  ensure(desk.precedents.some(p => p.id === row.resolution.precedentId && p.status === 'active' && p.sourceCaseId === row.id && p.sku === item.sku && sameScope(p, row)), 'Resolution precedent was revoked or does not match');
  // The adapter emits an idempotent proposal. It never writes to an ERP or changes an order total.
  return { schemaVersion: 1, kind: 'order_line.reference_replacement', idempotencyKey: fingerprint({ caseId, revision: row.revision, resolution: row.resolution }), caseId, expectedRevision: row.revision, tenantId: row.tenantId, customerId: row.customerId, supplierId: row.supplierId, fromReference: row.externalRef, toSku: item.sku, quantity: row.quantity, unit: row.unit, approvedBy: row.resolution.actor, execution: 'not_executed' };
}
