// Purpose: Provide fictional office-supply orders and catalog entries for deterministic demonstrations.
export const catalog = [
  { tenantId: 'demo', supplierId: 'paper-co', sku: 'PAPER-A4-500', description: 'White A4 paper 500 sheet ream', unit: 'ream', active: true },
  { tenantId: 'demo', supplierId: 'paper-co', sku: 'PAPER-A4-250', description: 'White A4 paper 250 sheet ream', unit: 'ream', active: true },
];
export const order = { id: 'order-1-line-1', tenantId: 'demo', customerId: 'school', supplierId: 'paper-co', externalRef: 'OLD-PAPER', description: 'White A4 paper, 500 sheets', unit: 'ream', quantity: 4 };
