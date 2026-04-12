# External API & SDK Reference

A portable reference of third-party services and SDKs I've integrated in Claude
Code projects, with working patterns, auth setup, gotchas, and links to the
canonical docs. Copy this file into new projects as a starting point; update
it as you learn new things.

**Scope:** Node.js / TypeScript backends. Most examples assume ES modules
(`"type": "module"` in `package.json`) and TypeScript `strict: true`.

**Format:** One section per provider. Each section has:
- **Install** — the npm package(s) and auxiliary deps
- **Env vars** — what you need to configure
- **Minimal usage** — the smallest working example
- **Gotchas** — things I wish I'd known first time
- **Docs** — where to find authoritative information

---

## Table of Contents

1. [LLM Providers](#llm-providers)
   - [Anthropic (Claude)](#anthropic-claude)
   - [OpenAI (GPT / o-series)](#openai-gpt--o-series)
   - [Google Gemini](#google-gemini)
   - [Ollama (local)](#ollama-local)
   - [Provider fallback pattern](#provider-fallback-pattern)
2. [Banking — Plaid](#banking--plaid)
3. [Email — Nodemailer (SMTP)](#email--nodemailer-smtp)
4. [Cloud Storage](#cloud-storage)
   - [AWS S3 / MinIO / R2](#aws-s3--minio--r2)
   - [Dropbox](#dropbox)
   - [Google Drive](#google-drive)
   - [Microsoft OneDrive (Graph)](#microsoft-onedrive-graph)
5. [Authentication](#authentication)
   - [Passkeys (WebAuthn / SimpleWebAuthn)](#passkeys-webauthn--simplewebauthn)
   - [TOTP (speakeasy / otplib)](#totp-speakeasy--otplib)
   - [JWT (jsonwebtoken)](#jwt-jsonwebtoken)
   - [bcrypt password hashing](#bcrypt-password-hashing)
6. [PDF Generation — Puppeteer](#pdf-generation--puppeteer)
7. [Cryptography — Node crypto](#cryptography--node-crypto)
8. [HTTP Clients](#http-clients)
9. [Scheduling / Queues — BullMQ](#scheduling--queues--bullmq)
10. [MCP (Model Context Protocol)](#mcp-model-context-protocol)
11. [Cross-cutting patterns](#cross-cutting-patterns)

---

## LLM Providers

All major LLM providers in Node ship first-party TypeScript SDKs. They all
speak the same general shape (system prompt + messages + temperature/max tokens
+ usage metadata), but the exact field names differ. Abstract over them with
a provider interface if you want vendor independence.

### Anthropic (Claude)

**Install:**
```bash
npm install @anthropic-ai/sdk
```

**Env vars:** `ANTHROPIC_API_KEY`

**Minimal usage:**
```typescript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const response = await client.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1024,
  system: 'You are a helpful assistant.',
  messages: [{ role: 'user', content: 'What is double-entry bookkeeping?' }],
});

const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
const inputTokens = response.usage.input_tokens;
const outputTokens = response.usage.output_tokens;
```

**Vision (image input):**
```typescript
const response = await client.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1024,
  messages: [{
    role: 'user',
    content: [
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64String } },
      { type: 'text', text: 'Extract the vendor name and total from this invoice.' },
    ],
  }],
});
```

**Models (as of mid-2026):**
- `claude-opus-4-6` — flagship, complex reasoning
- `claude-sonnet-4-6` — balanced, production default
- `claude-haiku-4-5-20251001` — fast, low-cost
- Use the latest model IDs from https://docs.claude.com/en/docs/about-claude/models

**Gotchas:**
- `content` is an array of blocks, not a string. Extract text via `content[0]?.type === 'text' ? content[0].text : ''`.
- The SDK reads `ANTHROPIC_API_KEY` automatically; passing `apiKey` is only needed if you store it elsewhere.
- PDF input is supported natively — no need to convert to images first. Anthropic and Gemini both handle PDFs in vision calls.
- Token counts are on `response.usage.input_tokens` / `output_tokens`, not `prompt_tokens` / `completion_tokens`.
- 529 Overloaded errors happen under load — always wrap in retry-with-backoff.

**Docs:** https://docs.claude.com/en/api/overview

---

### OpenAI (GPT / o-series)

**Install:**
```bash
npm install openai
```

**Env vars:** `OPENAI_API_KEY`

**Minimal usage:**
```typescript
import OpenAI from 'openai';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const response = await client.chat.completions.create({
  model: 'gpt-4o-mini',
  max_tokens: 1024,
  temperature: 0.1,
  response_format: { type: 'json_object' }, // optional, forces valid JSON
  messages: [
    { role: 'system', content: 'You return JSON only.' },
    { role: 'user', content: 'Categorize this expense: Starbucks $5.40' },
  ],
});

const text = response.choices[0]?.message?.content || '';
const inputTokens = response.usage?.prompt_tokens ?? 0;
const outputTokens = response.usage?.completion_tokens ?? 0;
```

**Vision:**
```typescript
messages: [{
  role: 'user',
  content: [
    { type: 'text', text: 'What store is this receipt from?' },
    { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
  ],
}],
```

**Gotchas:**
- OpenAI uses `prompt_tokens` / `completion_tokens` (not `input_tokens` / `output_tokens` like Anthropic).
- `response_format: { type: 'json_object' }` requires the word "JSON" to appear in the prompt or the API returns 400.
- OpenAI's vision models cannot read PDFs directly — you need to rasterize to images first (use `pdf-to-img` or Puppeteer).
- Rate limits are tier-based; check `x-ratelimit-*` response headers.
- Older SDK versions have `max_tokens`; newer versions use `max_completion_tokens` for the `o1`/`o3` reasoning models.

**Docs:** https://platform.openai.com/docs/api-reference

---

### Google Gemini

**Install:**
```bash
npm install @google/genai
```

> Don't confuse this with the older `@google/generative-ai` package, which is
> deprecated. The new package is `@google/genai`.

**Env vars:** `GEMINI_API_KEY`

**Minimal usage:**
```typescript
import { GoogleGenAI } from '@google/genai';

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const response = await client.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: [{ role: 'user', parts: [{ text: 'System prompt\n\nUser prompt' }] }],
  config: {
    maxOutputTokens: 1024,
    temperature: 0.1,
    responseMimeType: 'application/json', // force JSON
  },
});

const text = response.text || '';
const inputTokens = response.usageMetadata?.promptTokenCount || 0;
const outputTokens = response.usageMetadata?.candidatesTokenCount || 0;
```

**Vision:**
```typescript
contents: [{
  role: 'user',
  parts: [
    { text: 'What is this?' },
    { inlineData: { mimeType: 'image/jpeg', data: base64String } },
  ],
}],
```

**Gotchas:**
- Gemini doesn't have a first-class "system" role — concatenate system + user prompts into a single user message, or use `systemInstruction` on the request config.
- `responseMimeType: 'application/json'` is more reliable than prompting for JSON.
- Free tier has aggressive rate limits; if you're building for production you'll hit them fast in development. Consider a paid key even for dev.
- Gemini 2.5 models support PDF input natively like Claude.

**Docs:** https://ai.google.dev/gemini-api/docs

---

### Ollama (local)

Self-hosted LLM runtime. Useful for air-gapped deployments and for tests that
shouldn't hit paid APIs.

**Install:** No SDK — use plain `fetch`. Ollama runs as a local HTTP server at
`http://localhost:11434` by default.

```bash
# On the host
ollama pull llama3.2
ollama serve
```

**Env vars:** `OLLAMA_BASE_URL` (optional, defaults to `http://localhost:11434`)

**Minimal usage:**
```typescript
const response = await fetch(`${baseUrl}/api/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'llama3.2',
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Hello' },
    ],
    format: 'json', // optional
    stream: false,
    options: { temperature: 0.1 },
  }),
});

const data = await response.json();
const text = data.message?.content || '';
// Ollama's token counts live on eval_count / prompt_eval_count
const outputTokens = data.eval_count || 0;
const inputTokens = data.prompt_eval_count || 0;
```

**List available models:**
```typescript
const res = await fetch(`${baseUrl}/api/tags`);
const { models } = await res.json(); // [{ name, modified_at, size, ... }]
```

**Gotchas:**
- `stream: false` is required unless you're handling newline-delimited JSON yourself.
- Vision support depends on the model — `llava`, `llama3.2-vision`, etc. Plain `llama3.2` is text-only.
- Ollama on Docker Desktop (Windows/Mac) often needs `OLLAMA_HOST=0.0.0.0` to be reachable from containers; on Linux use host networking or `host.docker.internal`.
- Token counts are rough estimates — Ollama reports "eval" counts, not precise tokenizer output.

**Docs:** https://github.com/ollama/ollama/blob/main/docs/api.md

---

### Provider fallback pattern

If you want vendor independence, abstract over all providers with a common
interface and a fallback chain:

```typescript
interface AiProvider {
  name: string;
  complete(params: {
    systemPrompt: string;
    userPrompt: string;
    temperature?: number;
    maxTokens?: number;
    responseFormat?: 'json' | 'text';
  }): Promise<{
    text: string;
    inputTokens: number;
    outputTokens: number;
    durationMs: number;
  }>;
}

async function executeWithFallback(
  params: CompletionParams,
  preferredProvider: string,
  fallbackChain: string[],
): Promise<CompletionResult> {
  const errors: string[] = [];

  // Try preferred first with retry + exponential backoff
  try {
    return await retryWithBackoff(() => providers[preferredProvider].complete(params));
  } catch (err: any) {
    errors.push(`${preferredProvider}: ${err.message}`);
  }

  // Fall through to each provider in the chain
  for (const name of fallbackChain) {
    if (name === preferredProvider) continue;
    try {
      return await retryWithBackoff(() => providers[name].complete(params));
    } catch (err: any) {
      errors.push(`${name}: ${err.message}`);
    }
  }

  throw new Error(`All AI providers failed. ${errors.join('; ')}`);
}
```

**Rule of thumb for chains:**
- Put Anthropic or OpenAI first for production accuracy
- Put Gemini second (free tier can burn on retries)
- Put Ollama last as a local fallback

---

## Banking — Plaid

**Install:**
```bash
npm install plaid
```

**Env vars:**
- `PLAID_CLIENT_ID`
- `PLAID_SECRET` (sandbox or production, NOT the public key)
- `PLAID_ENV` (`sandbox` / `development` / `production`)

**Client setup:**
```typescript
import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid';

const plaidConfig = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
      'Plaid-Version': '2020-09-14',
    },
  },
});
const plaid = new PlaidApi(plaidConfig);
```

**Core flow (Link Token → Public Token → Access Token → Transactions):**

```typescript
// 1. Backend: create a link token for the frontend to open Plaid Link with
const linkResponse = await plaid.linkTokenCreate({
  user: { client_user_id: userId },
  client_name: 'Your App',
  products: [Products.Transactions],
  country_codes: [CountryCode.Us],
  language: 'en',
  webhook: 'https://your-app.com/api/v1/plaid/webhook',
});
const linkToken = linkResponse.data.link_token;

// 2. Frontend: launches Plaid Link with linkToken, user picks bank,
//    onSuccess callback returns a public_token.

// 3. Backend: exchange public_token for a permanent access_token
const exchangeResponse = await plaid.itemPublicTokenExchange({
  public_token: publicToken,
});
const accessToken = exchangeResponse.data.access_token; // ENCRYPT before storing
const itemId = exchangeResponse.data.item_id;

// 4. Sync transactions (incremental, uses a cursor)
const syncResponse = await plaid.transactionsSync({
  access_token: accessToken,
  cursor: previousCursor, // null on first call
});
const { added, modified, removed, next_cursor, has_more } = syncResponse.data;

// 5. When user disconnects, revoke the access_token
await plaid.itemRemove({ access_token: accessToken });
```

**Gotchas:**
- **Always encrypt `access_token` before storing in your database.** It's a long-lived credential that lets anyone with it query or modify the user's Plaid item.
- `transactionsSync` is the right endpoint for an ongoing sync — use it over `transactionsGet`, which is legacy. Keep the cursor in your DB per Plaid item.
- `has_more: true` means you need to call `transactionsSync` again immediately with the new cursor to drain the queue. Don't assume one call returns everything.
- Webhooks are async and can arrive out of order. Validate `webhook_type` + `webhook_code` and dedupe by a combination of `item_id` + `webhook_code` + cursor.
- **Sandbox vs production:** sandbox uses fake banks (see `ins_109508` "First Platypus Bank" with user_good/pass_good); production requires a manual review by Plaid before approval.
- Plaid Link runs in an iframe on the frontend; use `react-plaid-link` if you're on React.
- Watch the item status: `ITEM_LOGIN_REQUIRED`, `PENDING_EXPIRATION`, `REVOKED` all mean the user needs to re-authenticate via Link's update mode.

**Docs:** https://plaid.com/docs/api/

---

## Email — Nodemailer (SMTP)

**Install:**
```bash
npm install nodemailer
npm install -D @types/nodemailer
```

**Env vars:**
- `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM`

**Minimal usage:**
```typescript
import nodemailer from 'nodemailer';

const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_PORT === '465', // true for 465, false for 587/25
  auth: process.env.SMTP_USER ? {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  } : undefined,
});

const info = await transport.sendMail({
  from: process.env.SMTP_FROM,
  to: 'alice@example.com',
  subject: 'Welcome',
  text: 'Plain text body',
  html: '<p>HTML body</p>',
});
// info.messageId for logging
```

**Gotchas:**
- Port 465 uses implicit TLS (`secure: true`), port 587 uses STARTTLS (`secure: false`). Mixing these up gives cryptic connection errors.
- Gmail requires an App Password (not the account password) if 2FA is on. Google keeps tightening this; for production prefer a transactional provider.
- For large volumes use **Resend** (cleanest modern API), **Postmark** (best deliverability for transactional), **Mailgun** (cheap at scale), or **AWS SES** (cheapest). All speak SMTP but also have REST APIs that are simpler to integrate.
- For dev without a real SMTP server, use **Mailhog** or **Mailpit** in Docker — they catch all outbound mail and show it in a web UI.

**Resend alternative (simpler than SMTP):**
```bash
npm install resend
```
```typescript
import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY);
await resend.emails.send({
  from: 'you@yourdomain.com',
  to: 'alice@example.com',
  subject: 'Welcome',
  html: '<p>Hello</p>',
});
```

**Docs:**
- Nodemailer: https://nodemailer.com/
- Resend: https://resend.com/docs/api-reference

---

## Cloud Storage

All four providers below implement the same conceptual operations: upload,
download, delete, list, head. Abstract over them behind an interface so swapping
is cheap:

```typescript
interface StorageProvider {
  upload(key: string, data: Buffer, metadata: FileMetadata): Promise<StorageResult>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  head(key: string): Promise<{ exists: boolean; sizeBytes?: number }>;
}
```

### AWS S3 / MinIO / R2

The AWS S3 SDK talks to any S3-compatible backend including MinIO, Cloudflare
R2, Backblaze B2, Wasabi, and DigitalOcean Spaces. Use the same SDK, swap the
endpoint.

**Install:**
```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

**Env vars:**
- `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT` (optional), `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`

**Usage:**
```typescript
import {
  S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const client = new S3Client({
  region: process.env.S3_REGION || 'us-east-1',
  endpoint: process.env.S3_ENDPOINT, // set only for MinIO/R2/etc
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: !!process.env.S3_ENDPOINT, // REQUIRED for MinIO/R2
});

// Upload
await client.send(new PutObjectCommand({
  Bucket: process.env.S3_BUCKET,
  Key: 'attachments/foo.pdf',
  Body: buffer,
  ContentType: 'application/pdf',
}));

// Download — body is a stream, convert to buffer
const res = await client.send(new GetObjectCommand({ Bucket, Key }));
const chunks: Buffer[] = [];
// @ts-ignore — Body is AsyncIterable<Uint8Array>
for await (const chunk of res.Body) chunks.push(Buffer.from(chunk));
const buffer = Buffer.concat(chunks);

// Pre-signed download URL (for direct-from-browser downloads)
const url = await getSignedUrl(
  client,
  new GetObjectCommand({ Bucket, Key }),
  { expiresIn: 300 }, // 5 min
);
```

**Gotchas:**
- **`forcePathStyle: true` is mandatory for MinIO and most non-AWS backends.** Without it you'll get DNS errors trying to resolve `bucket.your-endpoint.com`.
- The v3 SDK returns stream bodies for `GetObject`, not buffers. Iterate to collect or pipe to a writable.
- `HeadObjectCommand` throws `NotFound` (404) — catch it explicitly, don't rely on the error class matching across versions.
- **Cloudflare R2** — set `endpoint: 'https://<account>.r2.cloudflarestorage.com'`, use `auto` as the region. R2 has no egress fees, which is huge.
- **Never commit AWS credentials.** Use IAM roles in production (EC2/ECS/EKS/Lambda all support them via `AWS_SDK_LOAD_DEFAULTS`).

**Docs:** https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/s3/

---

### Dropbox

**Install:**
```bash
npm install dropbox
```

**Auth flow:** OAuth 2 with refresh tokens. Register an app at
https://www.dropbox.com/developers/apps, set redirect URI, get
`DROPBOX_APP_KEY` + `DROPBOX_APP_SECRET`.

**Usage:**
```typescript
import { Dropbox, DropboxAuth } from 'dropbox';

// Step 1: Build auth URL, user authorizes
const auth = new DropboxAuth({ clientId: appKey, clientSecret: appSecret });
const authUrl = await auth.getAuthenticationUrl(
  redirectUri,
  undefined,
  'code',
  'offline', // required to get refresh_token
);

// Step 2: Handle callback, exchange code for tokens
await auth.getAccessTokenFromCode(redirectUri, code);
const accessToken = auth.getAccessToken();
const refreshToken = auth.getRefreshToken();

// Step 3: Use the client (it'll auto-refresh if given the refresh token)
const dbx = new Dropbox({ clientId: appKey, clientSecret: appSecret, refreshToken });
const uploadResponse = await dbx.filesUpload({
  path: '/folder/file.pdf',
  contents: buffer,
  mode: { '.tag': 'overwrite' },
});

// Download
const downloadResponse = await dbx.filesDownload({ path: '/folder/file.pdf' });
const buf = (downloadResponse.result as any).fileBinary as Buffer;
```

**Gotchas:**
- Access tokens expire after ~4 hours. Always request `offline` scope to get a refresh token, or your integration will break silently after the first workday.
- File paths must start with `/` and are case-insensitive.
- Uploads > 150MB must use upload sessions (`filesUploadSessionStart` / `Append` / `Finish`).
- The `fileBinary` field on download responses is typed as `Blob | Buffer` — cast carefully.

**Docs:** https://www.dropbox.com/developers/documentation

---

### Google Drive

**Install:**
```bash
npm install googleapis
```

**Auth:** OAuth 2 via Google Cloud Console. Create a project, enable Drive API,
create OAuth client ID credentials, get client ID + secret + redirect URI.

**Usage:**
```typescript
import { google } from 'googleapis';

// Auth
const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
const authUrl = oauth2.generateAuthUrl({
  access_type: 'offline', // required for refresh_token
  scope: ['https://www.googleapis.com/auth/drive.file'],
  prompt: 'consent', // forces refresh_token on every grant
});

// Handle callback
const { tokens } = await oauth2.getToken(code);
// tokens.access_token, tokens.refresh_token, tokens.expiry_date

oauth2.setCredentials({ refresh_token: savedRefreshToken });
const drive = google.drive({ version: 'v3', auth: oauth2 });

// Upload
const res = await drive.files.create({
  requestBody: { name: 'invoice.pdf', mimeType: 'application/pdf' },
  media: { mimeType: 'application/pdf', body: buffer },
});
const fileId = res.data.id;

// Download
const file = await drive.files.get(
  { fileId, alt: 'media' },
  { responseType: 'arraybuffer' },
);
const buf = Buffer.from(file.data as ArrayBuffer);
```

**Gotchas:**
- `drive.file` scope is the narrow scope — only files your app created are visible. `drive` is full access and requires Google's verification process.
- `access_type: 'offline'` + `prompt: 'consent'` is the only reliable way to always get a refresh token. Without `prompt: 'consent'`, you only get a refresh token on the very first grant.
- Google's `media.body` accepts a stream OR a buffer; for buffers convert via `Readable.from(buffer)` if the SDK complains.
- Drive uses "resumable uploads" for files > 5MB; set `media.mimeType` explicitly or the SDK guesses wrong.

**Docs:** https://developers.google.com/drive/api/quickstart/nodejs

---

### Microsoft OneDrive (Graph)

**Install:**
```bash
npm install @microsoft/microsoft-graph-client @azure/msal-node
```

**Auth:** OAuth 2 via Azure AD. Register an app at
https://portal.azure.com → Azure Active Directory → App registrations.

**Usage:**
```typescript
import { ConfidentialClientApplication } from '@azure/msal-node';
import { Client } from '@microsoft/microsoft-graph-client';

const msal = new ConfidentialClientApplication({
  auth: {
    clientId: process.env.MS_CLIENT_ID!,
    clientSecret: process.env.MS_CLIENT_SECRET!,
    authority: 'https://login.microsoftonline.com/common',
  },
});

// Authorization code flow → get token
const tokenResponse = await msal.acquireTokenByCode({
  code: authCode,
  scopes: ['Files.ReadWrite', 'offline_access'],
  redirectUri,
});
const accessToken = tokenResponse?.accessToken;

// Graph client
const graph = Client.init({
  authProvider: (done) => done(null, accessToken!),
});

// Upload
await graph.api('/me/drive/root:/invoice.pdf:/content').put(buffer);

// Download
const stream = await graph.api('/me/drive/root:/invoice.pdf:/content').getStream();
```

**Gotchas:**
- Microsoft's OAuth is the most finicky of the big four. Expect to debug redirect URI mismatches and scope string typos.
- `offline_access` scope is required to get a refresh token (similar to Google's `access_type: 'offline'`).
- Tokens expire after ~1 hour. MSAL will refresh automatically if you ask via `acquireTokenSilent`, but you must persist the account record.
- Upload sessions are required for files > 4MB (unlike Dropbox's 150MB threshold).

**Docs:** https://learn.microsoft.com/en-us/graph/api/overview

---

## Authentication

### Passkeys (WebAuthn / SimpleWebAuthn)

Modern passwordless auth. Works in all major browsers. The user authenticates
with their platform's biometric (Touch ID, Face ID, Windows Hello) or a hardware
key (YubiKey).

**Install:**
```bash
npm install @simplewebauthn/server
npm install @simplewebauthn/browser  # for the frontend
```

**Env vars:**
- `WEBAUTHN_RP_ID` — your domain WITHOUT protocol or port (e.g., `example.com`)
- `WEBAUTHN_ORIGIN` — full origin WITH protocol (e.g., `https://example.com`)

**Registration flow:**
```typescript
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';

// Step 1: Server generates options, client passes them to navigator.credentials.create()
const options = await generateRegistrationOptions({
  rpName: 'My App',
  rpID: process.env.WEBAUTHN_RP_ID!,
  userID: Buffer.from(userId),
  userName: email,
  attestationType: 'none',
  authenticatorSelection: {
    residentKey: 'required',
    userVerification: 'preferred',
  },
  excludeCredentials: existingPasskeys.map(p => ({
    id: p.credentialId,
    type: 'public-key',
  })),
});

// Store options.challenge server-side keyed by userId — you need it in step 2

// Step 2: Client returns attestation response, server verifies
const verification = await verifyRegistrationResponse({
  response: clientResponse,
  expectedChallenge: storedChallenge,
  expectedOrigin: process.env.WEBAUTHN_ORIGIN!,
  expectedRPID: process.env.WEBAUTHN_RP_ID!,
});

if (verification.verified && verification.registrationInfo) {
  const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;
  // Store these in your DB, keyed by userId
}
```

**Authentication flow:** Mirror of registration — `generateAuthenticationOptions` →
client uses `navigator.credentials.get()` → server verifies with
`verifyAuthenticationResponse`.

**Gotchas:**
- **Requires HTTPS or localhost.** Passkeys refuse to run over plain HTTP on a public IP. If you're testing against a LAN IP, run a local CA via `mkcert` or put Caddy in front.
- `rpID` must be the domain **without** protocol or port. `rpID: 'https://example.com'` is wrong.
- `userID` must be a `Buffer`, not a string, in recent versions of the SDK.
- The challenge is single-use — store it server-side keyed by the user, and delete after verification.
- `counter` is a replay-protection mechanism. Increment and store it after each successful authentication; reject if the incoming counter isn't strictly greater than the stored one.
- Passkey signatures are large (several hundred bytes). Store the credential public key as `bytea`/`TEXT`, not `VARCHAR`.

**Docs:** https://simplewebauthn.dev/

---

### TOTP (speakeasy / otplib)

Time-based one-time passwords for 2FA (Google Authenticator, Authy, 1Password, etc.).

**Install:**
```bash
npm install otplib qrcode
```

**Usage:**
```typescript
import { authenticator } from 'otplib';
import QRCode from 'qrcode';

// Enroll: generate a secret, show QR, ask user to verify
const secret = authenticator.generateSecret();
// ENCRYPT this before storing
const otpauthUrl = authenticator.keyuri(userEmail, 'My App', secret);
const qrDataUrl = await QRCode.toDataURL(otpauthUrl);
// Send qrDataUrl to the frontend for display

// Verify during enrollment or login
const isValid = authenticator.verify({ token: userEnteredCode, secret });
```

**Gotchas:**
- **Always encrypt the secret before storing.** It's equivalent to a password.
- Allow a ±1 step window (30 seconds each side) for clock drift: `authenticator.options = { window: 1 }`.
- Issue recovery codes at enrollment time and require the user to save them. Hash each recovery code like a password; check-and-burn on use.
- `otplib` is maintained; `speakeasy` is older and still works but has fewer TypeScript types.

**Docs:** https://github.com/yeojz/otplib

---

### JWT (jsonwebtoken)

**Install:**
```bash
npm install jsonwebtoken
npm install -D @types/jsonwebtoken
```

**Usage:**
```typescript
import jwt from 'jsonwebtoken';

const secret = process.env.JWT_SECRET!; // 64+ random bytes, hex-encoded

// Sign
const token = jwt.sign(
  { userId, role, tenantId },
  secret,
  { expiresIn: '15m', algorithm: 'HS256' },
);

// Verify
try {
  const payload = jwt.verify(token, secret) as { userId: string; role: string; tenantId: string };
  // use payload
} catch (err) {
  // token expired, malformed, or signature invalid
}
```

**Gotchas:**
- Use short-lived access tokens (15 minutes) + long-lived refresh tokens (7+ days). Don't put everything in a single long-lived JWT.
- **Refresh token rotation:** when refreshing, delete the old session row and insert a new one atomically (`DELETE ... RETURNING`). If the same refresh token is used twice, invalidate the entire session chain — that's a clear compromise signal.
- Always specify `algorithm` explicitly. The `none` algorithm attack has been patched forever but it's cheap defense in depth.
- For asymmetric keys (RS256/ES256), generate with `openssl genpkey -algorithm RSA -out private.pem` and sign with the private key, verify with the public key.

**Docs:** https://github.com/auth0/node-jsonwebtoken

---

### bcrypt password hashing

**Install:**
```bash
npm install bcrypt
npm install -D @types/bcrypt
```

**Usage:**
```typescript
import bcrypt from 'bcrypt';

const hash = await bcrypt.hash(plainPassword, 12); // cost factor 12
const isValid = await bcrypt.compare(plainPassword, hash);
```

**Gotchas:**
- Cost factor 12 is the modern default (as of 2026). Measure on your production hardware — one hash at cost 12 should take ~250ms. Too fast = crackable; too slow = login latency.
- **Maximum input is 72 bytes.** Longer passwords are silently truncated, which is a vulnerability. Pre-hash with SHA-256 if you want to support long passphrases: `bcrypt.hash(crypto.createHash('sha256').update(pw).digest('base64'), 12)`.
- `bcryptjs` is a pure-JS alternative that doesn't need native bindings — useful for serverless platforms that ban native modules, but ~10x slower.
- **Argon2id** (`argon2` npm package) is the modern recommendation and is stronger than bcrypt. Bcrypt is only still dominant because of ecosystem inertia.

---

## PDF Generation — Puppeteer

**Install:**
```bash
npm install puppeteer
```

Puppeteer bundles its own Chromium. If you're deploying to Alpine-based Docker
images, install system Chromium separately to avoid bundling:

```dockerfile
RUN apk add --no-cache chromium chromium-chromedriver ttf-freefont
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

**Usage:**
```typescript
import puppeteer from 'puppeteer';

async function htmlToPdf(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    // --no-sandbox / --disable-setuid-sandbox are required when running
    // Chromium as root inside a container.
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const buffer = await page.pdf({
      format: 'Letter',
      margin: { top: '0.5in', bottom: '0.5in', left: '0.5in', right: '0.5in' },
      printBackground: true,
    });
    return Buffer.from(buffer);
  } finally {
    await browser.close(); // in `finally` so errors don't leak Chromium processes
  }
}
```

**Gotchas:**
- **Always close the browser in `finally`.** A single leaked Chromium process eats ~150MB of RAM; after a few hundred requests you'll OOM.
- `--disable-dev-shm-usage` is mandatory on Docker — `/dev/shm` is too small by default and Chrome crashes without it.
- For Alpine images, install `ttf-freefont` or text will render as blank boxes.
- `@react-pdf/renderer` is a lighter alternative if you can express your output as React components — no headless browser needed. It's ~100x less memory but doesn't support arbitrary HTML/CSS.
- Puppeteer is slow — a cold launch takes 500-1500ms. For high volumes, keep a persistent browser and create new pages per request, or use a Chromium pool.
- **Never call `page.pdf()` on untrusted HTML without sandboxing** — it can trigger navigations, network fetches, etc. Set `page.setRequestInterception(true)` and reject everything if the input isn't yours.

**Docs:** https://pptr.dev/

---

## Cryptography — Node crypto

The built-in `crypto` module covers 99% of needs. Don't pull in `crypto-js` or
`sjcl` — they're unmaintained and slower.

**AES-256-GCM (authenticated encryption) for storing secrets:**
```typescript
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const key = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex'); // 32 bytes, hex-encoded in env

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12); // GCM uses 12-byte IV
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Pack IV + tag + ciphertext into a single base64-colon-delimited string
  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decrypt(ciphertext: string): string {
  const [ivB64, tagB64, dataB64] = ciphertext.split(':');
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(data) + decipher.final('utf8');
}
```

**Secure random tokens:**
```typescript
const token = crypto.randomBytes(32).toString('base64url'); // URL-safe
const hex = crypto.randomBytes(16).toString('hex');
```

**HMAC (for webhook signature verification):**
```typescript
const signature = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
const isValid = crypto.timingSafeEqual(
  Buffer.from(signature),
  Buffer.from(headerSignature),
);
```

**Gotchas:**
- **Always use `crypto.timingSafeEqual` for comparing MACs and tokens.** `===` leaks information via timing.
- GCM IVs must be unique per-key — never reuse an (IV, key) pair. Generating 12 random bytes per encryption is safe up to ~2^32 operations.
- **Don't roll your own key derivation.** Use `crypto.scrypt` for passwords → keys, or `crypto.hkdf` for deriving multiple keys from a master secret.
- `AES-256-CBC` is tempting but unauthenticated — ciphertext can be tampered with without detection. **Always prefer GCM** for new code.

**Docs:** https://nodejs.org/api/crypto.html

---

## HTTP Clients

Node 18+ has a built-in `fetch` that's Fetch API compatible. For most use cases
this is enough — don't add `axios` or `node-fetch` unless you need a specific
feature.

**When to use what:**
- **Built-in `fetch`** — default. Works in Node 18+, Edge runtimes, browsers.
- **`undici`** — Node's HTTP client under the hood. Use directly for: connection pooling control, mocking via `MockAgent`, raw HTTP/2.
- **`got`** — when you need automatic retries with backoff + hooks + pagination helpers, and don't want to write them yourself.
- **`axios`** — only if you need to maintain code that already uses it. No advantages over `fetch` for new projects.

**Basic fetch with timeout and retry:**
```typescript
async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  { maxRetries = 3, baseDelayMs = 1000, timeoutMs = 30000 } = {},
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      if (!res.ok && res.status >= 500 && attempt < maxRetries) {
        throw new Error(`Server error: ${res.status}`);
      }
      return res;
    } catch (err) {
      if (attempt >= maxRetries) throw err;
      const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 200;
      await new Promise((r) => setTimeout(r, delay));
    } finally {
      clearTimeout(timeoutHandle);
    }
  }
  throw new Error('unreachable');
}
```

---

## Scheduling / Queues — BullMQ

For background jobs, recurring tasks, retry logic, and dead-letter queues.
Backed by Redis.

**Install:**
```bash
npm install bullmq
```

**Env vars:** `REDIS_URL`

**Basic producer/consumer:**
```typescript
import { Queue, Worker, QueueEvents } from 'bullmq';

const connection = { url: process.env.REDIS_URL };

// Producer (API process)
const emailQueue = new Queue('email', { connection });
await emailQueue.add(
  'send-welcome',
  { userId, email },
  { attempts: 5, backoff: { type: 'exponential', delay: 2000 } },
);

// Consumer (worker process)
const worker = new Worker('email', async (job) => {
  await sendEmail(job.data);
}, { connection, concurrency: 10 });

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err.message);
});
```

**Scheduled / recurring jobs:**
```typescript
await queue.add('daily-report', {}, {
  repeat: { pattern: '0 9 * * *' }, // cron: every day at 9am
  jobId: 'daily-report', // dedupe key — prevents duplicates on redeploy
});
```

**Gotchas:**
- **Always set `jobId`** on scheduled jobs to prevent duplicates when the producer restarts.
- Use **idempotency keys** in job data. Workers can be invoked twice for the same job (during shutdown, network blips). Your handler should be safe to run twice.
- Run the worker as a **separate process** from the API — workers can be CPU-intensive and should scale independently.
- `concurrency: 10` = up to 10 jobs in parallel on that worker instance. For external API calls, keep this low to respect rate limits.
- For cron-style scheduling, **pattern** uses standard cron syntax (5 fields). Set `tz: 'America/Los_Angeles'` if the server is in UTC but you want user-local schedules.

**Docs:** https://docs.bullmq.io/

---

## MCP (Model Context Protocol)

Anthropic's open protocol for letting LLMs talk to external tools and data sources.
MCP servers expose "tools" (functions the LLM can call) and "resources" (read-only
context the LLM can load). Claude Desktop, Claude Code, and Claude.ai can all
connect to MCP servers.

**Install:**
```bash
npm install @modelcontextprotocol/sdk
```

**Minimal stdio server:**
```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const server = new Server(
  { name: 'my-app', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: 'get_balance',
    description: 'Get an account balance',
    inputSchema: {
      type: 'object',
      properties: { accountId: { type: 'string' } },
      required: ['accountId'],
    },
  }],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'get_balance') {
    const { accountId } = request.params.arguments as { accountId: string };
    const balance = await fetchBalanceFromDb(accountId);
    return {
      content: [{ type: 'text', text: `Balance: $${balance.toFixed(2)}` }],
    };
  }
  throw new Error(`Unknown tool: ${request.params.name}`);
});

await server.connect(new StdioServerTransport());
```

**HTTP transport** (for remote MCP servers):
Use `@modelcontextprotocol/sdk/server/sse.js` instead of stdio.

**Gotchas:**
- MCP servers run as **separate processes** that the host (Claude) spawns via stdio. Don't try to embed one in your API server.
- Tool inputs are JSON Schema. The client validates against the schema before calling, but you should validate again server-side.
- Return text content as `{ type: 'text', text: '...' }` — not a raw string.
- Debugging MCP is painful. Use the `mcp inspector` CLI to interactively explore a server before connecting it to Claude.

**Docs:** https://modelcontextprotocol.io/

---

## Cross-cutting patterns

### Retry with exponential backoff

```typescript
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  { maxRetries = 3, baseDelayMs = 1000, shouldRetry = (err: any) => true } = {},
): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt >= maxRetries || !shouldRetry(err)) throw err;
      const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 200;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}
