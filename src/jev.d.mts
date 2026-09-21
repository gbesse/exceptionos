// Purpose: Type the optional Jev adapter and injected provider contract.
import type { Provider, DecisionRecord } from '@gbesse/decisionpacks';
export interface JevOptions { provider?: Provider; signal?: AbortSignal }
import type { Desk } from './index.mjs';
export function proposeWithJev(desk: Desk, caseId: string, options?: JevOptions): Promise<{ caseId: string; proposedSku: null; reason: 'no_compatible_catalog_candidate' } | { caseId: string; revision: number; proposedSku: string | null; probability: number; requiresReview: true; record: DecisionRecord }>;
