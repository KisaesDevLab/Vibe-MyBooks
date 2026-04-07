// `crypto.randomUUID()` is only available in secure contexts (HTTPS or
// localhost). When the web app is served over plain HTTP to a remote machine,
// the browser leaves `randomUUID` undefined, which crashes any form that
// generates a draft id. `crypto.getRandomValues()` is still available in
// insecure contexts, so we can build an RFC 4122 v4 UUID from it.
//
// The globalThis assignment (in addition to crypto.randomUUID =) is a safety
// net in case some browser defines crypto.randomUUID as a non-writable
// accessor in insecure contexts.
// eslint-disable-next-line no-console
console.log('[cryptoPolyfill] loaded. crypto.randomUUID is', typeof (globalThis as { crypto?: Crypto }).crypto?.randomUUID);

if (typeof crypto !== 'undefined' && typeof crypto.randomUUID !== 'function') {
  const shim = function randomUUID(): `${string}-${string}-${string}-${string}-${string}` {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    // Set version (4) and variant (10xx) bits per RFC 4122.
    bytes[6] = (bytes[6]! & 0x0f) | 0x40;
    bytes[8] = (bytes[8]! & 0x3f) | 0x80;
    const hex: string[] = [];
    for (let i = 0; i < 256; i++) {
      hex.push((i + 0x100).toString(16).slice(1));
    }
    return (
      hex[bytes[0]!]! + hex[bytes[1]!]! + hex[bytes[2]!]! + hex[bytes[3]!]! + '-' +
      hex[bytes[4]!]! + hex[bytes[5]!]! + '-' +
      hex[bytes[6]!]! + hex[bytes[7]!]! + '-' +
      hex[bytes[8]!]! + hex[bytes[9]!]! + '-' +
      hex[bytes[10]!]! + hex[bytes[11]!]! + hex[bytes[12]!]! +
      hex[bytes[13]!]! + hex[bytes[14]!]! + hex[bytes[15]!]!
    ) as `${string}-${string}-${string}-${string}-${string}`;
  };

  try {
    Object.defineProperty(crypto, 'randomUUID', {
      value: shim,
      writable: true,
      configurable: true,
    });
    // eslint-disable-next-line no-console
    console.log('[cryptoPolyfill] installed on crypto.randomUUID');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[cryptoPolyfill] could not install on crypto, falling back to globalThis.crypto', err);
  }
}
