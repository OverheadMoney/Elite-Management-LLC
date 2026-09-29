/**
 * ============================================================================
 * ELITE MANAGEMENT LLC — PROPRIETARY AND CONFIDENTIAL
 * ----------------------------------------------------------------------------
 * Copyright (c) 2026 Elite Management LLC. All rights reserved.
 *
 * This script and the data it processes are the confidential and proprietary
 * information of Elite Management LLC. Unauthorized copying, modification,
 * distribution, or other dissemination, in whole or in part, is strictly
 * prohibited without the prior written consent of Elite Management LLC.
 * Client submissions handled by this script are confidential business
 * records and must be handled in accordance with the Privacy Notice at
 * https://elitemgmt.io. Questions: value@elitemgmt.io
 * ============================================================================
 */

/**
 * Elite Management — intake web app
 * Receives briefs POSTed from elitemgmt.io, logs each to a Google Sheet,
 * emails the brief to the inbox, and sends the prospect a confirmation.
 *
 * Standalone script. On first run it creates 'Elite Management — Inquiries' in Drive and stores its id.
 * Deploy: Deploy → New deployment → Web app → Execute as: Me → Who has access: Anyone.
 * Paste the /exec URL into index.html as INTAKE_URL and set the same FORM_TOKEN in both places.
 * Run sheetUrl() any time to get the spreadsheet link.
 */

var CONFIG = {
  INBOX: 'value@elitemgmt.io',                 // where briefs are delivered
  FROM_NAME: 'Elite Management',
  SHEET_NAME: 'Inquiries',                     // tab name inside the bound spreadsheet
  FORM_TOKEN: '9eeba2924ae448c7864cb597cde7a286550524027570ba2c', // must match INTAKE_TOKEN in index.html
  SEND_CONFIRMATION: true,
  MAX_FIELD: 5000                              // characters per text field
};

var HEADERS = ['Received', 'Name', 'Title', 'Company', 'Industry', 'Email', 'Phone',
  'Revenue', 'Team', 'Current state', 'Future goals', 'Areas', 'Timing', 'Source', 'Status'];

/** Health check: open the /exec URL in a browser. */
function doGet() {
  return json_({ ok: true, service: 'elitemgmt-intake', version: 'v3-branded', time: new Date().toISOString() });
}

/** Form submissions. Body is JSON sent as text/plain (keeps the request "simple", no CORS preflight). */
function doPost(e) {
  try {
    var raw = (e && e.postData && e.postData.contents) || '';
    var body;
    try { body = JSON.parse(raw); } catch (err) { return json_({ ok: false, error: 'bad_json' }); }

    if (body.website) return json_({ ok: true, ignored: true });          // honeypot filled → silently drop
    if (CONFIG.FORM_TOKEN && body.token !== CONFIG.FORM_TOKEN) return json_({ ok: false, error: 'unauthorized' });

    var d = clean_(body);
    var problems = validate_(d);
    if (problems.length) return json_({ ok: false, error: 'invalid', fields: problems });

    var receivedAt = new Date();
    var rowNumber = appendRow_(receivedAt, d);
    notifyInbox_(d, receivedAt, rowNumber);
    if (CONFIG.SEND_CONFIRMATION) confirmProspect_(d);

    return json_({ ok: true, id: rowNumber });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: 'server', message: String(err && err.message || err) });
  }
}

/* ---------- helpers ---------- */

function clean_(b) {
  var s = function (v) { return String(v == null ? '' : v).trim().slice(0, CONFIG.MAX_FIELD); };
  return {
    name: s(b.name), title: s(b.title), company: s(b.company), industry: s(b.industry),
    email: s(b.email).toLowerCase(), phone: s(b.phone), revenue: s(b.revenue), team: s(b.team),
    currentState: s(b.currentState), futureGoals: s(b.futureGoals),
    areas: Array.isArray(b.areas) ? b.areas.map(s).filter(String).join(', ') : s(b.areas),
    timing: s(b.timing), source: s(b.source) || 'elitemgmt.io'
  };
}

