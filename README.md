# GEST — Global English Skills Test

A full-stack test-centre administration and certificate verification website built with **Node.js 20, Express 5, SQLite, EJS, plain CSS/JavaScript, Sharp and Chromium/Puppeteer**. The exam is administered in person: this application does **not** deliver exam questions or audio.

**Key capabilities**: English-only public website and portals; candidate registration, verified email, secure password reset and passport-style photo; seat-limited test booking and cancellation; manual payment recording and ID/photo check-in; draft and submitted scores; headquarters approvals, rejections, reopen, centre/user management, settings, privacy requests and audit trail; A4 PDF Test Report Forms; privacy-conscious HMAC certificate validation with QR codes; candidate data export and legally reviewed erasure workflow.

## Requirements

- Node.js **20 or newer**, npm, filesystem write access for SQLite and private storage.
- **Chromium** for issuing PDFs. The app can start and accept registrations without Chromium, but approval/certificate issuance requires it. On Debian/Ubuntu: `sudo apt-get install chromium`. On macOS, set `CHROMIUM_PATH` to a compatible Chromium executable. Docker installs Chromium automatically.
- SMTP access for any deployment serving real users. Without SMTP, **development mode** prints full one-time email URLs to the server console. Production mode requires working SMTP configuration.
- `pdftotext` (poppler-utils) for the optional HTTP/PDF integration test.

## Local quick start

```bash
npm install
npm start
```

On first start, the bootstrap script safely creates a **private `.env`** with randomly generated independent secrets and seed account passwords, initialises the schema from `src/schema.sql`, and seeds the database. Open **http://localhost:3000**.

Initial local login email addresses (all passwords are in your generated `.env`):

| Role | Email key | Default email |
|------|-----------|---------------|
| Headquarters | `SUPER_ADMIN_EMAIL` | `admin@gest.local` |
| Prime School administrator | `CENTRE_ADMIN_EMAIL` | `centre@gest.local` |
| Demonstration candidate | `DEMO_CANDIDATE_EMAIL` | `demo@gest.local` |

Read **`.env` privately**, rather than displaying passwords in a public terminal or committing the file:

```bash
# Run manually to refresh idempotent demonstration seed data
npm run seed
```

A fresh development seed contains centre **UZ001 Prime School** (Tashkent, Uzbekistan), two future sample sessions, a historical demo session and a demonstration candidate with four approved skill scores. The demo candidate photo is an **illustration explicitly labelled DEMO**. The seed does not issue a demo PDF by default; a headquarters administrator can issue one from the results page. Set `SEED_DEMO_CERT=true` for automatic sample PDF issuance on seed if Chromium is installed. The demo account and its history are **not seeded in production**, unless `SEED_DEMO=true` is explicitly set.

### Configuration

The generated `.env` is copied from `.env.example`, with cryptographically random authentication/verification secrets and account passwords. Set `BASE_URL` to the publicly accessible HTTPS origin before issuing certificates (it is embedded in QR codes). Set `NODE_ENV=production`, `TRUST_PROXY=true` behind a trusted HTTPS reverse proxy, `SMTP_*`, and a reachable `CHROMIUM_PATH`.