```

**Guidance:**
- Only retry on 5xx, 429, network errors, and timeouts. **Do not retry on 4xx** — they're permanent client errors.
- Add jitter (the `Math.random() * 200`) to avoid thundering herd on a service restart.
- Max 3-4 retries. Beyond that, fail fast and let the caller surface the error.

### Rate limiting with a semaphore

```typescript
export class Semaphore {
  private tokens: number;
  private waiting: Array<() => void> = [];
  constructor(max: number) { this.tokens = max; }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try { return await fn(); }
    finally { this.release(); }
  }

  private async acquire(): Promise<void> {
    if (this.tokens > 0) { this.tokens--; return; }
    return new Promise((resolve) => this.waiting.push(resolve));
  }

  private release(): void {
    this.tokens++;
    const next = this.waiting.shift();
    if (next) { this.tokens--; next(); }
  }
}

// Usage: cap concurrent OpenAI calls to 5
const sem = new Semaphore(5);
await sem.run(() => openai.chat.completions.create({...}));
```

### Secret storage

- **Never** commit secrets to git. Use `.env` files locally, and a real secret
  manager (AWS Secrets Manager, GCP Secret Manager, HashiCorp Vault, Doppler,
  Infisical) in production.
- Store provider API keys **encrypted at rest** in your database, not in plain
  env vars, when the key is per-tenant. See the AES-256-GCM pattern in the
  Cryptography section.
- Rotate keys at least annually; track rotation in a spreadsheet or your
  secrets manager.

### Webhook signature verification

Always verify webhook signatures before trusting the payload:

```typescript
import crypto from 'crypto';

