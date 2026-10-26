# Certificate authenticity and anti-forgery guidance

## Implemented in this project

- Unique, never-reused certificate form numbers and randomly generated 12-character verification codes, presented as `XXXX-XXXX-XXXX`.
- Security codes stored in the database only as keyed HMAC-SHA256 digests and compared in constant time.
- On `/verify`, a verifier supplies the form number and code; a QR code leads to the same server-based verification endpoint. Successful verification displays the issued identity, photo, test date, centre, overall and skill scores, CEFR level and expiry date. Revoked, reissued and expired certificates cannot return a `VALID` result.
- Strict per-IP verification attempt rate limiting, logging of hashed identifying data, and restricted staff approval/revocation flows.
- Decorative anti-copy visual elements: fine microtext, moiré/guilloche-inspired background, coloured edge strip, rings/stamps and machine-readable-style text lines.

## Important limitations

**Decorative graphics are not true holograms or security printing.** Their appearance can be reproduced by anyone who can print or modify a PDF. The printed stamps are drawings, not physical tamper-evident seals. A QR code is also copyable; it is a convenient gateway to independent online validation, not proof by itself that the displayed PDF has not been modified.

**Trust only the information returned by the official, HTTPS-protected GEST verification site.** Compare the online candidate identity/photo, test date, four scores, overall score, CEFR level, centre and expiry against the presented PDF. Do not rely solely on a matching QR or a green badge in a screenshot; look at the URL and load the verification site directly.

The PDFs in this release are **not cryptographically signed** using a trusted document-signing certificate. Authenticating the *unaltered PDF file itself* requires a proper, externally trusted digital signature (e.g. PAdES) plus a suitable key custody and certificate lifecycle. Do not describe this release as digitally signed or tamper-proof.

## Deployment hardening before accepting real candidates

1. Use your own domain with HTTPS, configure `BASE_URL` to that domain **before** issuing real certificates, and allow verification only against that domain.
2. Run an external security audit and full end-to-end tests, including GET and POST verification, invalid codes, revocation, reissue and expiry.
3. Limit headquarters/admin accounts, use high-entropy credentials and preferably multi-factor authentication. Store secrets securely and never publish the `.env` file.
4. Add standards-compliant cryptographic PDF signatures backed by a protected signing key or managed signing service if organisations must verify PDFs offline.
5. If paper anti-counterfeit properties are necessary, engage a specialist security printer for **real** holographic foils, UV inks, tamper-evident substrates and serialised stock. Printed colours alone are not these protections.
6. Record and retain security/audit events according to a reviewed data retention and privacy policy.

## Fix in this maintenance release

The original release omitted the `evaluateCertificate` import in `src/routes/public.js`. As a result, a syntactically valid verification request could cause a runtime error rather than return an authentication result. The import is corrected here, and `tests/public-route-offline.test.js` exercises the real registered GET verification handler using mocked Express/SQLite dependencies without requiring npm packages.

**To update an existing Windows installation safely:** Stop the running server with Ctrl+C. Back up the `.env` file, SQLite database and `storage` directory. Replace **only** `src/routes/public.js` in the existing project with the same file from this archive; then run `npm.cmd test` and `npm.cmd start`. Do not replace your `.env` file or erase `data/` or `storage/`: doing so may invalidate existing certificates or remove records. Do not issue real certificates until integration and security reviews pass.

## New centre signatory controls

HQ-only routes `/admin/centres/:id/signature` store approved signature PNGs privately in `storage/signatures`, never in static `public/`. Uploads are size-limited and reconstructed with Sharp after content validation. Old image versions remain immutable and are referenced by newly issued certificates via `certificate_signatures`. They must be retained in protected backups and appropriately controlled under your privacy/data-retention policy. If a centre has no approved signature, new PDF issuance is blocked. These are **scanned signature images**, not a PKI digital signature.
