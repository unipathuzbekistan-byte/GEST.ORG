# GEST Render build fix (Dockerfile only)

## Why
The latest Render deploy failed at `npm install` because `better-sqlite3` requires a native build and `node-gyp` could not find Python.

## Apply on Windows with GitHub Desktop
1. Open GitHub Desktop; select the existing `GEST.ORG` repository.
2. Click `Show in Explorer` to open the cloned repository folder.
3. Copy the `Dockerfile` from this ZIP into that repository root, replacing **only** the existing `Dockerfile`.
4. Confirm the top lines show `FROM node:20-bookworm-slim` and `python3 make g++` on the apt-get install line.
5. Back in GitHub Desktop, confirm only `Dockerfile` is modified. Set Summary to `Fix Render better-sqlite3 build dependencies`, then Commit to main and Push origin.
6. Watch the existing GEST.ORG service on Render. Auto deploy should trigger. If it doesn't, Deploy latest commit.

Do not delete the Render service or upload `.env`, `data`, `storage`, passport scans, or any SQLite database.
This fix addresses native compilation only; Render Free ephemeral storage is a separate persistence issue.