function validate_(d) {
  var p = [];
  if (!d.name) p.push('name');
  if (!d.company) p.push('company');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) p.push('email');
  if (!d.currentState) p.push('currentState');
  if (!d.futureGoals) p.push('futureGoals');
  return p;
}

function spreadsheet_() {
  // Standalone script: create the log spreadsheet once in Drive and remember its id.
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SHEET_ID');
  if (id) { try { return SpreadsheetApp.openById(id); } catch (e) { /* deleted — recreate */ } }
  var ss = SpreadsheetApp.create('Elite Management — Inquiries');
  props.setProperty('SHEET_ID', ss.getId());
  return ss;
}

function sheet_() {
  var ss = spreadsheet_();
  var sh = ss.getSheetByName(CONFIG.SHEET_NAME) || ss.insertSheet(CONFIG.SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function appendRow_(when, d) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sh = sheet_();
    sh.appendRow([when, d.name, d.title, d.company, d.industry, d.email, d.phone, d.revenue, d.team,
      d.currentState, d.futureGoals, d.areas, d.timing, d.source, 'new']);
    return sh.getLastRow();
  } finally {
    lock.releaseLock();
  }
}

function briefText_(d, when, row) {
  var lines = [
    'NEW BRIEF — ' + d.company,
    'Received: ' + Utilities.formatDate(when, Session.getScriptTimeZone(), 'EEE, MMM d yyyy h:mm a z'),
    'Row: ' + row,
    '',
    'Name:     ' + d.name + (d.title ? ' (' + d.title + ')' : ''),
    'Company:  ' + d.company + (d.industry ? ' · ' + d.industry : ''),
    'Email:    ' + d.email,
    'Phone:    ' + (d.phone || '—'),
    'Revenue:  ' + (d.revenue || '—'),
    'Team:     ' + (d.team || '—'),
    'Timing:   ' + (d.timing || '—'),
    'Areas:    ' + (d.areas || '—'),
    '',
    'CURRENT STATE', d.currentState, '',
    'FUTURE GOALS', d.futureGoals
  ];
  return lines.join('\n');
}


/* ---------- email chrome ---------- */

var SEAL_URL = 'https://elitemgmt.io/assets/seal-140.png';