| Variable | Purpose |
|----------|---------|
| `NODE_ENV` | `development` or `production`. Production requires secrets, HTTPS-secure session cookies and SMTP. |
| `PORT` | HTTP port, default `3000` |
| `BASE_URL` | Canonical HTTPS origin used in verification QR codes and verification/reset email URLs |
| `DATABASE_PATH` | SQLite DB file path relative to the project or absolute; default `./data/gest.sqlite` |
| `SESSION_SECRET` | Secret signing `express-session` cookies (random, at least 32 bytes recommended) |
| `VERIFICATION_HMAC_SECRET` | Independent HMAC-SHA256 key for report security codes |
| `TOKEN_HASH_SECRET` | Independent HMAC key for email/reset tokens and attempt-log pseudonyms |
| `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` | Initial headquarters login (at least 12 characters, max 72 UTF-8 bytes) |
| `CENTRE_ADMIN_EMAIL` / `CENTRE_ADMIN_PASSWORD` | Initial UZ001 centre admin |
| `DEMO_CANDIDATE_EMAIL` / `DEMO_CANDIDATE_PASSWORD` | Development demo candidate |
| `SEED_DEMO`, `SEED_DEMO_CERT` | Optional `true` switches for demo data or demo PDF issuance in seed |
| `SMTP_HOST`, `SMTP_PORT` | SMTP hostname and port (`587` default) |
| `SMTP_SECURE` | `true` for implicit TLS (e.g. port 465), `false` for STARTTLS |
| `SMTP_USER`, `SMTP_PASSWORD` | SMTP authentication (omit user to use a trusted relay with no auth) |
| `SMTP_FROM` | From header, authorised by your email provider |
| `CHROMIUM_PATH` | Full path to Chromium executable; Debian default auto-detected |
| `TRUST_PROXY` | Set `true` only behind a trustworthy reverse proxy with correct forwarded headers |

Secrets are **never hard-coded into source** and `.env` is ignored by Git and Docker build context. The startup script generates secrets only when `.env` does not already exist; keep the file backed up. Do not rotate `VERIFICATION_HMAC_SECRET` without a migration strategy, since it is required to validate all previously issued forms. Once certificate PDFs are issued, the unencrypted codes exist **only inside the PDFs**, not in SQLite.

## Docker setup

```bash
# If .env does not exist, run this once on the host:
node scripts/ensure-env.js
# Review .env: set NODE_ENV=production, BASE_URL=https://your-domain,
# SMTP_*, TRUST_PROXY=true, and strong unique credentials.
docker compose up --build -d
```

Compose binds `127.0.0.1:3000:3000`; publish your site with an HTTPS reverse proxy (e.g. Nginx or Caddy), **not a public HTTP port**. Docker mounts `./data` and `./storage` as persistent volumes. Filesystem directories must be writable by UID 1000 (`node` inside the image). Stop the container cleanly before any offline restore.

## Deploying to a VPS, Render or Railway

1. Provision a persistent disk/volume for the SQLite database and **both** `storage/photos` and `storage/certificates`. An ephemeral filesystem will lose test results and PDFs. On Render/Railway, use a paid persistent volume or another supported persistent storage facility; do not assume their default filesystem persists.
2. Set up HTTPS termination and your domain; ensure `BASE_URL=https://...` is the canonical public origin. Configure `TRUST_PROXY=true` only if reverse-proxy headers are controlled by your proxy.
3. Use Node 20, `npm install --omit=dev`, `npm start`, and ensure Chromium is installed and `CHROMIUM_PATH` is set. The included Dockerfile is the most reproducible production deployment method.
4. Configure SPF/DKIM/DMARC and a working transactional SMTP provider; check email links from the deployed public domain.
5. Supply persistent, randomly generated secrets and controlled headquarters credentials through the platform's secret manager. **Do not let a production instance generate disposable secrets on each deployment**: provision and persist `.env`/secrets.
6. Review privacy, terms, retention and operational security controls. Test a complete sample workflow on a staging instance first. Then remove demo candidate records and replace the illustrative Prime School seed address with verified centre contact details.
7. Configure backup retention, access log scrubbing, disk encryption, health monitoring and alerts. Avoid logging `/verify/...?...code=` request URLs or email/reset tokens at the reverse proxy, CDN and analytics layer. `Referrer-Policy: no-referrer` is enabled.

**Production readiness disclaimer**: This is a functional application source project, **not** a certified or independently audited examination system. Legal review, security assessment, load and disaster-recovery testing remain necessary before live candidate data is collected.

## Candidate registration and booking

