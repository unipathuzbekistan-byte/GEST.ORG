# GEST — Installing centre-specific signatures on Windows

This update is for your **existing working `gest-website` folder**. You do not need to register again. Existing candidate accounts, results, certificates and credentials remain intact.

## Step 1 — Back up first

Stop your GEST server (press **Ctrl+C** in the VS Code Terminal). Make a complete copy of your `gest-website` folder to a separate location, or at minimum back up `data`, `storage`, and `.env` securely. Ensure the GEST server is fully stopped before copying live SQLite files.

## Step 2 — Apply the patch ZIP

Download `gest-centre-signature-update.zip`. Right-click → **Extract All** into a temporary location. In the extracted folder, open `src`, `views`, `tests`, etc. Copy the **contents of that extracted folder** into `C:\Users\user\Desktop\gest-website`, choosing **Replace files** when prompted. This patch intentionally contains NO `.env`, candidate database or stored PDFs, so your existing data will not be overwritten.

If you use a different GEST folder, paste into that one. Keep the folder hierarchy (`src`, `src/routes`, `views/admin`, etc.).

## Step 3 — Start GEST

From your existing VS Code project terminal:

```powershell
npm.cmd start
```

The new SQLite tables are created automatically on application start. Do not delete the old `data` or `storage` folders. You do not need to reinstall Node.js or Chrome. If dependencies are missing, run `npm.cmd install` first.

## Step 4 — Add an authorised signature

Open `http://localhost:3000/admin/centres` and log in as the **super admin**. Find **Prime School (UZ001)** → **Authorised signature**. Enter the **real full name** and **position** of the authorised person. Upload a JPEG/PNG scan of their true handwritten signature (max **1 MB**, preferably transparent PNG) and tick the authorisation checkbox. Click **Approve & save centre signature**.

Repeat for each future centre. No centre admin can upload/replace their own signature; only headquarters can. If a person leaves a centre, use **Deactivate this signature** and approve a new one. Past signed PDFs remain unchanged.

## Step 5 — Test a demo PDF

Go to the super admin result page, issue a new demo certificate (if the old certificate was revoked, use **Issue a new certificate**), download the PDF and inspect the real signature plus name/role beneath it. Check the QR link on `/verify`. The previously revoked PDF must remain **NOT VALID**.

## Before production

Keep `storage/signatures` in your encrypted backups along with SQLite, photos, PDF certificates and secrets. Rotate any credentials visible in old screenshots and commission full security/legal review before using real candidate data. A scanned handwriting image is **not** a cryptographic PDF signature; server verification remains authoritative.
