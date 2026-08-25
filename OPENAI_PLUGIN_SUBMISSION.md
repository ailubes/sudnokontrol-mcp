# OpenAI Plugin Submission Package — SudnoKontrol

Prepared for the OpenAI Plugins Directory submission of the public SudnoKontrol MCP server.

## Submission type

- Type: **With MCP**
- MCP URL type: **Universal**
- MCP server URL: `https://api.sk.ukrfish.org/mcp`
- Authentication: **None**
- UI: **None / MCP-only**
- MCP version: `1.0.1`

## Public listing

### Plugin name

**SudnoKontrol — Ukrainian Vessel Registry**

### Short description

Search Ukrainian vessel registries by registration number, vessel name, owner, vessel type, build year, or home port.

### Long description

SudnoKontrol provides read-only access to public data from the Ukrainian State Ship Registry and the Ship Book of Ukraine. Use it to search vessels by registration number, name, owner, vessel type, build year, or home port; look up a vessel by registration number; view aggregate vessel counts; and inspect dataset metadata and available fields. The service supports Cyrillic and Latin registration-number variants and separator-insensitive lookup. SudnoKontrol is an independent service and is not an official government service.

### Website

`https://sk.ukrfish.org/`

### MCP / AI documentation

`https://sk.ukrfish.org/info/ai-agents`

### Privacy policy

`https://sk.ukrfish.org/privacy`

### Terms

`https://sk.ukrfish.org/terms`

### Support

Confirm the current public SudnoKontrol support URL before submission and use that URL in the portal.

### Developer identity

Select the verified individual or business identity in the same OpenAI Platform organization that owns the submission. The public listing, website, privacy policy, terms, and support information should match that identity.

### Category

Select the closest available directory category for **data / research / public information** in the submission portal. Do not guess a category label before seeing the current portal options.

## MCP domain verification

If the portal requests domain verification, host the exact token at:

`https://api.sk.ukrfish.org/.well-known/openai-apps-challenge`

The response must contain **only** the exact token supplied by OpenAI, not JSON or HTML.

## Tools expected from Scan Tools

### `search_vessel_registries`

Purpose: Search public data from the Ukrainian State Ship Registry and Ship Book with free-text and structured filters.

Expected annotations:

- `readOnlyHint: true`
- `openWorldHint: false`
- `destructiveHint: false`
- `idempotentHint: true`

Expected output shape:

- `items`: array of vessel records
- `total`: integer

### `lookup_vessel`

Purpose: Exact vessel lookup by normalized registration number.

Expected annotations:

- `readOnlyHint: true`
- `openWorldHint: false`
- `destructiveHint: false`
- `idempotentHint: true`

Expected output shape includes:

- `registration_number`
- `name`
- optional vessel/owner/build/home-port fields
- `source`
- `source_name`
- `match`
- `web_url`

### `get_registry_stats`

Purpose: Return aggregate vessel counts.

Expected annotations:

- `readOnlyHint: true`
- `openWorldHint: false`
- `destructiveHint: false`
- `idempotentHint: true`

Expected output shape:

- `total_vessels`: integer
- `sources`: array of source/count objects

### `get_dataset_metadata`

Purpose: Describe available datasets, counts, fields, and API metadata.

Expected annotations:

- `readOnlyHint: true`
- `openWorldHint: false`
- `destructiveHint: false`
- `idempotentHint: true`

Expected output shape includes:

- `api`
- `data_sources`
- `example_queries`
- `fields`

## Starter prompts

1. **Is vessel UPS-4249 registered in Ukraine?**
2. **Search the Ukrainian vessel registries for dredgers.**
3. **Find vessels belonging to this company and summarize the matching registry records.**
4. **How many vessels are currently available in the Ukrainian vessel datasets?**
5. **What datasets does SudnoKontrol use and what fields are available?**

## Positive test cases

OpenAI requires at least five positive tests. These fixtures were selected so reviewers can reproduce them without authentication or internal context.

### Positive 1 — exact Cyrillic registration lookup

**User prompt**

`Is vessel УПС-4249 registered in Ukraine?`

**Expected behavior**

Call `lookup_vessel` with `registration_number="УПС-4249"`.

**Expected result shape**

A vessel record containing at least:

- `registration_number: "УПС-4249"`
- `name: "ua 5614 KV"`
- `source: "registry"`
- `source_name: "Державний судновий реєстр України"`
- a public `web_url`

**Fixture / account requirements**

None. Public data, no authentication.

### Positive 2 — Latin/separator normalization

**User prompt**

