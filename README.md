# elitemgmt.io — Elite Management LLC

Static marketing site for Elite Management LLC. One HTML file, no build step, hosted on GitHub Pages at the custom domain **elitemgmt.io**. Inbound mail is forwarded by ImprovMX; the intake form emails briefs to **value@elitemgmt.io**.

## Repository layout

| File | Purpose |
|---|---|
| `index.html` | The entire site (markup, styles, Three.js scenes, intake form). |
| `CNAME` | Tells GitHub Pages to serve at `elitemgmt.io`. Do not delete. |
| `.nojekyll` | Disables Jekyll processing so files are served as-is. (Dotfiles are hidden in the macOS file picker: if you upload through the GitHub website, create this one with **Add file → Create new file**.) |
| `robots.txt`, `sitemap.xml` | Search-engine basics. |
| `apps-script/Code.gs`, `apps-script/appsscript.json` | The intake web app (deploy into your Google account, see §5). |
| `assets/seal.png`, `assets/seal-140.png` | The 3D seal rendered to PNG; used by the emails and signature. |
| `signature.html` | Email signature generator: open https://elitemgmt.io/signature.html, fill in name/title, Copy, paste into Gmail → Settings → Signature. |

Three.js loads from cdnjs (`three.js r128`). Fonts load from Google Fonts. Nothing else is fetched.

## 1. Create the repository and publish with GitHub Pages

```bash
# on your machine, inside this folder
git init -b main
git add .
git commit -m "Elite Management site — initial launch"
gh repo create elitemgmt-site --private --source=. --push   # or create it on github.com and push
```

Then on GitHub: **Settings → Pages**
- Source: *Deploy from a branch*
- Branch: `main` / `/ (root)` → Save
- Custom domain: `elitemgmt.io` → Save (GitHub reads `CNAME` and checks DNS)
- Once DNS below propagates, tick **Enforce HTTPS**.

The site is live at `https://<your-username>.github.io/elitemgmt-site/` immediately and at `https://elitemgmt.io` once DNS resolves.

## 2. DNS records (at your domain registrar)

Add these records on the `elitemgmt.io` zone. Keep the ImprovMX values that its dashboard shows you if they differ.

### GitHub Pages (website)

| Type | Host | Value |
|---|---|---|
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| AAAA | `@` | `2606:50c0:8000::153` |
| AAAA | `@` | `2606:50c0:8001::153` |
| AAAA | `@` | `2606:50c0:8002::153` |
| AAAA | `@` | `2606:50c0:8003::153` |
| CNAME | `www` | `<your-username>.github.io` |

Confirm the current IPs against GitHub's own page before saving: https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site

### ImprovMX (receive mail)

| Type | Host | Value | Priority |
|---|---|---|---|
| MX | `@` | `mx1.improvmx.com` | 10 |
| MX | `@` | `mx2.improvmx.com` | 20 |
| TXT | `@` | `v=spf1 include:spf.improvmx.com ~all` | — |

Remove any other MX records the registrar pre-filled (parking MX records will break delivery).

### DKIM / DMARC (recommended, for sending)

ImprovMX shows DKIM `CNAME` records in its dashboard once the domain is added. Add those, then add a DMARC policy:

| Type | Host | Value |
|---|---|---|
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:value@elitemgmt.io` |

Tighten `p=none` to `p=quarantine` after a couple of weeks of clean reports.

## 3. ImprovMX setup

1. Sign in at improvmx.com → **Add domain** → `elitemgmt.io`.
2. Create alias `value` → forward to your Gmail address. Add a catch-all (`*`) too, so nothing bounces.
3. Wait for the dashboard to show MX and SPF as green.
4. **SMTP credentials** (paid plan required): create a credential for `value@elitemgmt.io` and set a password. You'll use it in Gmail below.

## 4. Gmail — send as value@elitemgmt.io

Gmail → Settings → **Accounts and Import** → *Send mail as* → **Add another email address**

| Field | Value |
|---|---|
| Name | Elite Management |
| Email | `value@elitemgmt.io` |
| Treat as an alias | ✔ |
| SMTP server | `smtp.improvmx.com` |
| Port | `587` |
| Username | `value@elitemgmt.io` |
| Password | the ImprovMX SMTP credential password |
| Security | TLS |

Gmail emails a confirmation code to `value@elitemgmt.io`; it arrives in your inbox via the ImprovMX forward. Paste the code, then set `value@elitemgmt.io` as **default** and choose *Reply from the same address the message was sent to*.

> Heads-up: ImprovMX's own guide notes that Google is retiring Gmail's "Send mail as" in January 2027. The receive side is unaffected. Before then, plan to move sending to Google Workspace on the domain or another sender.

## 5. Intake form → Google Sheet + your inbox (Apps Script web app)

GitHub Pages is static, so the form posts to a small Google Apps Script web app that lives in your own Google account. Code is in `apps-script/`. Each brief is appended to a Google Sheet, emailed to `value@elitemgmt.io` with reply-to set to the prospect, and the prospect gets a confirmation.

**Deploy (about 5 minutes):**

1. In Google Drive (the account that will own the log), create a new **Google Sheet** named `Elite Management — Inquiries`.
2. In that sheet: **Extensions → Apps Script**. Delete the default code, paste in `apps-script/Code.gs`. Optionally **Project Settings → Show "appsscript.json"** and paste `apps-script/appsscript.json` over it.
3. In `Code.gs`, set `CONFIG.FORM_TOKEN` to a long random string (e.g. run `openssl rand -hex 24` in Terminal). Save.
4. Select the `selfTest` function → **Run**. Approve the Sheets + Mail permissions when asked. Check: a row appears in the `Inquiries` tab, and two emails arrive (the brief to value@ and a confirmation to you).
5. **Deploy → New deployment → Type: Web app** → Description "intake v1" → Execute as **Me** → Who has access **Anyone** → Deploy. Copy the **Web app URL** (ends in `/exec`). Open it in a browser: you should see `{"ok":true,"service":"elitemgmt-intake",...}`.
6. In `index.html`, set:
   ```js
   const INTAKE_URL   = 'https://script.google.com/macros/s/…/exec';
   const INTAKE_TOKEN = 'the same string as CONFIG.FORM_TOKEN';
   ```
   Commit and push. Submit a test brief on the live site.

**Later edits to Code.gs:** Deploy → **Manage deployments** → pencil → Version **New** → Deploy. The `/exec` URL stays the same.

**How the request works:** the page sends the JSON body as `text/plain`, which keeps the request "simple" (no CORS preflight, which Apps Script can't answer), and Apps Script replies with JSON. The token is a light shared secret to keep random bots off the endpoint; a hidden honeypot field catches form-fillers. Until `INTAKE_URL` is set, the form falls back to a **Copy brief** button with instructions to email `value@elitemgmt.io`.

**Sending identity:** confirmations go out from the Google account that deployed the script, with reply-to `value@elitemgmt.io`. The Gmail send-as alias above does not apply to `MailApp`. If you want confirmations to come *from* value@elitemgmt.io, that needs Google Workspace on the domain.

## 6. Editing the site

Everything is in `index.html`:

- **Copy** — search for the section ids `#practice`, `#ascent`, `#principles`, `#intake`.
- **Colors and type** — the `:root` block at the top of `<style>`.
- **Contact email** — search `value@elitemgmt.io` (appears in the intake aside and the form fallback).
- **The Ascent figures** — the `lerp(18,31,e)` style lines in `updateAscent()`; they're illustrative.

Push to `main` and GitHub Pages redeploys in about a minute.

## Local preview

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

---
**© 2026 Elite Management LLC. All rights reserved. Proprietary and confidential.** This repository and its contents may not be copied, distributed or disseminated without the prior written consent of Elite Management LLC. See `LICENSE`.
