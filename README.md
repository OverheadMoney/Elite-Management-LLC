# elitemgmt.io — Elite Management LLC

Static marketing site for Elite Management LLC. One HTML file, no build step, hosted on GitHub Pages at the custom domain **elitemgmt.io**. Inbound mail is forwarded by ImprovMX; the intake form emails briefs to **value@elitemgmt.io**.

## Repository layout

| File | Purpose |
|---|---|
| `index.html` | The entire site (markup, styles, Three.js scenes, intake form). |
| `CNAME` | Tells GitHub Pages to serve at `elitemgmt.io`. Do not delete. |
| `.nojekyll` | Disables Jekyll processing so files are served as-is. |
| `robots.txt`, `sitemap.xml` | Search-engine basics. |

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

## 5. Intake form → your inbox

GitHub Pages is static, so the form posts to Web3Forms, which emails each brief to `value@elitemgmt.io` (free tier, no server needed).

1. Go to https://web3forms.com, enter `value@elitemgmt.io`, confirm the email it sends (it arrives through ImprovMX), and copy the **access key**.
2. In `index.html`, find:
   ```js
   const FORM_ACCESS_KEY = 'PASTE-YOUR-WEB3FORMS-ACCESS-KEY-HERE';
   ```
   and paste the key. Commit and push.

Until the key is set, the form still works: it formats the brief and shows a **Copy brief** button with instructions to email `value@elitemgmt.io`.

Each submission emails: name, title, company, industry, email, phone (optional), revenue and team ranges (optional), current state, future goals, areas of interest, and timing. A hidden honeypot field drops bots.

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
© 2026 Elite Management LLC. All rights reserved.