1. Register under **Create account**, with email, a password and consent checkbox.
2. Open the one-time email verification link (valid for 24 hours).
3. Log in, then complete personal details and a JPEG/PNG photo (max 2 MB). Sharp validates actual decoded content, auto-rotates, crops to **480×600** and re-encodes it as JPEG in **private storage**.
4. Browse sessions by centre/date. Booking is atomic: capacity is checked within a SQLite write transaction, then a unique never-reused six-digit candidate number is issued on first booking.
5. The centre handles payment. The candidate can cancel up to the `cancel_days` period set by headquarters before the session (default: 7 days); a cancelled booking does not free or reuse the candidate number.
6. Once scores have been approved, the candidate dashboard shows all four skill scores, the rounded overall score, CEFR and a private PDF download link.

## Centre administration

Sign in as the assigned centre administrator. Create/edit sessions with test date, local start time, seating capacity, notes and open/closed status. View registrants, compare the passport-style photo to the **original identity document**, mark payment manually, check in candidates and save/submit four skill scores from **0–100**. Scores are locked after submission; a headquarters administrator must reopen rejected or submitted scores for editing. An inactive centre cannot accept new bookings or administer sessions.

**Payment integration point:** `src/payment.js` implements a working manual centre reconciliation provider with `createCheckout` and `reconcile` interface methods. Card processing is intentionally **not** enabled or simulated. A future provider can replace the adapter and securely process provider-signed webhooks; manual payment status is explicitly shown to candidates.

## Headquarters / super administration

- **Centres:** create via **Centres → Add centre**, assigning a unique `AA999` code (ISO 3166-1 alpha-2 + three digits). `UZ000` is reserved for headquarters; this implementation reserves all `XX000`-style code endings. Codes never change or get reused after deactivation.
- **Administrators:** create a new centre administrator via **Users**, assign exactly one active centre; edit/reassign accounts and disable users or reset passwords. User actions are audited.
- **Results:** review Submitted results; reject with a reason or approve. Approval generates a Test Report Form **PDF** with new `GEST-YYMM-NNNNN` form number, unbiased cryptographic code, QR, issue/expiry date and visual anti-forgery elements. Form numbers are allocated by persistent counters and never reused. Reissue invalidates the former certificate and issues a new form number and code. Revocation stores its reason; PDF download is denied to a candidate once invalid or expired.
- **Settings:** update cancellation period, certificate validity, retention policy and contiguous CEFR score bands; changing bands recalculates pending/non-final CEFR levels but does not rewrite previously approved historical results.
- **Privacy requests:** view deletion requests and document the legal review. After affirming that applicable retention rules permit erasure, headquarters can irreversibly anonymise personal details, disable the account, revoke certificates and delete original photographs/PDF files while retaining non-identifying counter and audit history. Delayed erasure / declined requests can be recorded with an explanation.
- **Reporting:** search candidates and results, export CSV (spreadsheet-formula injection escaped), inspect audit logs.

## Centre-specific authorised signatures (new)

**One signature per centre, versions preserved.** Only a GEST **super admin** can upload, replace, preview, or deactivate a centre's authorised signatory image. Centre administrators cannot change their own signatures. The PDF shows the appropriate centre's approved signatory image, signatory name and title. This is **a scanned handwritten signature, not a cryptographic PDF digital signature**; online verification remains essential.

For each centre, open **Dashboard → Centres → Authorised signature**, enter the real authorised signatory's full name and position, choose a JPEG or (preferably transparent) PNG signature image of at most 1 MB, confirm authorisation and approve. The server validates decoded image contents, resizes/re-encodes to PNG and stores it **outside `public/`**. Until an approved signature exists for that centre, issuing a **new** certificate fails safely with a clear message. Existing certificates, including the demo certificate you already made, are unaffected.

Replacing a signature retires the former version but never deletes the old file. Each **new** certificate is linked permanently to the signatory version current on its issue date; prior PDFs never change. Reissuing a certificate uses the current approved version and a new security code/form number. Old certificates retain their verification status (valid/reissued/revoked) as before. Upload **only authentic, permissioned** signatures; store and retain them subject to your applicable employment/privacy rules.

### Update an existing Windows installation (keep your bookings and results)

