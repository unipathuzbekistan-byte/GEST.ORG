# GEST v1.3 validation notes

Checks performed in the artifact preparation environment on 2026-10-22:

- PASS: 18 Node offline tests covering CEFR, score calculation, HMAC verification, revoked/expired reports, Reading/Listening scoring, Writing moderation, AES-256-GCM tamper rejection, invalid PDFs and random-only file paths.
- PASS: source JS syntax checks, including centre camera capture.
- PASS: EJS syntax check for 40 templates.
- PASS: SQLite migration executes twice without errors and retains a seeded example centre; both new identity tables exist.
- NOT EXECUTED: complete npm test suite / live HTTP test flow / PDF generation because the environment cannot install third-party npm packages (the npm registry was not reachable; `npm install --offline` reports ENOTCACHED). Run `npm.cmd install`, `npm.cmd test`, and `npm.cmd run test:flow` on your Windows machine. Chrome/Chromium must be available for the PDF test.
- NOT EXECUTED: physical webcam capture tests; those require browser permission and HTTPS or localhost, and are tested at the centre.

## Production gaps

This is a **development/test implementation**, not a guarantee of compliance or fraud prevention. Before collecting real passports: conduct a penetration test, integrate PDF malware scanning (not just regex checks), commission legal data-processing/retention and minors' consent policies, establish staff device security, test privacy erasure and disaster recovery, rotate any previously disclosed `.env` secrets, enable HTTPS and admin MFA, and verify the separate production database backup.
