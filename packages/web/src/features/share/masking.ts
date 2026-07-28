// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// PII pattern redaction for peer screen share (Phase 8). Runs INSIDE the
// sharer's browser, in rrweb's serialization hooks — redaction happens before
// any byte leaves the machine.
//
// rrweb v1 constraint (D1, verified against the pinned 1.1.3):
// maskTextFn/maskInputFn receive ONLY the text — no element. Element-scoped
// decisions live in maskTextClass/maskTextSelector/blockSelector; these
// functions do pure pattern redaction.

/** Luhn checksum — payment card validation. */
export function luhnValid(digits: string): boolean {
  if (!/^\d{13,19}$/.test(digits)) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let d = digits.charCodeAt(i) - 48;
    if (alt) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    alt = !alt;
  }
  return sum % 10 === 0;
}

/** ABA routing number checksum (3-7-1 weighting) — reduces 9-digit false
 *  positives like ZIP+phone fragments. */
export function abaValid(digits: string): boolean {
  if (!/^\d{9}$/.test(digits)) return false;
  const d = [...digits].map((c) => c.charCodeAt(0) - 48);
  const sum = 3 * (d[0]! + d[3]! + d[6]!) + 7 * (d[1]! + d[4]! + d[7]!) + (d[2]! + d[5]! + d[8]!);
  return sum % 10 === 0 && sum > 0;
}

const SSN_ITIN_STRICT = /\b\d{3}-\d{2}-\d{4}\b/g;
const EIN = /\b\d{2}-\d{7}\b/g;
// 13–19 digits, optionally space/hyphen grouped (e.g. 4111 1111 1111 1111).
const CARD_CANDIDATE = /\b(?:\d[ -]?){13,19}\b/g;

/**
 * Pattern-redact sensitive numbers in captured text. Applied to every text
 * node rrweb serializes (maskTextFn). Deliberately conservative on bare digit
 * runs: hyphenated SSN/EIN always redact; a bare 9-digit run redacts only
 * when it passes the ABA checksum (routing number), because bare 9-digit
 * account/reference numbers are handled by element-level rr-mask tags (8.5).
 */
export function redactSensitiveText(text: string): string {
  if (!text || !/\d/.test(text)) return text;
  let out = text.replace(SSN_ITIN_STRICT, '•••-••-••••');
  out = out.replace(EIN, '••-•••••••');
  // Card numbers: strip grouping, Luhn-check, then redact.
  out = out.replace(CARD_CANDIDATE, (m) => {
    const digits = m.replace(/[ -]/g, '');
    return luhnValid(digits) ? '•••• •••• •••• ••••' : m;
  });
  // Bare 9-digit runs: redact only real routing numbers.
  out = out.replace(/\b\d{9}\b/g, (m) => (abaValid(m) ? '•••••••••' : m));
  return out;
}

/** Fixed-length input mask (8.6) — field width must not leak value length. */
export function maskInputFixed(_text: string): string {
  return '••••••';
}

// Class conventions (8.2):
//  rr-block  — element replaced by a same-size placeholder; nothing inside is
//              serialized. For secret-bearing surfaces (password/MFA/API keys).
//  rr-mask   — text content captured as bullets. For account-number-bearing
//              components that patterns can't safely catch (8.5).
//  rr-ignore — input events for the element are never captured.
export const RR_BLOCK_CLASS = 'rr-block';
export const RR_MASK_CLASS = 'rr-mask';
export const RR_IGNORE_CLASS = 'rr-ignore';

/** Selector-based blocking for surfaces that can't all carry the class
 *  (8.7): password/MFA inputs anywhere in the app, plus secret-bearing
 *  admin panels tagged by data attribute. */
export const BLOCK_SELECTOR = [
  'input[type="password"]',
  'input[autocomplete="one-time-code"]',
  '[data-share-block]',
  `.${RR_BLOCK_CLASS}`,
].join(', ');

/** Text-mask selector: anything tagged rr-mask or data-share-mask, plus
 *  common secret displays. */
export const MASK_TEXT_SELECTOR = [
  `.${RR_MASK_CLASS}`,
  '[data-share-mask]',
  'code[data-secret]',
].join(', ');

export const SHARE_MASKING_SUMMARY =
  'All typed input is masked. Social Security, EIN, routing and card numbers are redacted before anything leaves your browser. Password, security and API-key screens are blocked entirely.';
