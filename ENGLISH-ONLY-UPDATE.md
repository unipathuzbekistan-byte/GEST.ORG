# GEST v1.4.2 — English-only Website

GEST now uses **English as its sole interface language** across the entire public website and candidate, centre and headquarters portals.

- No EN / UZ / RU menu or language switcher.
- The `<html>` language tag is `en` on all website pages.
- Existing English EJS translation calls continue to use `locales/en.json`.
- `locales/uz.json` and `locales/ru.json` are no longer required.
- Old `gest_lang` preference cookies are cleared and ignored. Old `/lang/...` bookmarks redirect to the English homepage.
- Booking, identity verification, scores, PDFs, certificates and payments are unchanged.

This is a language-only update. It does not modify or reset your SQLite database, uploaded documents, stored signatures or environment secrets. Do not overwrite `.env`, `data`, or `storage`.

See the Uzbek-language `INSTALL-UZ.md` in the patch ZIP for step-by-step Windows installation instructions.