1. **Back up** the working `data/`, `storage/` and `.env` first, preferably with `npm.cmd run backup` plus a copy of the entire `storage` folder.
2. Stop GEST using **Ctrl+C** in the terminal and confirm it is not running. Extract the **centre-signature update ZIP** into a separate folder, then copy its contained relative paths into your existing `gest-website` directory. **Do not copy or replace** your original `.env`, `data` or `storage`. The update archive intentionally contains none of them.
3. Run `npm.cmd install` to reconcile dependencies (none new), then `npm.cmd start` in the existing folder. `src/schema.sql` adds its two new tables/indexes automatically on startup; it does **not reset** your existing SQLite database.
4. Sign in as super admin, open **Centres → Prime School (UZ001) → Authorised signature**, upload and approve the authorised person's genuine signature. Then issue or reissue a **demo** report to confirm the image and name display. The previously revoked certificate stays revoked; a reissue uses a fresh form number and verification code.
5. Add `storage/signatures/` to your **encrypted backup** and disaster-recovery process, together with `data/`, `storage/photos/`, `storage/certificates/` and all original secrets.

**Security:** never upload a signatory's signature image through public pages, copy it into `public/`, publish it separately, or use it to imply a qualified digital certificate. Real PDF cryptographic signing and PKI key lifecycle are a separate optional hardening project.

## Test Report Form and verification

The report is rendered from `views/certificate.ejs` into **A4 portrait PDF** with Chromium. It includes a personalised score layout, seven-level CEFR strip, candidate photo, two seals, administrator approval identification/date, QR verification link, security code, form number, micro-type, fine moiré, edge strip and two machine-readable lines of **44 characters**. These printed visual elements deter casual tampering but **do not replace online verification**.

At `/verify`, enter the form number and printed `XXXX-XXXX-XXXX` code or scan the QR URL `/verify/GEST-YYMM-NNNNN?code=...`. The code is stored **only as HMAC-SHA256**, checked using `crypto.timingSafeEqual`, and never logged. Public verification has an IP-based 12-attempt/15-minute limit; requests log only keyed hashes of source IP and form number, plus outcome. A nonmatching code has the same generic result regardless of form existence. Valid matches show photo, identity, scores, centre and expiry. Revoked/reissued/expired forms are clearly marked invalid. Verification is private-by-possession: share certificate codes only with intended receiving organisations.

## Automated tests

```bash
npm test         # Score/CEFR boundaries, identifiers/counters, HMAC verification outcomes
npm run test:flow # Real HTTP end-to-end registration → email → photo → booking → score → PDF → verify/revoke
```

The integration test requires Chromium and `pdftotext`. It creates an **isolated temporary SQLite database** and removes its generated certificate after successful completion, without affecting operational records. All tests should be run in CI with dependencies installed; a staging run must also check responsive appearance and PDF print layout by eye.

## Logo, branding and translations

The supplied image has been cropped for `/public/img/logo.png` and is already included. Replace it with **any** logo image named `logo.png`; the responsive header and certificate will adapt to its proportions. If the image is missing, both display a text logo automatically. Navy `#0d3158`, gold `#c9a24b`, white; font Montserrat (with accessible system fallback). The complete user interface is English-only. Navigation, homepage, registration, booking and verification copy lives in `locales/en.json`. No language switcher or translation cookie is used.

## Backups and restoration

The database uses SQLite **WAL mode**; **do not copy only the live `gest.sqlite` file while it is running.** Take a consistent online snapshot:

```bash
npm run backup
# Or supply a secure destination directory:
node scripts/backup.js /mnt/secure-gest-backups
```

Also back up **private `storage/photos` and `storage/certificates`**, your `.env` secrets and deployment configuration at compatible restore points. Keep offsite encrypted copies and apply a tested retention policy. To restore, stop the app, copy the snapshot back to `DATABASE_PATH`, restore the matching storage folders with restricted permissions, restore **the original HMAC/session/token secrets** and start the app. Test existing PDF downloads and valid public verification after recovery.

## Safety/operational notes

