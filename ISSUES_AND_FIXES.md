# Issues found and how they were fixed

Checked on 10 Oct 2026 against local `main` and `https://github.com/Mayuresh-03/AskMyNotes.git`.

## 1. `git fetch` failed on a Windows sidecar file

**How we found it.** `git fetch origin` ended with `fatal: bad object refs/agents/.../checkpoints/turn/0:Zone.Identifier` and `did not send all necessary objects`.

**Cause.** Files copied from Windows brought `*:Zone.Identifier` sidecars into `.git/refs`. Git treated one of those filenames as a ref. The file contents are a Zone.Identifier tag, not a commit id.

**Fix.** Deleted the `*:Zone.Identifier` files under `.git/refs` and `.git/logs`. Left the real ref files in place. `git fetch origin` then updated `main`.

## 2. `git remote set-url` refused to change origin

**How we found it.** `git remote set-url origin https://github.com/Mayuresh-03/AskMyNotes.git` printed `remote.origin.url has multiple values` and exited.

**Cause.** An earlier `git remote set-url --add` stored two URLs: `Github_trial` for fetch and push, and `AskMyNotes` as an extra push URL. `set-url` will not overwrite a key that has more than one value.

**Fix.** Cleared every `remote.origin.url` value, then set origin once to `https://github.com/Mayuresh-03/AskMyNotes.git`. Fetch and `git ls-remote origin HEAD` both use that remote.

## 3. `Zone.Identifier` files in the working tree

**How we found it.** `git status` listed them as untracked files next to real source files.

**Cause.** Same Windows sidecar files as issue 1, this time outside `.git`.

**Fix.** Deleted all 119 of them, including 14 under `.git/hooks` that the sandbox could not remove. A later search found none left.

## 4. Backend crashed on startup with `PermissionError: '/app'`

**How we found it.** `uvicorn main:app` died in `Backend/router/note_routes.py` at `os.makedirs(UPLOAD_DIR)` with `Permission denied: '/app'`.

**Cause.** Upload paths and the dotenv path were hardcoded to `/app`, which exists only inside the Docker image. The server was running on the host, so creating `/app/uploads` was denied.

**Fix.** Paths are now based on the directory that contains the backend code.

- `Backend/router/note_routes.py`: `uploads` and `podcasts` next to the backend package.
- `Backend/utilis/rag_engine.py`: podcast files under `uploads/podcasts`.
- `Backend/database/postgresConn.py`: loads `.env` from that same backend directory.

Inside Docker those paths still resolve to `/app/...`. After reload, `GET /` returned `{"message":"Welcome to AskMyNotes!"}`.

## 5. Signup preflight returned `400` on `OPTIONS /api/users/`

**How we found it.** The server log showed `OPTIONS /api/users/ HTTP/1.1 400 Bad Request` when the signup page submitted. The page code sends `POST`, not `OPTIONS`.

**Cause.** The page is on port 5173 and the API is on port 8000, and the request uses `Content-Type: application/json`. The browser sends an `OPTIONS` preflight before the `POST`. CORS allowed only `http://localhost:5173`. Repeating the preflight with `curl` returned `200` for that origin and `400` with body `Disallowed CORS origin` for `http://127.0.0.1:5173`.

**Fix.** `Backend/main.py` now allows both `http://localhost:5173` and `http://127.0.0.1:5173`. A preflight from `http://127.0.0.1:5173` then returned `200`. The `POST` is sent only after that check passes. Any other host in the address bar still needs to be added.

## 6. Note ingestion failed while saving vectors

**How we found it.** Uploading a PDF logged two different errors, then `Note 34: ALL batches failed`.

- Pages 1–10: Gemini returned `503 UNAVAILABLE` (`This model is currently experiencing high demand`). Those batches never produced embeddings.
- Pages 11–14: `gemini-embedding-001` returned `200`, then the insert failed with `column "node_id" of relation "data_note_embeddings" does not exist`.

**Cause.** Three schemas were in play, and none of them matched the insert.

| Table or model | Columns | Who uses it |
|---|---|---|
| `public.note_embeddings` in Supabase | `id`, `note_id`, `content`, `embedding` | Nothing in the upload path. This is the hand-written table. |
| `NoteEmbedding` in `Backend/models/all_model.py` | `id`, `text`, `metadata_`, `embedding` | `create_all` on startup. No `node_id`. |
| LlamaIndex `PGVectorStore` | `id`, `text`, `metadata_`, `node_id`, `embedding` on `data_note_embeddings` | The worker. `table_name="note_embeddings"` is stored as `data_note_embeddings`. |

Postgres reported `node_id` as the missing column, so `data_note_embeddings` already had `text` and `metadata_`. `create_all` does not add columns to a table that already exists. `Backend/alembic/` has `env.py` and no revision files, so no migration had added `node_id`.

The Gemini `503` is separate. It is a temporary capacity error from the API, not a schema bug. Those pages were not saved.

**Fix.**

- `NoteEmbedding` now includes `node_id`.
- Startup in `Backend/main.py` runs `ALTER TABLE data_note_embeddings ADD COLUMN IF NOT EXISTS node_id VARCHAR` after `create_all`.

Checked `information_schema` after the server reloaded. `data_note_embeddings` is now `id`, `text`, `metadata_`, `embedding`, `node_id`. `note_embeddings` was left as it is. Re-upload the note so the failed batches run again. Pages that hit Gemini `503` need another attempt when that model is available.