function esc_(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function nl_(s) { return esc_(s).replace(/\n/g, '<br>'); }

/** Branded signature card + confidentiality line (table-based; renders in Gmail, Outlook, Apple Mail, light or dark). */
function signature_() {
  return '' +
  '<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;font-family:Helvetica,Arial,sans-serif;max-width:560px;margin-top:28px">' +
  '<tr><td style="padding:0">' +
    '<table cellpadding="0" cellspacing="0" border="0" role="presentation" bgcolor="#0d1118" style="border-collapse:separate;background:#0d1118;border:1px solid #2a2f3a;border-radius:4px;width:100%;max-width:560px">' +
    '<tr>' +
      '<td width="150" valign="middle" style="padding:22px 6px 22px 22px;width:150px"><a href="https://elitemgmt.io" style="text-decoration:none"><img src="' + SEAL_URL + '" width="128" height="84" alt="Elite Management LLC seal" style="display:block;width:128px;height:auto;border:0;outline:none"></a></td>' +
      '<td width="1" style="width:1px;padding:0;background:#3b3527;line-height:1px;font-size:1px">&nbsp;</td>' +
      '<td valign="middle" style="padding:20px 22px 20px 22px">' +
        '<div style="font-family:Georgia,\'Times New Roman\',serif;font-size:20px;line-height:1.15;color:#ecebe6;letter-spacing:.01em">Elite Management <span style="font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:.18em;color:#d2b06c;vertical-align:3px">LLC</span></div>' +
        '<div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:#d2b06c;letter-spacing:.14em;text-transform:uppercase;margin-top:4px">Operating &middot; Financial &middot; Growth Advisory</div>' +
        '<div style="font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:#a8adb5;margin-top:12px"><a href="mailto:' + CONFIG.INBOX + '" style="color:#a8adb5;text-decoration:none">' + CONFIG.INBOX + '</a></div>' +
        '<div style="font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:#a8adb5"><a href="https://elitemgmt.io" style="color:#f0d59a;text-decoration:none">elitemgmt.io</a><span style="color:#6e747d">&nbsp;&nbsp;&middot;&nbsp;&nbsp;Orange County, California</span></div>' +
      '</td>' +
    '</tr>' +
    '</table>' +
  '</td></tr>' +
  '<tr><td style="padding:10px 2px 0 2px;font-family:Helvetica,Arial,sans-serif;font-size:10px;line-height:1.5;color:#8a8f98;max-width:560px">' +
    'CONFIDENTIAL. This message and any attachments are the proprietary and confidential information of Elite Management LLC, intended solely for the addressee. If you received it in error, please notify the sender and delete it; any review, use, or dissemination is prohibited. Nothing herein constitutes legal, tax, accounting, or investment advice, and no engagement exists absent a signed engagement letter. ' +
    '&copy; 2026 Elite Management LLC. All rights reserved.' +
  '</td></tr>' +
  '</table>';
}

/** Wraps body HTML in the site's dark header + light reading panel. */
function shell_(eyebrow, title, bodyHtml) {
  return '' +
  '<div style="background:#07090d;padding:32px 16px;font-family:Helvetica,Arial,sans-serif">' +
  '<table cellpadding="0" cellspacing="0" border="0" role="presentation" align="center" style="border-collapse:separate;width:100%;max-width:600px;margin:0 auto">' +
    '<tr><td style="padding:0 0 18px 0">' +
      '<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse"><tr>' +
        '<td valign="middle" style="padding-right:12px"><img src="' + SEAL_URL + '" width="56" height="37" alt="" style="display:block;width:56px;height:auto;border:0"></td>' +
        '<td valign="middle" style="font-family:Georgia,\'Times New Roman\',serif;font-size:18px;color:#ecebe6">Elite Management <span style="font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:.18em;color:#d2b06c;vertical-align:2px">LLC</span></td>' +
      '</tr></table>' +
    '</td></tr>' +
    '<tr><td bgcolor="#ffffff" style="background:#ffffff;border-radius:4px;padding:34px 34px 30px 34px">' +
      '<div style="font-family:Courier,monospace;font-size:11px;letter-spacing:.2em;color:#a8863f;text-transform:uppercase">' + esc_(eyebrow) + '</div>' +
      '<h1 style="font-family:Georgia,\'Times New Roman\',serif;font-weight:normal;font-size:28px;line-height:1.15;color:#111;margin:10px 0 22px 0">' + esc_(title) + '</h1>' +
      '<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#222">' + bodyHtml + '</div>' +
    '</td></tr>' +
    '<tr><td style="padding:0">' + signature_() + '</td></tr>' +
  '</table></div>';
}

function notifyInbox_(d, when, row) {
  var rows = [
    ['Name', d.name + (d.title ? ' (' + d.title + ')' : '')], ['Company', d.company + (d.industry ? ' · ' + d.industry : '')],
    ['Email', d.email], ['Phone', d.phone || '—'], ['Revenue', d.revenue || '—'], ['Team', d.team || '—'],
    ['Timing', d.timing || '—'], ['Areas', d.areas || '—']
  ].map(function (r) { return '<tr><td style="padding:7px 14px 7px 0;color:#6e747d;font-family:Courier,monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;vertical-align:top;white-space:nowrap">' + r[0] + '</td><td style="padding:7px 0;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#111">' + esc_(r[1]) + '</td></tr>'; }).join('');
  var body = '' +
    '<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse">' + rows + '</table>' +
    '<h3 style="margin:26px 0 6px;font-family:Courier,monospace;font-weight:normal;font-size:11px;letter-spacing:.2em;color:#a8863f">CURRENT STATE</h3><p style="margin:0">' + nl_(d.currentState) + '</p>' +
    '<h3 style="margin:22px 0 6px;font-family:Courier,monospace;font-weight:normal;font-size:11px;letter-spacing:.2em;color:#a8863f">FUTURE GOALS</h3><p style="margin:0">' + nl_(d.futureGoals) + '</p>' +
    '<p style="margin:26px 0 0;font-size:12px;color:#6e747d;border-top:1px solid #e6e2d8;padding-top:14px">Logged to the Inquiries sheet, row ' + row + ', ' + Utilities.formatDate(when, Session.getScriptTimeZone(), 'EEE, MMM d yyyy h:mm a z') + '. Reply to this email to answer ' + esc_(d.name.split(' ')[0]) + ' directly.</p>';

  MailApp.sendEmail({
    to: CONFIG.INBOX,
    replyTo: d.email,
    name: CONFIG.FROM_NAME + ' Intake',
    subject: 'New brief: ' + d.company + ' — ' + d.name,
    body: briefText_(d, when, row),
    htmlBody: shell_('New brief · ' + d.timing, d.company, body)
  });
}

function confirmProspect_(d) {
  var first = d.name.split(' ')[0];
  var text = first + ',\n\nThank you. Your brief for ' + d.company + ' is in front of a principal at Elite Management LLC. ' +
    'You will hear from us within two business days with clarifying questions and a proposed scope.\n\n' +
    'If anything changes in the meantime, reply to this email.\n\n— Elite Management LLC\n' + CONFIG.INBOX + '\nelitemgmt.io\n\n' +
    'CONFIDENTIAL. This message is the proprietary and confidential information of Elite Management LLC, intended solely for the addressee. Nothing herein constitutes legal, tax, accounting, or investment advice, and no engagement exists absent a signed engagement letter.';
  var body = '' +
    '<p style="margin:0 0 16px">' + esc_(first) + ',</p>' +
    '<p style="margin:0 0 16px">Thank you. Your brief for <b>' + esc_(d.company) + '</b> is in front of a principal at Elite Management LLC. You will hear from us within two business days with clarifying questions and a proposed scope.</p>' +
    '<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;margin:6px 0 20px">' +
      '<tr><td style="padding:6px 14px 6px 0;font-family:Courier,monospace;font-size:11px;letter-spacing:.14em;color:#a8863f;vertical-align:top">01</td><td style="padding:6px 0;font-size:14px;color:#222">We reply with three clarifying questions and a proposed scope.</td></tr>' +
      '<tr><td style="padding:6px 14px 6px 0;font-family:Courier,monospace;font-size:11px;letter-spacing:.14em;color:#a8863f;vertical-align:top">02</td><td style="padding:6px 0;font-size:14px;color:#222">A 45-minute working session, no charge, to confirm fit.</td></tr>' +
      '<tr><td style="padding:6px 14px 6px 0;font-family:Courier,monospace;font-size:11px;letter-spacing:.14em;color:#a8863f;vertical-align:top">03</td><td style="padding:6px 0;font-size:14px;color:#222">A written engagement letter. You decide.</td></tr>' +
    '</table>' +
    '<p style="margin:0">If anything changes in the meantime, reply to this email.</p>';
  MailApp.sendEmail({
    to: d.email,
    replyTo: CONFIG.INBOX,
    name: CONFIG.FROM_NAME + ' LLC',
    subject: 'We received your brief — Elite Management LLC',
    body: text,
    htmlBody: shell_('Brief received', 'Thank you, ' + first + '.', body)
  });
}

/** Prints the log spreadsheet URL. */
function sheetUrl() { Logger.log(spreadsheet_().getUrl()); }

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Run once from the editor to grant Sheets + Mail permissions and prove the wiring. */
function selfTest() {
  var res = doPost({ postData: { contents: JSON.stringify({
    token: CONFIG.FORM_TOKEN, name: 'Self Test', title: 'Owner', company: 'Test Co', industry: 'Testing',
    email: Session.getActiveUser().getEmail() || CONFIG.INBOX, phone: '', revenue: '$1M – $5M', team: '11 – 50',
    currentState: 'Self-test submission from the Apps Script editor.', futureGoals: 'Confirm the intake wire works end to end.',
    areas: ['Operating diagnostic'], timing: 'Just researching', source: 'selfTest'
  }) } });
  Logger.log(res.getContent());
}
