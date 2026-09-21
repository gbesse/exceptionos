# ExceptionOS

A review desk for broken order references that remembers the resolutions your team approves.

**Public alpha · Node.js 22+ · MIT · JavaScript SDK + CLI.** Given an obsolete supplier reference, propose catalog candidates, record a human resolution, reuse it in the same customer scope, and export a proposed ERP change. Jev can rank the supplied candidates; approval remains a separate operation.

## Try the complete workflow

```sh
git clone https://github.com/gbesse/exceptionos.git
cd exceptionos
npm ci --ignore-scripts
npm run demo
node examples/write-fixtures.mjs
node bin/exceptionos.mjs init local-data/catalog.json local-data/desk0.json
node bin/exceptionos.mjs open local-data/desk0.json local-data/case.json demo-operator local-data/desk1.json
node bin/exceptionos.mjs suggest local-data/desk1.json order-1-line-1
node bin/exceptionos.mjs resolve local-data/desk1.json order-1-line-1 local-data/resolution.json local-data/desk2.json
node bin/exceptionos.mjs prepare local-data/desk2.json order-1-line-1
```

The final document preserves the quantity and unit, identifies the reviewer, and declares `execution: "not_executed"`. Every output snapshot uses a new filename. The demo opens a second case to demonstrate reuse of the first reviewed precedent.

## Embed it

```sh
npm install github:gbesse/exceptionos#v0.1.0
```

```js
import { createDesk, openCase, suggest, resolveCase, prepareERPChange } from '@gbesse/exceptionos';
let desk = createDesk(catalog); // Your CatalogItem[]
desk = openCase(desk, orderLine, 'authenticated-operator');
const suggestion = suggest(desk, orderLine.id);
// After your host application obtains and authenticates a review:
desk = resolveCase(desk, orderLine.id, {
  sku: reviewedSku, actor: reviewerId, note: reviewReason,
  expectedRevision: suggestion.revision,
});
const proposal = prepareERPChange(desk, orderLine.id);
```

Types ship with the package. Functions return new snapshots; the caller owns storage and revision control. See [the declared data model](src/index.d.mts).

## Optional Jev proposal

Set `TYPESAFE_API_KEY` in your environment, then run:

```sh
node bin/exceptionos.mjs jev local-data/desk1.json order-1-line-1
```

The SDK equivalent is `proposeWithJev(desk, caseId, { provider?, signal? })` from `@gbesse/exceptionos/jev`. It sends the order description and up to 50 scoped catalog candidates. With no compatible candidates it returns without calling the API. A returned probability is a model signal, not measured accuracy.

## What makes a precedent reusable

Its exact scope includes tenant, customer, supplier, normalized old reference and unit. Normalization trims, applies Unicode NFKC and uppercases the reference. Conflicting active mappings return `conflicting_precedents`. Inactive items, changed catalog fingerprints and revoked precedents prevent reuse. Reusing a suggestion still requires an explicit resolution.

The lexical candidate score counts overlapping words; it is not semantic similarity. Equal unit strings do not certify equal packaging. Reviewers must verify pack sizes and specifications. MatchGraph can represent richer cross-supplier evidence separately.

## Boundaries

This alpha has no web inbox, authentication, ERP connector or background automation. Exporting a proposal never changes an ERP. Imported snapshots and reviewer identities must come from trusted host storage. A hash-linked audit trail detects inconsistent edits; an attacker who controls a snapshot can rewrite and rehash it. It is not a signed authorization record. There is no hosted service or cross-customer learning.

The possible long-term advantage is the accumulating, customer-scoped resolution history and the integrations built around it. Today this repository provides the workflow and data format; it does not already have a customer dataset or distribution moat.

## Validation and Jev integration

```sh
npm run typecheck
npm run check
npm test
npm run demo
```

CI runs these checks on Node.js 22 and 24 without a build step. Tests use fictional fixtures and injected model responses. **No live Jev call or model-quality benchmark was performed for this release.** The default adapter targets `jev-1.13.0` through the pinned [DecisionPacks](https://github.com/gbesse/decisionpacks) dependency, with response validation and explicit timeouts. Live requests require your TypeSafe account and may incur charges. See [TypeSafe's API documentation](https://docs.typesafe.ai/api) and [model documentation](https://docs.typesafe.ai/models).

Library errors propagate; CLI failures print to stderr and exit nonzero. Embedding applications own error reporting and administrator alerts. There is no telemetry or configured email service. See [SECURITY.md](SECURITY.md) and [CONTRIBUTING.md](CONTRIBUTING.md).

## Related projects

[DecisionPacks](https://github.com/gbesse/decisionpacks) · [Autonomy Meter](https://github.com/gbesse/autonomy-meter) · [IntentBus](https://github.com/gbesse/intentbus) · [ExceptionOS](https://github.com/gbesse/exceptionos) · [Agent Mandates](https://github.com/gbesse/agent-mandates) · [MatchGraph](https://github.com/gbesse/matchgraph) · [WorldKit](https://github.com/gbesse/worldkit)

Independent projects; no affiliation with TypeSafe. MIT licensed.
