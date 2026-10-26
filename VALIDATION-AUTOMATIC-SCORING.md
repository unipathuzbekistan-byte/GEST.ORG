# GEST Automatic Scoring v1.1 — validation report

Built as an additive upgrade to `gest-website-with-centre-signatures.zip` (the latest complete signature-enabled project supplied during the conversation). The update contains no `.env`, SQLite data, candidate images, signature assets, certificate PDFs, passwords or personal data.

## Performed here

- `node --check` on every project `.js` source, route, script and test file: **passed**.
- `node --test tests/pilot-scoring.test.js tests/core-offline.test.js tests/public-route-offline.test.js`: **15/15 tests passed**.
- SQLite schema loaded twice in a Python SQLite test environment, preserving a preexisting UZ002 centre, administrator, session, test form and immutable assignment: **passed**.
- Database triggers prevented `pilot_forms` answer key updates and `pilot_session_forms` deletes in the offline SQL test: **passed**.
- Parsed JavaScript segments from all 39 EJS templates and checked via `node --check`: **39/39 passed**. This is a static syntax check, not a full render.
- Verified the source guards: Headquarters-only test form setup; centre-scoped booking access, role-based marking, CSRF middleware, account-distinct Writing assessors, pilot result ban in PDF issuance path; static checks only.

## Not verified here

- `npm install` timed out while contacting npm registry, so packages such as `better-sqlite3`, `ejs`, and `express` could not be installed in this environment. The project adds **no new dependencies** beyond the installed signature-enabled site.
- `npm test` for all package-dependent tests and end-to-end HTTP / browser flows could **not** be executed here.
- Live SQLite integration using `better-sqlite3` could not be executed here; SQL-level compatibility is tested against Python SQLite 3.46.1.
- The Windows deployment, candidate check-in, admin UI views and PDF report flows must be smoke-tested on your machine before using the update with live candidates.

## Required acceptance test on Windows

1. Back up `.env`, `data`, `storage` and the full project; stop server.
2. Install patch, run `npm.cmd test` and `npm.cmd start`.
3. In Headquarters, create a real pilot form with 40/35 keys (or seed a **demo-only** form), then assign it to a clean UZ002 pilot session.
4. Book a demo candidate and check in with original identity check.
5. Enter 30 correct Reading answers → **75**; 28 correct Listening answers → **80**. Save Speaking rubric `[8,8,7,9]` → **80**.
6. Use two distinct accounts to submit Writing marks; a gap of 10 does not require a third assessor, a gap of 11 or greater must require a third **different** account. For a large gap, use the median of three.
7. Submit results, verify locked score entry, Headquarters approval and Candidate Dashboard pilot/provisional label.
8. Confirm no normal `Test Report Form` PDF can be issued from any admin route for a pilot result. Existing **nonpilot** PDF and QR verification must continue working unchanged.
9. Confirm UZ001 staff cannot mark UZ002 bookings; unauthenticated requests and requests without CSRF token must be rejected.
10. Confirm backups and rollback with no candidate data loss.

## Scientific limitation

Raw correct answer → 0–100 conversion is an arithmetic pilot model. **GEST score cutoffs have not been validated against CEFR**, and this upgrade deliberately prevents generating an official certificate for these new provisional results. Establish psychometric evidence, standard setting, calibration, item analysis, assessor training, moderation and fairness reviews before any formal score claims.
