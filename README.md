# SudnoKontrol MCP

Model Context Protocol server for the **Ukrainian national vessel registry** — search vessels by registration number, name or owner, look up full registry records, and query aggregate statistics. Exposes the public data of the Державний судновий реєстр України (State Ship Registry) and the Суднова книга України (Ship Book).

Data is read-only and public — **no API key required**.

- **Hosted endpoint (recommended):** `https://api.sk.ukrfish.org/mcp` (Streamable HTTP)
- **Project docs:** `https://sk.ukrfish.org/api-docs` and `https://sk.ukrfish.org/info/ai-agents`
- **Discovery:** `https://sk.ukrfish.org/llms.txt`

## Tools

| Tool | Description |
|---|---|
| `search_vessel_registries` | Free-text + structured search across both national registries. Deterministic ordering: exact registration-number matches first. Supports Cyrillic/Latin and separator-insensitive numbers (`УПС-0129` ≡ `УПС 0129` ≡ `UPS-0129`). |
| `lookup_vessel` | Exact vessel lookup by normalized registration number. Returns full registry record. |
| `get_registry_stats` | Aggregate public vessel counts ("how many vessels..."). |
| `get_dataset_metadata` | Dataset context: sources, import dates, record counts, fields. |

Every search/lookup result includes a `web_url` → `https://sk.ukrfish.org/registry?vessel=<reg>` pointing to the public vessel information page.

## Quick start — hosted server

### Claude Code / Claude Desktop

```bash
claude mcp add --transport http sudnokontrol https://api.sk.ukrfish.org/mcp
```

### Cursor

`Settings → MCP → Add new MCP server` → Name `sudnokontrol`, Type `HTTP`, URL `https://api.sk.ukrfish.org/mcp`.

### Windsurf

`Windsurf → MCP → Add server` → `https://api.sk.ukrfish.org/mcp`.

### Any MCP client (streamable HTTP)

```
URL:  https://api.sk.ukrfish.org/mcp
Auth: none (public, IP rate-limited)
```

## Run it yourself

The server proxies the public API and needs no credentials.

```bash
# stdio (for Claude Desktop "command" servers)
npx sudnokontrol-mcp

# HTTP (streamable)
npx sudnokontrol-mcp http
# or: PORT=9000 HOST=127.0.0.1 npx sudnokontrol-mcp http
```

Install from this repo directly:

```bash
npm install -g github:ailubes/sudnokontrol-mcp
```

To point at a different base (e.g. your own deployment):

```bash
SUDNOKONTROL_API=https://api.sk.ukrfish.org/api/ai npx sudnokontrol-mcp
```

From source:

```bash
npm install
npm run build
node dist/index.js        # stdio
node dist/index.js http   # HTTP on :8958/mcp
```

### Connect to your local instance

```
claude mcp add --transport http local-sudnokontrol http://127.0.0.1:8958/mcp
```

## API (underlying REST, no MCP needed)

| Endpoint | Purpose |
|---|---|
| `GET https://api.sk.ukrfish.org/api/ai/openapi.json` | OpenAPI 3.1 spec |
| `GET https://api.sk.ukrfish.org/api/ai/tools` | Function-calling tool definitions (JSON Schema) |
| `GET https://api.sk.ukrfish.org/api/ai/meta` | Dataset context |
| `GET https://api.sk.ukrfish.org/api/ai/registry/search?q=` | Search |
| `GET https://api.sk.ukrfish.org/api/ai/registry/lookup/{reg}` | Lookup |
| `GET https://api.sk.ukrfish.org/api/ai/stats` | Aggregates |

Rate limit: 300 requests / 15 min / IP on `/api/ai/*`. Search/meta/stats responses cached 60s.

## Example

```
User: Is the vessel УПС-4249 registered?

Agent calls: lookup_vessel {"registration_number": "УПС-4249"}
Response: { registration_number: "УПС-4249", name: "ua 5614 KV", owner_name: "ТОВ Соціальні ініціативи Запоріжжя", source: "registry", web_url: "https://sk.ukrfish.org/registry?vessel=УПС-4249", ... }
```

## License

MIT

## Disclaimer

This is an open-source MCP adapter for the public data of the Ukrainian vessel registries operated by SudnoKontrol. It is not an official government service.