app.post('/webhooks/plaid', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['plaid-verification'] as string;
  const expected = crypto
    .createHmac('sha256', process.env.PLAID_WEBHOOK_SECRET!)
    .update(req.body) // raw body, NOT parsed
    .digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
    return res.status(401).send('Invalid signature');
  }

  const payload = JSON.parse(req.body.toString());
  // ... handle the event
  res.status(200).send('ok');
});
```

**Gotchas:**
- Signatures verify against the **raw body**, not the JSON-parsed object. Use
  `express.raw()` (not `express.json()`) on webhook routes.
- Always `timingSafeEqual`, never `===`.
- Some providers (Stripe, Plaid) use HMAC-SHA256; others (Slack) have their
  own scheme — read the provider's docs, don't assume.

### Cost tracking for LLM calls

Log every provider call with input/output token counts, provider, model,
and timestamp. Query with a monthly aggregate to alert on budget overruns.

```typescript
await db.insert(aiUsageLog).values({
  tenantId,
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
  jobType: 'categorization',
  inputTokens: response.usage.input_tokens,
  outputTokens: response.usage.output_tokens,
  estimatedCost: calculateCost('anthropic', 'claude-sonnet-4-20250514', response.usage),
  createdAt: new Date(),
});
```

Pricing tables should live in a config file keyed by `provider + model`:

```typescript
const PRICING = {
  'anthropic:claude-sonnet-4-20250514': { inputPerM: 3.00, outputPerM: 15.00 },
  'openai:gpt-4o-mini': { inputPerM: 0.15, outputPerM: 0.60 },
  // ...
};

