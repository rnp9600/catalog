# What a Claude session can and cannot do to this project

Written after a session where the answer to "just upload the photos" was "I
can't from here", which was true but not the whole picture. This is the whole
picture, with the checks that produced it, so the next session does not
re-derive it.

## What works today

**SQL and DDL, fully.** The Supabase MCP server runs queries and migrations as
a privileged role. Everything in `05_signup_approvals.sql` and
`06_catalogue_live.sql` was written, applied and tested this way, including
running as six different users by setting `request.jwt.claims` inside a
transaction. Reading `storage.objects` works too — that is how the bucket's
drift was measured.

**Edge Functions.** The MCP can deploy them (`deploy_edge_function`), list
them and read their source.

## What does not

**Any direct HTTPS from the session to `<project>.supabase.co`.** The sandbox's
egress proxy answers `403` to `CONNECT` for that host — an environment network
policy, nothing to do with Supabase:

```
$ curl -o /dev/null -w '%{http_code}' https://vcrzauuxvgpsbforiszz.supabase.co/rest/v1/
000
# proxy log: connect_rejected — "gateway answered 403 to CONNECT"
```

So no PostgREST, no Auth, no Storage upload or download, and no end-to-end
check of the live-catalogue read — that one had to be proved against a stub
shaped like the view instead.

**Writing to Storage, by any route the session controls directly.** It needs
the service-role key, which is correctly not in this repository, and would
still be blocked by the network policy even if it were.

**Renaming a stored object with SQL.** Worth knowing before someone tries it:
Storage keys the stored file by its path, so `update storage.objects set name`
leaves the row pointing at nothing. A move is upload-then-delete.

## The part that surprised me

**The database is on a different network, and it can reach both ends.**
Verified:

```sql
select (extensions.http(('HEAD',
  'https://vcrzauuxvgpsbforiszz.supabase.co/storage/v1/object/public/catalog-images/elephant/el_china_cap.jpg',
  null,null,null)::extensions.http_request)).status,          -- 200
 (extensions.http(('HEAD',
  'https://raw.githubusercontent.com/rnp9600/catalog/main/images/paxton/px_dosa_tawa.jpg',
  null,null,null)::extensions.http_request)).status;          -- 200
```

`extensions.http` and `extensions.http_post` are installed (`sync_from_site()`
already uses `http_get` to pull `data.json` from Vercel). `pg_net` is available
but not installed, if an async version is ever wanted.

So there **is** a route from a session to the bucket, with no Supabase setting
changed and no network policy changed:

```
MCP (SQL)  ->  extensions.http_post(<project>/functions/v1/<fn>)
           ->  Edge Function, deployed through the MCP
           ->  fetch https://raw.githubusercontent.com/... (200, verified)
           ->  upload to Storage with SUPABASE_SERVICE_ROLE_KEY,
               which Supabase injects into every function automatically
```

**Not tried.** Every link is verified except the function itself, which was not
deployed because it is a real change to a production project and nobody had
asked for one.

## The three routes, in the order I would pick them

### 1. Leave it to the Action (what is set up now)

`.github/workflows/sync-images.yml` + `tools/sync-images.mjs`. Needs one
secret, `SUPABASE_SERVICE_KEY`, added once. Runs on every push touching a
photo, so the bucket cannot drift again. **This is the right answer for
photos** and it is already built and tested; a session does not need bucket
access to keep the bucket correct.

Its one limitation: it syncs what is in the repo. A session that wants to put
something in the bucket that is *not* in git has to use route 2 or 3.

### 2. An Edge Function, for when a session genuinely needs to write

Only worth building if a real task needs it. If it is built:

- **`verify_jwt: true`.** A function that fetches a URL and writes it to a
  bucket is a file-drop with a public address if it is left open.
- **Pin the source.** Accept a path, not a URL, and build the URL against a
  fixed `raw.githubusercontent.com/rnp9600/catalog/` prefix. Otherwise it will
  copy anything on the internet into the bucket.
- **Pin the destination** to `catalog-images`, and reject `..` in paths.
- **Delete it when the task is done.** It is a standing privilege otherwise.

### 3. Give the session direct access

The tidiest to use and the one with the widest blast radius. Two things, and
**the first is not a Supabase setting** — this is the part the question
assumed:

- **The network policy of the Claude Code environment** has to allow
  `vcrzauuxvgpsbforiszz.supabase.co`. It is set where the environment is
  configured, not in Supabase. See
  <https://code.claude.com/docs/en/claude-code-on-the-web>.
- **A key, supplied as an environment variable** on that environment — never
  in the repo, never in a commit. Prefer a **new-style secret key**
  (`sb_secret_…`, Supabase → Project Settings → API Keys) over the legacy
  `service_role` JWT: it can be rotated or revoked on its own without
  invalidating everything else.

With just the *publishable* key and the network opened, a session could at
least **read** PostgREST and public Storage — enough to verify a live-catalogue
change end to end instead of against a stub, with no write privilege at all.
That is the smallest useful step and probably the one to take first.

## Do not

- Put a service-role or secret key in this repository, in `config.js`, in a
  workflow file, or in a commit message. The publishable key in `config.js` is
  a different thing and is meant to be public — it is restricted by row-level
  security.
- Leave a write-capable Edge Function deployed after the task that needed it.
- Use `update storage.objects set name` to move a file. See above.
