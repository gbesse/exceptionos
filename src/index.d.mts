// Purpose: Declare the immutable exception-desk API for TypeScript consumers.
export interface CatalogItem { tenantId: string; supplierId: string; sku: string; description: string; unit: string; active: boolean }
export interface CaseInput { id: string; tenantId: string; customerId: string; supplierId: string; externalRef: string; description: string; unit: string; quantity: number }
export interface Resolution { sku: string; actor: string; note: string; catalogFingerprint: string; precedentId: string }
export interface Case extends CaseInput { status: 'open' | 'resolved'; revision: number; resolution?: Resolution }
export interface Precedent { id: string; tenantId: string; customerId: string; supplierId: string; externalRef: string; unit: string; sourceCaseId: string; sku: string; actor: string; note: string; status: 'active' | 'revoked'; catalogFingerprint: string }
export interface AuditEvent { id: string; at: string; type: string; actor: string; details: Record<string, unknown>; previous: string | null; hash: string }
export interface Desk { schemaVersion: 1; catalog: CatalogItem[]; cases: Case[]; precedents: Precedent[]; audit: AuditEvent[] }
export interface Candidate extends CatalogItem { lexicalOverlap: number }
export interface Suggestion { caseId: string; revision: number; status: 'conflicting_precedents' | 'reviewed_precedent' | 'needs_review'; proposedSku: string | null; precedentIds: string[]; candidates: Candidate[] }
export interface ERPChange { schemaVersion: 1; kind: 'order_line.reference_replacement'; idempotencyKey: string; caseId: string; expectedRevision: number; tenantId: string; customerId: string; supplierId: string; fromReference: string; toSku: string; quantity: number; unit: string; approvedBy: string; execution: 'not_executed' }
export function validateDesk(desk: unknown): Desk;
export function createDesk(catalog: CatalogItem[]): Desk;
export function openCase(desk: Desk, input: CaseInput, actor: string): Desk;
export function candidates(desk: Desk, caseId: string): Candidate[];
export function suggest(desk: Desk, caseId: string): Suggestion;
export function resolveCase(desk: Desk, caseId: string, review: { sku: string; actor: string; note: string; expectedRevision: number }): Desk;
export function revokePrecedent(desk: Desk, precedentId: string, review: { actor: string; reason: string }): Desk;
export function prepareERPChange(desk: Desk, caseId: string): ERPChange;
