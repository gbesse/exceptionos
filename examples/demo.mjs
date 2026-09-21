// Purpose: Demonstrate learning a reviewed reference precedent and reusing it on a later exception.
import { createDesk, openCase, resolveCase, suggest, prepareERPChange } from '../src/index.mjs';
import { catalog, order } from './fixtures.mjs';
let desk = openCase(createDesk(catalog), order, 'demo-operator');
desk = resolveCase(desk, order.id, { sku: 'PAPER-A4-500', actor: 'demo-reviewer', note: 'Supplier document confirms the replacement reference.', expectedRevision: 0 });
desk = openCase(desk, { ...order, id: 'order-2-line-1' }, 'demo-operator');
console.log(JSON.stringify({ source: 'synthetic example; no model or ERP call', nextCase: suggest(desk, 'order-2-line-1'), prepared: prepareERPChange(desk, order.id) }, null, 2));
