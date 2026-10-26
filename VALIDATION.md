# Validation record

A partial static verification was performed when this project archive was assembled. The authoring container has no functional npm registry DNS access and no cached npm packages; therefore dependency installation, the full `npm test` suite, a live Express startup and the end-to-end `npm run test:flow` workflow could **not** be completed here. **Those checks must pass before production use.** This limitation is about this archive's build environment, not evidence that the application has passed full integration testing.

Checks completed in the authoring environment:

- `node --check` for all JavaScript source, script and test files: **passed**.
- EJS JavaScript syntax inspection across all 35 templates: **passed**.
- `src/schema.sql` execution twice in an in-memory SQLite instance using Python sqlite3: **passed (idempotent)**.
- English/Uzbek/Russian translation key parity for the requested bilingual sections: **passed**.
- Node.js built-in HMAC verification tests for valid, incorrect, revoked, reissued and expired statuses: **passed**.
- Offline core smoke tests for score rounding, CEFR mapping and 500 generated security codes: **passed**.
- `npm install --offline`: **blocked**, no cached npm packages (`ENOTCACHED`). Normal npm registry DNS resolution is unavailable in this environment.
- `npm test` before installing dependencies: **blocked**, `better-sqlite3` is unavailable.

Perform the following on a machine with access to the npm registry and Node.js 20, Chromium and `pdftotext`:

```bash
npm install
npm test
npm start
# in a second terminal:
npm run test:flow
```

Run a final manual staging review in desktop/mobile browsers of profile upload, payment, attendance, scores, headquarters approval, printed PDF layout, public verification, revocation, erasure workflow and email deliverability. Complete a security and legal review before accepting real candidates.

## Centre signature update validation (2026-10-21)

The new image upload controller and versioned SQLite schema were statically checked. The local build environment does not have the application's full npm dependency tree, so the new admin HTTP upload, final PDF rendering and full npm test suite must be exercised after `npm.cmd install` on the actual installation. The existing site has already generated and verified a demo PDF on the user's Windows PC, but that does not constitute a test of this new version. The newly added `tests/centre-signatures.test.js` exercises sanitization, versioning, retirement, audit logs, and preservation of old stored images; `npm run test:flow` additionally exercises the upload/approve/rotate/certificate flow.

Additional checks performed in this update: 7 core/offline and QR-verification tests passed; all JavaScript source/test files passed `node --check`; fresh/idempotent SQLite schema and active signature uniqueness passed in SQLite; Sharp processed and re-encoded a test PNG while rejecting corrupted/oversized files; the revised EJS certificate template compiled to HTML with a signatory image/name. Local Chromium command-line PDF rendering did not complete within the available timeout. These checks are **not a replacement** for the `npm test`, `npm run test:flow`, and manual Chrome PDF inspection required on your Windows computer.