function calculateCost(provider: string, model: string, usage: { inputTokens: number; outputTokens: number }): number {
  const price = PRICING[`${provider}:${model}`];
  if (!price) return 0;
  return (usage.inputTokens / 1_000_000) * price.inputPerM
       + (usage.outputTokens / 1_000_000) * price.outputPerM;
}
```

Review pricing monthly — providers change rates regularly.

---

## Appendix — quick install commands

```bash
# LLM
npm install @anthropic-ai/sdk openai @google/genai

# Banking
npm install plaid

# Email
npm install nodemailer resend

# Cloud storage
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
npm install dropbox
npm install googleapis
npm install @microsoft/microsoft-graph-client @azure/msal-node

# Auth
npm install jsonwebtoken bcrypt
npm install -D @types/jsonwebtoken @types/bcrypt
npm install @simplewebauthn/server
npm install otplib qrcode

# PDF
npm install puppeteer

# Queues
npm install bullmq

# MCP
npm install @modelcontextprotocol/sdk
```

---

## Changelog

- **2026-04-09** — Initial version. Captured patterns from Vibe MyBooks project:
  Anthropic / OpenAI / Gemini / Ollama LLM abstraction, Plaid transaction sync,
  multi-provider cloud storage, Nodemailer SMTP, Puppeteer PDF, AES-256-GCM
  encryption, passkeys, JWT with refresh rotation, BullMQ basics, MCP server
  stub.