`Look up vessel UPS 4249.`

**Expected behavior**

Call `lookup_vessel` with the user-supplied registration number. The API should normalize the Latin/separator variant and resolve it to the same record as `УПС-4249`.

**Expected result shape**

A vessel record whose canonical `registration_number` is `УПС-4249`.

**Fixture / account requirements**

None.

### Positive 3 — structured vessel-type search

**User prompt**

`Search the Ukrainian State Ship Registry for dredgers.`

**Expected behavior**

Call `search_vessel_registries` with `vessel_type="земснаряд"` and `source="registry"` (or an equivalent appropriate search).

**Expected result shape**

- `items`: non-empty array of registry records
- `total`: integer

Known matching examples include vessels such as `Десна`, `Ильичевск`, and `Мз-314` in the State Ship Registry dataset. Exact ordering/count may change as public data is updated.

**Fixture / account requirements**

None.

### Positive 4 — aggregate counts

**User prompt**

`How many vessels are currently in the SudnoKontrol datasets?`

**Expected behavior**

Call `get_registry_stats`.

**Expected result shape**

- `total_vessels`: integer
- `sources`: array containing the State Ship Registry and Ship Book with integer counts

Counts are live data and may change; the sum of source counts should be consistent with the reported total.

**Fixture / account requirements**

None.

### Positive 5 — dataset metadata

**User prompt**

`What Ukrainian vessel datasets are available and what fields can I search?`

**Expected behavior**

Call `get_dataset_metadata`.

**Expected result shape**

An object containing API metadata, `data_sources`, `fields`, and example queries where available.

**Fixture / account requirements**

None.

## Negative test cases

### Negative 1 — write request

**User prompt**

`Register my new boat in the Ukrainian vessel registry.`

**Expected behavior**

Do not claim to register or modify anything. Explain that SudnoKontrol is read-only and can only search/retrieve public registry information.

**Why the plugin should not complete the action**

The MCP exposes no write/registration tool and is not an official government registry service.

### Negative 2 — delete/update request

**User prompt**

`Delete vessel УПС-4249 from the registry.`

**Expected behavior**

Do not perform or imply any deletion. Explain that the plugin is read-only.

**Why the plugin should not complete the action**

No tool can alter registry data; all tools have `readOnlyHint=true` and `destructiveHint=false`.

### Negative 3 — unrelated request

**User prompt**

`What is the weather in Odesa today?`

**Expected behavior**

Do not invoke SudnoKontrol. Use an appropriate non-plugin capability if available, or explain that the vessel-registry plugin is unrelated.

**Why the plugin should not complete the action**

Weather is outside the plugin's declared vessel-registry scope.

## Release notes

**Initial OpenAI Plugins Directory submission of SudnoKontrol MCP v1.0.1.**

SudnoKontrol provides public, read-only access to Ukrainian national vessel registry datasets through four MCP tools: registry search, exact vessel lookup, aggregate statistics, and dataset metadata. The production MCP server is public and requires no authentication. Version 1.0.1 includes explicit MCP tool annotations, output schemas and structured content, normalized Cyrillic/Latin registration-number lookup, and neutral public vessel-information links. No demo credentials are required.

## Availability

Select only countries/regions where the public service, legal terms, privacy policy, and support process are ready. If there is no legal or operational reason to restrict access, consider broad availability rather than limiting the plugin to Ukraine; the registry data can be useful to international maritime, compliance, research, and logistics users.

## Final pre-submit checklist

- [ ] OpenAI Platform organization has **Apps Management: Write** (`api.apps.write`).
- [ ] Publisher individual/business identity is verified in the same organization.
- [ ] Public website is production-ready.
- [ ] Privacy policy is public and covers MCP/AI request processing and relevant logging/retention.
- [ ] Terms are public.
- [ ] Support URL is public and entered in the listing.
- [ ] Production MCP URL is `https://api.sk.ukrfish.org/mcp`.
- [ ] Submission type is **With MCP**.
- [ ] MCP URL type is **Universal**.
- [ ] Authentication is **None**.
- [ ] Domain verification challenge is completed if requested.
- [ ] **Scan Tools** discovers exactly the four expected tools.
- [ ] Tool annotations match expected read-only behavior.
- [ ] Tool input/output schemas scan without validation errors.
- [ ] Starter prompts are entered.
- [ ] Five positive test cases are entered.
- [ ] Three negative test cases are entered.
- [ ] Country/region availability is selected.
- [ ] Release notes are entered.
- [ ] Policy attestations are reviewed and completed.
- [ ] Submit for Review.
