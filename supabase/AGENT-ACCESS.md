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
egress proxy answers `403` to `CONNECT`. This is an **allowlist**, and it is a
property of the Claude Code environment, not of Supabase. Measured:

| Host | Reachable |
|---|---|
| `api.github.com`, `github.com`, `raw.githubusercontent.com` | yes |
| `registry.npmjs.org` | yes |
| `vcrzauuxvgpsbforiszz.supabase.co` | **no** — `connect_rejected` |
| `patelmarketing-catalog.vercel.app` | **no** — the live site itself |
| `example.com` | **no** (which is what shows it is an allowlist, not a blocklist) |

So: no PostgREST, no Auth, no Storage, and no fetching the deployed site to
check a change went out. Both of those had to be worked around by asking the
database to make the request instead.

**Writing to Storage, by any route the session controls directly.** Needs the
service-role key, which is correctly not in this repository, and would be
blocked by the network policy anyway.

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

The tidiest to use and the one with the widest blast radius. **Two things, and
neither is a Supabase setting** — this is the part the question usually
assumes wrong.

**a. Open the hosts in the environment's network policy.** Configured where
the environment is, not in Supabase — see
<https://code.claude.com/docs/en/claude-code-on-the-web>. Two are worth adding:

```
vcrzauuxvgpsbforiszz.supabase.co        database, auth, storage
patelmarketing-catalog.vercel.app       the live site, to check a deploy
```

**b. A key, as an environment variable on that environment** — never in the
repo, never in a commit. Pick the lowest one that does the job:

| Key | What it buys | Risk |
|---|---|---|
| **Publishable** (`sb_publishable_…`, already public in `config.js`) | Read PostgREST and public Storage. Verify a change end to end instead of against a stand-in. | None it does not already have — it is restricted by row-level security |
| **Secret** (`sb_secret_…`, Project Settings → API Keys) | Upload to Storage, fix the bucket, run one-off data jobs | Bypasses row-level security. Prefer this over the legacy `service_role` JWT because it can be revoked on its own |

**Start with the network plus the publishable key.** That is the whole of the
verification gap and carries no write privilege at all — the live-catalogue
read in this repo had to be proved against a stub for exactly this reason. Add
a secret key only when a task actually needs to write, and revoke it after.

## Do not

- Put a service-role or secret key in this repository, in `config.js`, in a
  workflow file, or in a commit message. The publishable key in `config.js` is
  a different thing and is meant to be public — it is restricted by row-level
  security.
- Leave a write-capable Edge Function deployed after the task that needed it.
- Use `update storage.objects set name` to move a file. See above.
