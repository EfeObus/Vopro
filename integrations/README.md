# Vopro Integrations

External service connectors. Each connector implements the `Connector`
interface so the rest of the system can treat them uniformly:

```ts
interface Connector {
  id: string;
  name: string;
  authorizeUrl(redirectUri, state): string;
  exchangeCode(code, redirectUri): Promise<credentials>;
  pull(config, since?): AsyncIterable<ConnectorEvent>;
}
```

## Bundled connectors

| ID | Name | Auth |
| --- | --- | --- |
| `google` | Google Workspace | OAuth 2.0 |
| `microsoft` | Microsoft 365 | OAuth 2.0 |
| `rest` | Generic REST | API key |

## Adding a new connector

1. Create `src/connectors/<id>.ts` exporting an object that conforms to
   `Connector`.
2. Add it to `ALL_CONNECTORS` in `src/index.ts`.
3. Add the provider id to `Integration::PROVIDERS` in `backend/app/models/integration.rb`.
