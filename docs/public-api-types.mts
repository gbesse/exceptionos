// Purpose: Compile public imports and reject representative invalid calls without executing them.
import { createDesk, openCase, resolveCase, prepareERPChange } from '@gbesse/exceptionos';
import { proposeWithJev } from '@gbesse/exceptionos/jev';
const desk = createDesk([]);
const opened = openCase(desk, { id: '1', tenantId: 'a', customerId: 'b', supplierId: 'c', externalRef: 'd', description: 'paper', unit: 'ream', quantity: 1 }, 'reviewer');
const resolved = resolveCase(opened, '1', { sku: 'PAPER', actor: 'reviewer', note: 'confirmed', expectedRevision: 0 });
const status: 'not_executed' = prepareERPChange(resolved, '1').execution;
void proposeWithJev; void status;
// @ts-expect-error A reviewed case revision is mandatory.
resolveCase(opened, '1', { sku: 'PAPER', actor: 'a', note: 'b' });