- The database, photo files, PDF forms and `.env` are private and must not be served by your reverse proxy. Only `public/` is mounted as Express static assets. Passwords are salted **bcrypt (12 cost)** hashes; email/reset links are one-time HMAC-backed tokens.
- User-facing endpoints validate input with Zod, SQL is parameterized, the site enforces session CSRF tokens and Helmet CSP, and restricted screens require role plus centre ownership checks. Security-sensitive endpoints have rate limits.
- Public forms and private UI use semantic HTML labels, keyboard focus styles, responsive layout and high-contrast text. Arrange independent WCAG 2.2 AA audit with assistive technologies before go-live.
- Rotate credentials after installation; deploy only behind TLS. Configure file backups, monitoring, process supervision, security updates, and log retention.
- Production operations must have approved legal notices, real contact channels, verified centre addresses, payment/refund rules, recognition disclosures and a disaster-recovery/security plan.

## Project layout

```text
src/app.js                     Express application and security middleware
src/schema.sql                 Complete SQLite schema / initial migration
src/db.js                      Database bootstrap, settings, audit
src/routes/                   Public, auth, candidate, centre, headquarters
src/certificate.js            Printable A4 HTML → Chromium PDF
src/score.js                  Score/CEFR logic
src/verify.js                 HMAC verification outcome policy
src/identifiers.js            Counter-backed identifiers and crypto codes
src/payment.js                Manual payment provider interface
src/session-store.js          SQLite-backed express-session store
views/                        EJS pages, portals and report form
locales/                      English-only JSON dictionary
public/                       Responsive CSS, vanilla JS and logo
scripts/                      First-run secrets, seeds, startup and backup
tests/                        Unit tests and HTTP/PDF end-to-end flow
```

## Automatic Pilot Scoring — added in v1.1

**GEST Pilot Scoring v1.0 is provisional and not psychometrically validated.** It is for internal pilots only; this workflow **never issues an official GEST Test Report Form**. Existing historical scores and genuine stored certificates are not modified by the additive migration.

Headquarters manages immutable answer keys and session assignments at `/admin/pilot/forms`. Pilot-marked sessions use a new score entry form under `/centre/booking/:id/scores`; legacy sessions keep manual scoring. Objective Reading (40) and Listening (35) raw responses are automatically checked. Speaking uses four criteria scored 0–10. Writing has two independent, account-separated assessor submissions; scores are task-weighted 40%/60%, and a disagreement >10 forces a third assessor, after which the median of three marks is used. The overall score is the rounded mean of the four 0–100 skill scores. Test form fingerprints, version and marking evidence are frozen in a pilot snapshot at submission.

Use `npm run seed:pilot-demo` for **non-production demonstration** answer keys (A/B/C/D repeated) only. For complete Windows upgrade and walkthrough instructions, see [`UPGRADE-AUTOMATIC-SCORING-UZ.md`](UPGRADE-AUTOMATIC-SCORING-UZ.md). For validation results and limitations, see [`VALIDATION-AUTOMATIC-SCORING.md`](VALIDATION-AUTOMATIC-SCORING.md).

**Security**: form keys are secret, stored in the restricted SQLite database and available only through Headquarters write routes. All changes are audited. Protect DB backup access because key material is stored there. Do not submit official certificate requests using provisional pilot data. Candidate raw responses are removed from the stored pilot evidence during authorised privacy erasure; the pilot-only marker is retained for safety.

## Candidate identity registration v1.3

The candidate account now has two steps: personal profile + consent, then upload of a genuine 5 MB maximum passport/national-ID PDF/JPEG/PNG. Bookings require an uploaded ID record, but **do not** require a self-uploaded certificate portrait. Original ID verification and the official 4:5 photograph take place at the centre during check-in (`/centre/booking/:id/identity`). The staff browser may use its camera (`localhost` / HTTPS) or take a photo with a supervised device camera. The administrator must check the original physical ID and confirm the candidate's presence. Scores are entered only after check-in.

