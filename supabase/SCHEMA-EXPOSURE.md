# `catalog` must be exposed to the REST API

Everything the v3 pages read or write — `allowlist`, `stock_listings`,
`shop_offers`, and every `admin_*` / `shop_*` function — lives in the
**`catalog`** schema, not `public`.

PostgREST only serves schemas listed in its `db-schemas` setting, which by
default is `public, graphql_public`. Until `catalog` was added, every REST call
from `/v3/` failed with:

```
PGRST205  Could not find the table 'catalog.allowlist' in the schema cache
```

## The two parts

Adding the schema is not enough on its own — PostgREST also caches the list of
tables, and that cache has to be rebuilt. Doing only the first is why this
looked unfixed for a round:

```sql
alter role authenticator set pgrst.db_schemas = 'public, graphql_public, catalog';
notify pgrst, 'reload config';   -- picks up the new schema list
notify pgrst, 'reload schema';   -- rebuilds the table cache  <-- easy to miss
```

Telling the two apart from the error alone:

| PostgREST code | Meaning |
|---|---|
| `PGRST106` | schema not in `db-schemas` — the schema itself is not exposed |
| `PGRST205` | schema is fine, the **table cache** is stale |

## Keep the dashboard in agreement

Changing API settings in the dashboard can rewrite `db_schemas` and drop
`catalog`, which brings the 404s straight back. Set **Settings → API → Exposed
schemas** to include `catalog` so the dashboard and the role setting agree.

## Checking it without a browser

This sandbox cannot reach `*.supabase.co`, but the database can call its own
REST API through the `http` extension — which is how the fix above was actually
verified rather than assumed:

```sql
select status, left(content, 200)
from extensions.http((
  'GET',
  'https://vcrzauuxvgpsbforiszz.supabase.co/rest/v1/allowlist?select=phone&limit=1',
  ARRAY[extensions.http_header('apikey','<publishable key>'),
        extensions.http_header('Accept-Profile','catalog')],
  NULL, NULL)::extensions.http_request);
```

`401 permission denied for table allowlist` is the **healthy** answer for an
anonymous caller: the table was found, and only the grant stopped it. Anything
mentioning the schema cache means the reload above is needed again.
