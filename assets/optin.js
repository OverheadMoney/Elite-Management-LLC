/* Elite Management LLC — The Operating Brief: email opt-in with a 6-digit confirmation code.
   PROPRIETARY AND CONFIDENTIAL. © 2026 Elite Management LLC. All rights reserved.
   Any <form data-optin> with an email input (and optional first-name input) gets:
   step 1: email -> we email a 6-digit code from value@elitemgmt.io
   step 2: enter the code -> confirmed -> the workbook opens (key returned by the server). */
(function () {
  var EP = 'https://script.google.com/macros/s/AKfycbzLnqwJ0RCMK_ipdjYpeQOq-TG16Y0YSsXvq6RopfLcTbZWCfQlTv3rQTe1_644qyyY7g/exec';
  var KEY_STORE = 'elite-brief-key', EMAIL_STORE = 'elite-brief-email', NAME_STORE = 'elite-brief-first';

  var css = '' +
    '.oc-step{animation:ocIn .35s ease both}@keyframes ocIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}' +
    '.oc-step h3{font-family:"Bodoni Moda",Didot,Georgia,serif;font-weight:400;font-size:28px;line-height:1.15;margin:0 0 6px;color:inherit}' +
    '.oc-step p{margin:0 0 16px;font-size:15px;opacity:.85;line-height:1.5}' +
    '.oc-step p b{opacity:1;word-break:break-all}' +
    '.oc-code{display:block;width:100%;box-sizing:border-box;padding:14px 10px!important;margin:0 0 14px!important;text-align:center;font-family:"JetBrains Mono",Menlo,monospace!important;font-weight:500;font-size:30px!important;letter-spacing:.42em;text-indent:.42em;border-radius:3px!important;background:#07090d!important;border:1px solid rgba(214,190,140,.32)!important;color:#f0d59a!important}' +
    '.oc-row{display:flex;gap:10px;align-items:stretch;margin:0 0 14px}.oc-row .oc-code{margin:0!important;flex:1;min-width:0}' +
    '.oc-paste{flex:none;padding:0 18px;border-radius:3px;border:1.5px solid currentColor;background:transparent;color:inherit;font:inherit;font-weight:700;font-size:15px;cursor:pointer;opacity:.85}.oc-paste:hover{opacity:1}' +
    '.oc-links{display:flex;justify-content:space-between;gap:12px;margin-top:14px;font-size:13.5px}' +
    '.oc-links button{background:none;border:0;padding:0;color:inherit;opacity:.75;text-decoration:underline;cursor:pointer;font:inherit}' +
    '.oc-links button[disabled]{opacity:.4;cursor:default;text-decoration:none}' +
    '.oc-msg{margin-top:12px;font-size:14.5px;min-height:20px;line-height:1.4}.oc-msg.err{color:#e08a7a}.oc-msg.ok{color:#f0d59a}' +
    '.oc-done{text-align:center;padding:10px 0}.oc-done .tick{width:54px;height:54px;border-radius:50%;margin:0 auto 12px;display:grid;place-items:center;background:#d2b06c;color:#07090d;font-size:26px;font-weight:700}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  function post(data) {
    var body = new URLSearchParams(data);
    return fetch(EP, { method: 'POST', body: body }).then(function (r) { return r.json(); })
      .catch(function () { return { status: 'error' }; });
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function storeKey(k) { try { localStorage.setItem(KEY_STORE, k); } catch (e) {} }
  function storeWho(email, first) { try { localStorage.setItem(EMAIL_STORE, email); if (first) localStorage.setItem(NAME_STORE, first); } catch (e) {} }

  function init(form) {
    var source = form.getAttribute('data-source') || 'website';
    var original = form.innerHTML;
    form.addEventListener('submit', function (ev) {
      if (form.dataset.step === 'code') return;           // handled by step 2
      ev.preventDefault(); ev.stopImmediatePropagation();
      var emailEl = form.querySelector('input[type=email]');
      var firstEl = form.querySelector('input[name=first], input[autocomplete=given-name]');
      var hp = form.querySelector('input[name=company]');
      var btn = form.querySelector('button[type=submit]');
      var msg = form.querySelector('.msg, .oc-msg');
      var email = (emailEl.value || '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        if (msg) { msg.className = msg.className.replace(/\b(ok|err)\b/g, '') + ' err'; msg.textContent = 'That email doesn’t look right — check it and try again.'; }
        emailEl.focus(); return;
      }
      var label = btn.textContent; btn.disabled = true; btn.textContent = 'Sending your code…';
      var data = { action: 'request', email: email, first: firstEl ? firstEl.value.trim() : '', company: hp ? hp.value : '',
        source: source, ref: location.href.split('#')[0], ua: navigator.userAgent.slice(0, 200) };
      post(data).then(function (j) {
        btn.disabled = false; btn.textContent = label;
        if (j.status === 'code_sent' || j.status === 'wait') return codeStep(form, data, original);
        if (msg) { msg.className = 'msg err'; msg.textContent = j.status === 'invalid' ? 'That email was rejected. Try a different address.'
          : j.status === 'limit' ? 'Too many codes requested for this address. Try again in an hour.'
          : 'Something went wrong on our end. Email value@elitemgmt.io and we’ll send it by hand.'; }
      });
    }, true);
  }

  function codeStep(form, data, original) {
    form.dataset.step = 'code';
    form.innerHTML = '<div class="oc-step">' +
      '<h3>Check your inbox for a code.</h3>' +
      '<p>We sent a 6-digit code to <b>' + esc(data.email) + '</b> from value@elitemgmt.io. Enter it below to open the Operating Brief.</p>' +
      '<div class="oc-row"><input class="oc-code" type="text" inputmode="numeric" autocomplete="one-time-code" placeholder="••••••" aria-label="6-digit code"><button type="button" class="oc-paste" data-a="paste" aria-label="Paste code">Paste</button></div>' +
      '<button class="btn" type="submit">Confirm and open the workbook</button>' +
      '<div class="oc-msg" aria-live="polite"></div>' +
      '<div class="oc-links"><button type="button" data-a="resend">Resend code</button><button type="button" data-a="change">Use a different email</button></div>' +
      '<p style="margin:14px 0 0;font-size:12.5px;opacity:.6">Not there? Check Promotions or Spam. The code works for 15 minutes.</p></div>';
    var input = form.querySelector('.oc-code'), btn = form.querySelector('button[type=submit]'), msg = form.querySelector('.oc-msg');
    var resend = form.querySelector('[data-a=resend]');
    input.focus();
    cooldown(resend, 45);
    function setCode(t) {
      var d = String(t || '').replace(/\D/g, '');
      if (d.length > 6) { var m = String(t).match(/\b\d{6}\b/); d = m ? m[0] : d.slice(0, 6); }
      input.value = d;
      if (d.length === 6) verify();
    }
    input.addEventListener('input', function () { setCode(input.value); });
    input.addEventListener('paste', function (e) {
      var t = (e.clipboardData || window.clipboardData);
      if (t) { e.preventDefault(); setCode(t.getData('text')); }
    });
    var pasteBtn = form.querySelector('[data-a=paste]');
    if (!(navigator.clipboard && navigator.clipboard.readText)) pasteBtn.style.display = 'none';
    pasteBtn.onclick = function () {
      navigator.clipboard.readText().then(function (t) {
        if (!/\d/.test(t)) { msg.className = 'oc-msg err'; msg.textContent = 'No code on your clipboard yet. Copy it from the email first.'; return; }
        setCode(t);
      }).catch(function () { input.focus(); msg.className = 'oc-msg'; msg.textContent = 'Press and hold in the box, then tap Paste.'; });
    };
    form._ocSetCode = setCode;
    form.onsubmit = function (ev) { ev.preventDefault(); verify(); };
    form.querySelector('[data-a=change]').onclick = function () {
      form.dataset.step = ''; form.onsubmit = null; form.innerHTML = original;
      var e = form.querySelector('input[type=email]'); if (e) { e.value = data.email; e.focus(); }
    };
    resend.onclick = function () {
      resend.disabled = true; msg.className = 'oc-msg'; msg.textContent = 'Sending a new code…';
      post(Object.assign({}, data, { action: 'request' })).then(function (j) {
        if (j.status === 'code_sent') { msg.className = 'oc-msg ok'; msg.textContent = 'New code sent. Use the newest one.'; cooldown(resend, 45); }
        else if (j.status === 'limit') { msg.className = 'oc-msg err'; msg.textContent = 'Too many codes for this address. Try again in an hour.'; }
        else if (j.status === 'wait') { msg.className = 'oc-msg'; msg.textContent = 'Give it a minute — the last code is still on its way.'; cooldown(resend, 30); }
        else { msg.className = 'oc-msg err'; msg.textContent = 'Couldn’t send a new code. Try again in a moment.'; resend.disabled = false; }
      });
    };
    var busy = false;
    function verify() {
      if (busy) return;
      var code = input.value.replace(/\D/g, '');
      if (code.length !== 6) { msg.className = 'oc-msg err'; msg.textContent = 'Enter all 6 digits.'; input.focus(); return; }
      busy = true; btn.disabled = true; btn.textContent = 'Verifying…'; msg.textContent = '';
      post({ action: 'verify', email: data.email, code: code }).then(function (j) {
        busy = false; btn.disabled = false; btn.textContent = 'Confirm and open the workbook';
        if ((j.status === 'ok' || j.status === 'exists') && j.key) { storeWho(data.email, data.first); return done(form, j.key); }
        msg.className = 'oc-msg err';
        msg.textContent = j.status === 'wrong' ? 'That code doesn’t match. ' + (j.left ? j.left + ' tr' + (j.left === 1 ? 'y' : 'ies') + ' left.' : '')
          : j.status === 'expired' ? 'That code has expired. Tap “Resend code” for a new one.'
          : j.status === 'locked' ? 'Too many wrong tries. Tap “Resend code” for a new one.'
          : 'Something went wrong on our end. Try again in a moment.';
        input.select();
      });
    }
  }

  function cooldown(b, s) {
    b.disabled = true; var t = s, base = 'Resend code';
    b.textContent = base + ' (' + t + 's)';
    var iv = setInterval(function () { t--; if (t <= 0) { clearInterval(iv); b.disabled = false; b.textContent = base; } else b.textContent = base + ' (' + t + 's)'; }, 1000);
  }

  function done(form, key) {
    storeKey(key);
    if (typeof window.eliteUnlock === 'function') {                 // on the workbook page itself
      form.innerHTML = '<div class="oc-done"><div class="tick">✓</div><h3 style="margin:0">You’re in.</h3></div>';
      setTimeout(function () { window.eliteUnlock(key); }, 500);
      return;
    }
    var url = '/workbook/#k=' + key;
    form.innerHTML = '<div class="oc-done oc-step"><div class="tick">✓</div>' +
      '<h3>You’re confirmed.</h3><p>Opening the Operating Brief… We also emailed you the link and a fillable PDF copy.</p>' +
      '<a class="btn" href="' + url + '" style="width:auto">Open the workbook →</a></div>';
    setTimeout(function () { location.href = url; }, 1400);
  }

  function boot() {
    var forms = document.querySelectorAll('form[data-optin]');
    Array.prototype.forEach.call(forms, init);
    // One-tap confirm link from the code email: ...#e=EMAIL&c=CODE
    var h = new URLSearchParams(location.hash.slice(1)), e = h.get('e'), c = h.get('c');
    if (forms[0] && e && c && /^\d{6}$/.test(c)) {
      try { history.replaceState(null, '', location.pathname + location.search); } catch (x) {}
      var f = forms[0];
      if (f.scrollIntoView) f.scrollIntoView({ block: 'center' });
      codeStep(f, { action: 'request', email: e, source: f.getAttribute('data-source') || 'website' }, f.innerHTML);
      setTimeout(function () { f._ocSetCode(c); }, 150);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