Documents are stored outside `public/` as AES-256-GCM authenticated ciphertext, with random filenames. The 32-byte hexadecimal `IDENTITY_ENCRYPTION_KEY` is automatically created in `.env` if missing. **Back up this key securely alongside the encrypted document files; losing it makes documents irrecoverable.** Rotating it requires decrypting/re-encrypting existing files first. PDFs are accepted only after basic content checks and are delivered as authenticated, download-only attachments; **this is not a substitute for an antivirus or document sandbox scanner**, which must be integrated before handling real identity documents. Profiles are locked after any check-in. The official photo is stored per booking, so later test photos do not silently change prior test reports.

Candidates may download their uploaded ID via `/candidate/identity-document/download` and their structured information via `/candidate/data-export`. Erasure after legal review removes their identity files and booking photos. Preview retention candidates with `npm run retention:preview`; apply only after a legal review and backup via `npm run retention:apply`. The cleanup task is not automatically scheduled. Document-data handling requires legal/privacy review, including guardian-consent rules for minors.

For existing Windows installations see **UPGRADE-CANDIDATE-IDENTITY-UZ.md**. The migration uses additive SQLite tables; historical bookings, signatures, PDFs and pilot scoring records are not overwritten.

## GEST v1.4 — Development payment sandbox and fee waiver programme

**Not a real payment system.** This project does not collect money, connect to Click/Payme, process bank cards, or create real financial receipts. Real-world acceptance of the proposed 890,000 UZS exam fee requires a registered provider agreement and commercial/legal review.

Run `npm install && npm start` locally. `scripts/ensure-env.js` adds a stable `FEE_WAIVER_HMAC_SECRET` to existing `.env` files without changing old session, certificate verification, or document-encryption keys. **Back up the .env file securely; loss of this HMAC key makes unredeemed coupon codes unusable.** Sandbox checkout operates only if `PAYMENT_MODE=sandbox` and `NODE_ENV` is not `production`. Production switches back to the legacy manual centre payment workflow; real integration is intentionally not enabled.

Super administrators use `/admin/fees` to set a demo price, register school/university distribution partners (no separate institutional account), generate 1–100 one-time 25%, 50%, or 100% coupon codes per batch, restrict by test centre and expiry, and deactivate unused allocations. Generated codes are displayed **only on the successful POST page**. Save the codes in a secure channel; their plaintext is not stored in SQLite. Each code is hashed with HMAC-SHA256 using `FEE_WAIVER_HMAC_SECRET`. Existing uses are not reversed by deactivation. Do not use coupons as a proof of a student's financial circumstances; eligibility reviews remain with the partner institution.

Candidates register, complete their identity profile, book a future session, then visit their personal `/candidate/payment/:bookingId` checkout. A pending order can accept a single coupon. A 100% discount records the demo booking as paid immediately. A 25%/50% discount reduces the demo due amount; the candidate can then simulate success or a decline. Declines can be retried. Reusing a voucher or changing a settled order is blocked. No form ever asks for a card number. `GET` links cannot settle a payment. A paid, settled, or voucher-used cancelled booking requires administrative review rather than silently reactivating it. No refunds are implemented. No voucher is returned to the pool after cancellation.

To make a genuine online checkout later, commission a licensed/accredited provider with server-side verified callbacks, payment intent/order IDs, webhook signatures, idempotency, reconciliation, real refunds and dispute handling, tax receipts, and a formal financial security audit. **Never turn the sandbox simulator on in production or use its demo receipts as evidence of payment.**

Upgrade existing Windows installation: see `UPGRADE-PAYMENTS-V1.4-UZ.md`. Run `npm.cmd run backup` and create an offline backup copy of the complete `gest-website` folder first; do not replace `.env`, `data`, `storage` with source-only ZIP files. Automatic SQLite migration is additive on server startup.

Do not copy a local testing SQLite database containing simulated paid bookings into a real production environment. Production infrastructure must use separate data, independently rotated secrets, tested backups, and genuine payment-provider reconciliation.
