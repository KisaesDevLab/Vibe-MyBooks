# KIS Books — AI PII Protection Addendum

**Addendum to:** AI_PROCESSING_PLAN.md
**Purpose:** Define the data minimization architecture that maintains processing accuracy while limiting PII exposure to cloud AI providers

---

## The Problem

Every AI processing task involves some combination of text and images that may contain PII:

| Data Element | Where It Appears | Sensitivity |
|---|---|---|
| Account holder name | Bank statements, checks | High |
| Bank account number | Bank statements | High |
| Routing number | Bank statements, checks | High |
| SSN / EIN | Tax forms, some statements | Critical |
| Credit card last 4 | Receipts | Medium |
| Personal names | Venmo/Zelle descriptions, checks | Medium |
| Mailing address | Invoices, statements, receipts | Medium |
| Transaction history | Bank statements | High (aggregate) |
| Purchase details | Receipts | Low–Medium |
| Account balances | Bank statements | High |

When GLM-OCR is self-hosted (Ollama), none of this leaves the server. When GLM-OCR is NOT available, the user depends on cloud vision APIs — and that's where PII leakage occurs.

---

## Architecture: Two-Layer Processing

Every AI task is split into two distinct layers:

```
┌─────────────────────────────────────────────────────┐
│  LAYER 1: VISUAL EXTRACTION (local-preferred)       │
│                                                     │
│  Input: Raw image / PDF                             │
│  Output: Structured text (Markdown, raw text)       │
│  Runs: GLM-OCR local > Tesseract > Cloud vision     │
│                                                     │
│  This layer SEES the raw document including PII.    │
│  Goal: extract text locally whenever possible.      │
├─────────────────────────────────────────────────────┤
│  PII SANITIZER (always local)                       │
│                                                     │
│  Input: Extracted text from Layer 1                  │
│  Output: Sanitized text with PII masked/removed     │
│  Runs: Always on-server, regex + pattern matching   │
├─────────────────────────────────────────────────────┤
│  LAYER 2: INTELLIGENCE (cloud-safe)                 │
│                                                     │
│  Input: Sanitized text only (never raw images)      │
│  Output: Structured JSON (categories, parsed data)  │
│  Runs: Anthropic / OpenAI / Gemini / Ollama         │
│                                                     │
│  This layer NEVER sees raw images or unsanitized    │
│  text. It works with pre-extracted, cleaned text.   │
└─────────────────────────────────────────────────────┘
```

The key principle: **Cloud LLMs receive text, never images.** Images stay local. The only exception is when no local vision capability exists AND the admin explicitly enables cloud vision with a PII acknowledgment.

---

## Layer 1: Visual Extraction — Priority Chain

### Priority 1: GLM-OCR Self-Hosted (Ollama)

- 0.9B parameters, runs on CPU or GPU
- Handles receipts, bank statements, invoices, handwriting
- Data never leaves the server
- **Best accuracy, zero PII risk**

### Priority 2: Local Tesseract + PDF Text Extraction

When GLM-OCR is not configured, the system falls back to local tools:

**For PDFs (bank statements, invoices):**
1. Attempt text extraction first using `pdf-parse` or `pdfjs-dist`
   - Most digital bank statements from online banking are text-based PDFs (not scanned images)
   - Text extraction is instant, free, and 100% accurate for text-based PDFs
   - No AI call needed for this step
2. If text extraction yields meaningful content (> 50 characters), use the extracted text directly
3. If text extraction yields nothing (scanned/image-based PDF), rasterize to images and proceed to image OCR

**For images (receipt photos, scanned documents):**
1. Run Tesseract OCR locally (via `tesseract.js` or system Tesseract binary)
   - Pre-processing: auto-rotate, deskew, contrast enhancement (via `sharp`)
   - Tesseract is less accurate than GLM-OCR (~70-80% on receipts vs ~95%) but keeps data local
2. Output raw text for sanitization and cloud structuring

**Accuracy impact without GLM-OCR:**

| Document Type | GLM-OCR Accuracy | Tesseract Accuracy | Notes |
|---|---|---|---|
| Digital PDF bank statement | N/A (text extraction) | N/A (text extraction) | Both use local PDF parsing — identical results |
| Scanned bank statement | ~95% | ~75% | Tesseract struggles with tables and small print |
| Clean receipt photo | ~93% | ~80% | Tesseract decent on high-contrast receipts |
| Crumpled/faded receipt | ~88% | ~50% | Major quality drop — GLM-OCR's context helps |
| Typed invoice | ~96% | ~85% | Tesseract adequate for standard business invoices |
| Handwritten notes | ~80% | ~30% | Tesseract essentially unusable for handwriting |

### Priority 3: Cloud Vision (Admin Opt-In Only)

If both GLM-OCR and Tesseract produce insufficient results, and the admin has explicitly enabled cloud vision:

- Send the image to the configured cloud provider's vision API
- **This is the ONLY path where a raw image leaves the server**
- Requires admin opt-in (see §Admin Controls below)
- Displays a PII warning to the user before processing

---

## PII Sanitizer — Pattern-Based Masking

```
packages/api/src/services/pii-sanitizer.service.ts
```

A local-only service that processes extracted text before it reaches any cloud API. Runs entirely on the server — no external calls.

### Patterns to Detect and Mask

| Pattern | Regex / Logic | Replacement | Example |
|---|---|---|---|
| **SSN** | `\b\d{3}-\d{2}-\d{4}\b` | `[SSN_REDACTED]` | 123-45-6789 → [SSN_REDACTED] |
| **EIN** | `\b\d{2}-\d{7}\b` | `[EIN_REDACTED]` | 12-3456789 → [EIN_REDACTED] |
| **Bank account number** | `\b\d{8,17}\b` in context of "account", "acct" | `[ACCT_REDACTED]` | Account: 123456789012 → Account: [ACCT_REDACTED] |
| **Routing number** | `\b\d{9}\b` in context of "routing", "ABA" | `[ROUTING_REDACTED]` | Routing: 091000019 → Routing: [ROUTING_REDACTED] |
| **Credit card number** | `\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b` | `[CARD_REDACTED]` | 4111-1111-1111-1111 → [CARD_REDACTED] |
| **Card last 4** | `\b(?:ending in\|last 4\|x{4,})\s*\d{4}\b` | Keep last 4 only | "ending in 4567" → preserved (useful for matching) |
| **Phone number** | `\b\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b` | `[PHONE_REDACTED]` | (555) 123-4567 → [PHONE_REDACTED] |
| **Email address** | Standard email regex | `[EMAIL_REDACTED]` | john@example.com → [EMAIL_REDACTED] |
| **Mailing address** | Multi-line: street + city/state/zip pattern | `[ADDRESS_REDACTED]` | 123 Main St\nSpringfield MO 65801 → [ADDRESS_REDACTED] |
| **Personal names in transfers** | After "VENMO", "ZELLE", "PAYPAL", "CASHAPP" keywords | `[NAME_REDACTED]` | "VENMO PAYMENT JOHN SMITH" → "VENMO PAYMENT [NAME_REDACTED]" |

### What is NOT masked (needed for processing)

| Data Element | Why It's Kept |
|---|---|
| Merchant/vendor names | Required for categorization and vendor matching |
| Transaction amounts | Core data point for matching and categorization |
| Transaction dates | Core data point |
| General descriptions | "Office supplies", "Monthly subscription" — not PII |
| Card last 4 digits | Low risk, useful for matching to the correct account |
| Invoice numbers | Not PII, needed for matching |

### Sanitizer Modes

| Mode | Behavior | Use Case |
|---|---|---|
| **strict** | Mask all patterns above, aggressive matching | Bank statements, tax documents |
| **standard** | Mask SSN, EIN, account numbers, card numbers; keep names, addresses | Receipts, invoices |
| **minimal** | Mask SSN and EIN only | Transaction descriptions (categorization) |
| **none** | No masking (for self-hosted providers) | When using Ollama/local GLM-OCR |

The sanitizer mode is automatically selected based on the provider:
- Self-hosted (Ollama, GLM-OCR local) → `none` (data doesn't leave the server)
- Cloud providers → `strict` for statements, `standard` for receipts/invoices, `minimal` for categorization

---

## Per-Task Processing Pipelines (With PII Protection)

### Task 1: Transaction Categorization

```
Bank feed item arrives
  │
  ├→ Bank Rules check (local, instant) → match? → done
  ├→ History lookup (local, instant) → strong match? → done
  │
  └→ AI categorization needed
       │
       ├→ Sanitize description (minimal mode):
       │    "VENMO PAYMENT JOHN SMITH $50" → "VENMO PAYMENT [NAME_REDACTED] $50"
       │    "AMZN MKTP US*2K1AB3CD0" → "AMZN MKTP US" (strip order ID)
       │
       ├→ Build prompt with:
       │    - Sanitized description
       │    - Amount and date
       │    - COA account names (not numbers)
       │    - Recent history matches (payee patterns, not full descriptions)
       │
       └→ Send to cloud LLM (text only, no images)
```

**PII sent to cloud:** Sanitized merchant name, amount, date, COA account names. **No** personal names, account numbers, or addresses.

### Task 2: Receipt OCR

```
Receipt image uploaded
  │
  ├→ GLM-OCR available? 
  │    YES → Process locally → structured data → done (no cloud call needed)
  │
  └→ NO → Local fallback chain:
       │
       ├→ Tesseract OCR (local) → raw text extracted
       │
       ├→ Sanitize extracted text (standard mode):
       │    Strip card numbers, keep vendor/amounts/dates
       │
       └→ Send SANITIZED TEXT (not image) to cloud LLM:
            "Extract receipt data from this text:
             Vendor: Office Depot
             Date: 03/15/2026
             Printer Paper    $24.99
             Toner Cartridge  $47.83
             Subtotal         $72.82
             Tax              $5.98
             Total            $78.80
             Card: [CARD_REDACTED]"
```

**PII sent to cloud:** Vendor name, items purchased, amounts. **No** card numbers, personal info. The cloud LLM never sees the raw image.

**Accuracy trade-off:** If Tesseract misreads a character (e.g., "$47.83" as "$47.63"), the cloud LLM can't correct it because it never saw the image. GLM-OCR would have gotten it right. This is the quality cost of PII protection without GLM-OCR.

### Task 3: Bank Statement Parsing

```
Bank statement uploaded
  │
  ├→ Is it a text-based PDF?
  │    YES → Extract text with pdf-parse (100% accurate, local)
  │         │
  │         ├→ Split text into header and transaction sections
  │         │
  │         ├→ Sanitize header section (strict mode):
  │         │    Strip account holder name, account number, routing number
  │         │    Keep statement dates and balances (needed for validation)
  │         │
  │         ├→ Transaction rows: sanitize (minimal mode):
  │         │    Strip personal names in transfer descriptions
  │         │    Keep merchant names, amounts, dates
  │         │
  │         └→ Send sanitized transaction text to cloud LLM for structuring
  │
  ├→ Is it a scanned/image PDF?
  │    │
  │    ├→ GLM-OCR available?
  │    │    YES → Process locally → structured text → sanitize → done
  │    │
  │    └→ NO → Tesseract fallback:
  │         │
  │         ├→ Rasterize PDF pages to images
  │         ├→ Tesseract OCR (local) → raw text per page
  │         ├→ Sanitize (strict mode)
  │         └→ Send sanitized text to cloud LLM for structuring
  │
  └→ Is it a raw image (photo of statement)?
       │
       ├→ GLM-OCR available?
       │    YES → Process locally → sanitize → done
       │
       └→ NO → Tesseract → sanitize → cloud LLM (text only)
            │
            └→ Quality warning: "Scanned bank statements process best with 
                GLM-OCR enabled. Consider enabling it for better accuracy."
```

**PII sent to cloud (text-based PDF):** Transaction dates, sanitized descriptions, amounts, statement period dates, balances. **No** account holder name, account number, routing number, or address.

**PII sent to cloud (scanned, no GLM-OCR):** Same as above, but Tesseract quality is lower. The cloud LLM structures whatever text Tesseract extracted. Account numbers and names may leak if Tesseract extracts them and the sanitizer's regex doesn't catch an unusual format.

**The 80/20 insight:** Most bank statements downloaded from online banking are text-based PDFs. The local `pdf-parse` path handles these perfectly with zero AI cost and zero PII exposure. Scanned paper statements (the minority case) are where GLM-OCR matters most.

### Task 4: Document Classification

```
Document uploaded
  │
  ├→ GLM-OCR available?
  │    YES → Send image to GLM-OCR locally → classification + extract → done
  │
  └→ NO → Two-stage local approach:
       │
       ├→ Tesseract OCR (local) → extract first page text
       │
       ├→ Text-based classification (no image needed):
       │    Look for keywords to classify:
       │    - "receipt", "total", "subtotal", "tax" → receipt
       │    - "invoice", "bill to", "due date", "payment terms" → invoice
       │    - "statement", "beginning balance", "ending balance" → bank_statement
       │    - "W-2", "1099", "form", "tax return" → tax_form
       │
       └→ If keyword classification confidence > 0.8 → done (no cloud call)
          If unclear → send sanitized text snippet (first 500 chars) to cloud LLM
```

**PII sent to cloud:** Minimal — only a sanitized text snippet if keyword classification fails. No images. In most cases, the keyword classifier handles it locally.

---

## Two-Tier Consent Model

AI usage in KIS Books requires consent at TWO levels. Both must be active for any AI processing to occur.

```
┌──────────────────────────────────────────────────────────────────┐
│  TIER 1: SYSTEM LEVEL (Super Admin)                              │
│                                                                  │
│  "I have configured AI providers and accept the data handling    │
│   policies for the providers I've enabled."                      │
│                                                                  │
│  Controls: which providers are available, PII protection level,  │
│  cloud vision on/off, budget limits, prompt templates            │
│                                                                  │
│  Scope: applies to the entire KIS Books installation             │
├──────────────────────────────────────────────────────────────────┤
│  TIER 2: COMPANY LEVEL (Tenant Owner)                            │
│                                                                  │
│  "I understand that AI processing will send my bookkeeping data  │
│   to external services, and I opt in."                           │
│                                                                  │
│  Controls: AI on/off for this company, which tasks are enabled,  │
│  per-task opt-in                                                 │
│                                                                  │
│  Scope: applies to this company (tenant) only                    │
└──────────────────────────────────────────────────────────────────┘
```

**If either tier is disabled, AI is off.** The super admin enables the infrastructure. The company owner consents to using it for their data.

---

## Tier 1: System-Level Admin Controls

### PII Protection Settings

Add to `ai_config`:

```sql
ALTER TABLE ai_config ADD COLUMN pii_protection_level VARCHAR(20) DEFAULT 'strict';
  -- 'strict': never send images to cloud, maximum sanitization
  -- 'standard': text sanitization on all cloud calls, images only with GLM-OCR
  -- 'permissive': sanitization on, but allow cloud vision as fallback (admin opt-in)

ALTER TABLE ai_config ADD COLUMN cloud_vision_enabled BOOLEAN DEFAULT FALSE;
  -- Only relevant when pii_protection_level = 'permissive'
  -- When TRUE: raw images can be sent to cloud vision APIs as a last resort
  -- When FALSE: images never leave the server

ALTER TABLE ai_config ADD COLUMN admin_disclosure_accepted_at TIMESTAMPTZ;
ALTER TABLE ai_config ADD COLUMN admin_disclosure_accepted_by UUID REFERENCES users(id);
  -- Timestamp when super admin accepted the system-level AI disclosure
```

### Admin Disclosure (Required to Enable AI)

Before the super admin can set `is_enabled = TRUE` on `ai_config`, they must accept a disclosure:

**System AI Disclosure:**

> **AI Processing Data Disclosure**
>
> By enabling AI processing for this KIS Books installation, you acknowledge:
>
> **What data is sent to external services:**
> - Transaction descriptions from bank feeds (sanitized to remove personal identifiers)
> - Text extracted from uploaded receipts, invoices, and bank statements (sanitized based on your PII protection level)
> - Your chart of accounts names (used for categorization context)
>
> **What data is NEVER sent to external services:**
> - Complete bank account numbers, routing numbers, or SSN/EIN
> - Raw document images (unless you explicitly enable cloud vision in Permissive mode)
> - Aggregate financial data, balances, or reports
> - User passwords or authentication credentials
>
> **When using self-hosted models (Ollama / GLM-OCR local):**
> - No data leaves your server. All processing is local.
>
> **Provider data policies:**
> - Anthropic: [link to data usage policy]
> - OpenAI: [link to data usage policy]
> - Google Gemini: [link to data usage policy]
>
> **You can disable AI processing at any time.** Disabling does not affect existing transactions or bookkeeping data.
>
> ☐ I have read and accept this disclosure on behalf of this KIS Books installation.

- Acceptance is timestamped and logged to the audit trail
- Disclosure text is versioned — if the disclosure changes, re-acceptance is required
- Stored as `admin_disclosure_accepted_at` + `admin_disclosure_accepted_by`

### Admin UI

- [ ] **PII Protection Level selector** in AI Config page:

  **Strict (recommended for most users):**
  - "Images never leave your server. All cloud AI calls receive sanitized text only."
  - "Requires GLM-OCR (self-hosted) for best receipt and statement processing."
  - "Without GLM-OCR, Tesseract is used for OCR — accuracy is reduced for receipts and scanned documents."

  **Standard:**
  - "Text is sanitized before cloud calls. Images are processed locally only."
  - "Same as Strict but with softer sanitization on low-risk documents (receipts)."

  **Permissive (use with caution):**
  - Requires clicking through a PII acknowledgment:
    - "When GLM-OCR is not available and Tesseract cannot adequately process a document, KIS Books may send document images to your configured cloud AI provider."
    - "Cloud providers (Anthropic, OpenAI, Google) may process and temporarily store document images per their data policies."
    - "Bank statements and tax documents may contain account numbers, names, addresses, and other sensitive information."
    - Checkbox: "I understand the PII implications and accept the risk."
    - Timestamp and admin identity recorded

- [ ] **Per-provider data policy links:**
  - Anthropic: link to data usage policy
  - OpenAI: link to data usage policy
  - Google: link to data usage policy
  - Ollama: "Self-hosted — data never leaves your server"
  - GLM-OCR Local: "Self-hosted — data never leaves your server"
  - GLM-OCR Cloud: link to Z.AI data usage policy

- [ ] **GLM-OCR recommendation banner** (shown when GLM-OCR is not configured):
  - "For best accuracy and privacy, enable GLM-OCR (self-hosted). It runs on your server and processes documents without sending data to external services."
  - "Without GLM-OCR, document processing accuracy is reduced and some features require cloud AI."
  - Link to GLM-OCR setup instructions

---

## Tier 2: Company-Level AI Consent

### Data Model

```sql
ALTER TABLE companies ADD COLUMN ai_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE companies ADD COLUMN ai_enabled_tasks JSONB DEFAULT '{
  "categorization": false,
  "receipt_ocr": false,
  "statement_parsing": false,
  "document_classification": false
}'::jsonb;
ALTER TABLE companies ADD COLUMN ai_disclosure_accepted_at TIMESTAMPTZ;
ALTER TABLE companies ADD COLUMN ai_disclosure_accepted_by UUID REFERENCES users(id);
ALTER TABLE companies ADD COLUMN ai_disclosure_version INT;
  -- tracks which version of the disclosure was accepted
```

### Company AI Disclosure (Required to Enable AI for This Company)

When the company owner navigates to Settings > AI Processing and tries to enable AI, they must accept a disclosure specific to their company's data:

**Company AI Disclosure:**

> **AI Processing Consent for [Company Name]**
>
> By enabling AI processing for [Company Name], you consent to the following:
>
> **Transaction categorization** (if enabled):
> - When new bank transactions are imported, sanitized transaction descriptions (merchant names, amounts, dates) may be sent to [configured provider name] for automatic categorization.
> - Personal names in transfer descriptions (Venmo, Zelle, etc.) are removed before sending.
>
> **Receipt processing** (if enabled):
> - When you upload a receipt, the text extracted from the image may be sent to [configured provider name] to identify the vendor, date, and amount.
> - [If PII level = strict]: Receipt images are processed locally. Only extracted text is sent externally.
> - [If PII level = permissive]: Receipt images may be sent to [configured provider name] if local processing is insufficient.
>
> **Bank statement parsing** (if enabled):
> - When you upload a bank statement, transaction data extracted from the document may be sent to [configured provider name] for structuring.
> - Account holder names, account numbers, and routing numbers are removed before sending.
> - [If text-based PDF]: Transaction data is extracted locally. Only sanitized transaction rows are sent externally.
>
> **Document classification** (if enabled):
> - When you upload a document, a text excerpt may be sent to [configured provider name] to determine the document type.
>
> **Your data controls:**
> - You can disable AI processing at any time from this settings page.
> - You can enable or disable individual AI tasks independently.
> - Disabling AI does not delete any existing transactions or data.
> - All AI suggestions require your review and approval before affecting your books.
>
> **Current system configuration:**
> - PII Protection Level: [Strict / Standard / Permissive]
> - Categorization Provider: [Anthropic Claude / OpenAI / Ollama (self-hosted) / etc.]
> - OCR Provider: [GLM-OCR (self-hosted) / Anthropic / etc.]
>
> ☐ I consent to AI processing for [Company Name] as described above.

- The disclosure text is **dynamically generated** based on the current system configuration (which providers are active, PII level, etc.)
- If the system config changes (e.g., admin switches from self-hosted to cloud provider), the company disclosure is invalidated and must be re-accepted
- Stored per-company with version tracking

### Company AI Settings Page

```
packages/web/src/features/settings/CompanyAiSettingsPage.tsx
```

- [ ] **AI status card:**
  - If system AI is disabled: "AI processing is not available. Contact your system administrator."
  - If system AI enabled but company not opted in: "AI processing is available for your account. Enable it to automate categorization, receipt scanning, and more."
  - If opted in: "AI processing is active for [Company Name]." Green badge.

- [ ] **Enable AI button** (if not opted in):
  - Opens the company disclosure modal
  - After acceptance: shows per-task toggles

- [ ] **Per-task toggles** (shown after opt-in):
  - ☐ Auto-categorize bank feed transactions
  - ☐ Process uploaded receipts with OCR
  - ☐ Parse uploaded bank statements
  - ☐ Auto-classify uploaded documents
  - Each toggle can be enabled/disabled independently
  - Changes take effect immediately

- [ ] **Current configuration summary** (read-only, informational):
  - "PII Protection: Strict" (set by admin)
  - "Categorization uses: Anthropic Claude Sonnet"
  - "OCR uses: GLM-OCR (self-hosted)"
  - "Your data: [description based on PII level]"

- [ ] **Disable AI button:**
  - "Disable all AI processing for [Company Name]"
  - Confirmation: "AI features will be turned off. Your existing data is not affected."
  - Does not revoke the disclosure — re-enabling doesn't require re-acceptance unless system config changed

- [ ] **Disclosure history:**
  - "Consent accepted on [date] by [user name]"
  - "View disclosure" link → shows the disclosure text that was accepted
  - "Revoke consent" link → disables AI and clears the acceptance record

- [ ] Add "AI Processing" section to company Settings sidebar

---

## On-Screen AI Usage Disclosure

Every screen where AI is actively processing or has processed data must display a visible indicator. This is not a one-time banner — it persists as long as AI features are active.

### Disclosure Indicator Component

```
packages/web/src/components/ui/AiDisclosureBadge.tsx
```

A small, non-intrusive but always-visible indicator that appears on screens where AI is in use.

**Design:** A compact pill badge with an AI icon:

```
[🤖 AI-assisted · Strict mode · Anthropic]
```

Clicking the badge opens a disclosure popover with details about what data was/is being sent and to which provider.

### Where the indicator appears:

- [ ] **Bank feed page** (when auto-categorization is active):
  - Badge in the toolbar: `[🤖 AI categorization active · {provider}]`
  - On each AI-categorized item: small "AI" badge next to the suggested category
  - Hovering the AI badge on an item shows: "This suggestion was generated by [provider]. A sanitized description was sent for categorization. [Learn more]"

- [ ] **Receipt capture / attachment upload** (when OCR is active):
  - Badge during processing: `[🤖 Processing with {provider}...]`
  - On completed OCR results: `[🤖 Extracted by {provider}]`
  - Hover details: "Text was extracted locally by [Tesseract/GLM-OCR]. Sanitized text was sent to [provider] for structuring."
  - Or if self-hosted: "Processed entirely on your server by GLM-OCR. No data was sent externally."

- [ ] **Bank statement import** (when parser is active):
  - Badge on the import page: `[🤖 Statement parsing active · {provider}]`
  - On each extracted transaction row: subtle AI indicator if the row was AI-structured
  - Hover: "Transaction data was extracted from your statement. [Text-based PDF: extracted locally / Scanned: processed by Tesseract]. Sanitized text was sent to [provider] for structuring."

- [ ] **Transaction list / register** (on AI-categorized transactions):
  - Transactions that were categorized by AI show a small `AI` badge in the source column
  - Badge persists permanently — it's part of the transaction's history
  - Hover: "This transaction was categorized by AI ([provider]) on [date]. You [accepted / modified] the suggestion."

- [ ] **Dashboard** (if any AI feature is active):
  - Subtle footer text: "AI processing is active for this company. [View settings]"

### Disclosure Popover Content

When the user clicks any AI badge, a popover shows:

```
┌──────────────────────────────────────────┐
│  AI Processing Details                    │
│                                          │
│  Provider: Anthropic (Claude Sonnet)     │
│  PII Protection: Strict                  │
│                                          │
│  What was sent:                          │
│  • Sanitized transaction description     │
│  • Transaction amount and date           │
│  • Your chart of accounts names          │
│                                          │
│  What was NOT sent:                      │
│  • Account numbers or routing numbers    │
│  • Personal names or addresses           │
│  • Raw document images                   │
│                                          │
│  [View full disclosure] [AI Settings]     │
└──────────────────────────────────────────┘
```

For self-hosted providers:

```
┌──────────────────────────────────────────┐
│  AI Processing Details                    │
│                                          │
│  Provider: GLM-OCR (self-hosted)         │
│  PII Protection: N/A (local processing)  │
│                                          │
│  ✓ All processing was performed locally  │
│    on your server. No data was sent to   │
│    any external service.                 │
│                                          │
│  [View full disclosure] [AI Settings]     │
└──────────────────────────────────────────┘
```

### Re-Consent Trigger

If the system configuration changes in a way that affects data handling, company-level consent is invalidated:

| Change | Re-consent required? |
|---|---|
| Admin switches categorization from Ollama to Anthropic | **Yes** — data now goes to a cloud provider |
| Admin switches from Anthropic to OpenAI | **Yes** — different provider with different data policy |
| Admin changes PII level from strict to permissive | **Yes** — more data potentially exposed |
| Admin changes PII level from permissive to strict | **No** — more protective, not less |
| Admin switches from cloud to Ollama | **No** — more protective |
| Admin adds a new provider but doesn't change task assignment | **No** — task routing unchanged |
| Admin updates a prompt template | **No** — doesn't change data flow |

When re-consent is required:
1. AI processing is paused for affected companies
2. Next time the company owner visits AI Settings, they see: "Your AI configuration has changed. Please review and re-accept the updated disclosure."
3. AI remains paused until the new disclosure is accepted

### Consent Version Tracking

```sql
-- System-level disclosure version (incremented on config changes that require re-consent)
ALTER TABLE ai_config ADD COLUMN disclosure_version INT DEFAULT 1;

-- Company tracks which version they accepted
-- ai_disclosure_version on companies table (already added above)
```

When `ai_config.disclosure_version > companies.ai_disclosure_version`, the company's consent is stale and AI is paused.

---

## Fallback Quality Warnings

When the system uses a lower-quality path due to missing GLM-OCR, surface clear warnings to the user:

- [ ] **Receipt processed with Tesseract:**
  - Confidence badge shows amber instead of green
  - Note: "This receipt was processed with basic OCR. Some values may be inaccurate. Enable GLM-OCR for better results."

- [ ] **Scanned bank statement without GLM-OCR:**
  - Warning before processing: "This appears to be a scanned statement. For best results, download a digital PDF from your bank's website, or enable GLM-OCR for accurate image processing."
  - If processed anyway: lower confidence scores, more fields marked as "uncertain"

- [ ] **Document classification uncertain:**
  - "We couldn't determine the document type automatically. What type of document is this?" with manual selector

---

## Sanitizer Performance

The PII sanitizer runs locally and must be fast (it runs on every cloud-bound text):

- Regex-based pattern matching: < 1ms for a typical bank feed description
- Full bank statement page sanitization: < 10ms per page
- Receipt text sanitization: < 5ms
- No external dependencies — pure TypeScript regex and string operations

---

## Build Checklist — PII Protection Additions

### Services
- [ ] Create `packages/api/src/services/pii-sanitizer.service.ts`:
  - `sanitize(text, mode)` — apply pattern-based masking
  - `detectPiiTypes(text)` — return list of PII types found (for logging/audit)
  - `sanitizeStatementHeader(text)` — specialized for bank statement headers
  - `sanitizeTransactionDescription(text)` — specialized for bank feed descriptions
  - Regex patterns for: SSN, EIN, bank account numbers, routing numbers, credit card numbers, phone numbers, email addresses, mailing addresses, personal names after payment app keywords
- [ ] Create `packages/api/src/services/local-ocr.service.ts`:
  - `extractTextFromPdf(buffer)` — pdf-parse for text-based PDFs
  - `isPdfTextBased(buffer)` — check if PDF has extractable text layer
  - `rasterizePdfPage(buffer, pageNumber)` — convert PDF page to image for Tesseract
  - `tesseractOcr(imageBuffer)` — Tesseract OCR with preprocessing (rotate, deskew, contrast)
  - `preprocessImage(imageBuffer)` — sharp-based image enhancement for better Tesseract results
- [ ] Install dependencies: `pdf-parse`, `tesseract.js`, `sharp`
- [ ] Update `ai-orchestrator.service.ts`:
  - Route through PII sanitizer before any cloud provider call
  - Select sanitizer mode based on provider type (local = none, cloud = task-appropriate)
  - Enforce `cloud_vision_enabled` flag
  - Add quality warnings to AI job results when using fallback paths
- [ ] Update all AI task services:
  - `ai-categorization.service.ts` — sanitize descriptions (minimal mode)
  - `ai-receipt-ocr.service.ts` — two-layer pipeline (local extraction → sanitize → cloud structuring)
  - `ai-statement-parser.service.ts` — PDF text detection → local extract or Tesseract → sanitize → cloud structuring
  - `ai-document-classifier.service.ts` — keyword-first classification, sanitized text fallback

### Database
- [ ] Add `pii_protection_level`, `cloud_vision_enabled`, `admin_disclosure_accepted_at`, `admin_disclosure_accepted_by`, `disclosure_version` columns to `ai_config`
- [ ] Add `ai_enabled`, `ai_enabled_tasks`, `ai_disclosure_accepted_at`, `ai_disclosure_accepted_by`, `ai_disclosure_version` columns to `companies`

### Services (Consent & Disclosure)
- [ ] Create `packages/api/src/services/ai-consent.service.ts`:
  - `getSystemDisclosure()` — return current system-level disclosure text
  - `acceptSystemDisclosure(userId)` — record admin acceptance with timestamp
  - `getCompanyDisclosure(tenantId)` — generate dynamic company disclosure based on current system config (provider names, PII level, enabled tasks)
  - `acceptCompanyDisclosure(tenantId, userId)` — record company acceptance with version
  - `isCompanyConsentCurrent(tenantId)` — check if `companies.ai_disclosure_version >= ai_config.disclosure_version`
  - `invalidateCompanyConsent(reason)` — increment `ai_config.disclosure_version`, pause AI for all companies with stale consent
  - `getConsentStatus(tenantId)` — return `{ systemEnabled, systemDisclosureAccepted, companyEnabled, companyDisclosureAccepted, consentCurrent }`
- [ ] Update `ai-config.service.ts`:
  - On config change that affects data flow (provider switch, PII level loosened): call `invalidateCompanyConsent()`
  - Block AI operations if system disclosure not accepted
- [ ] Update `ai-orchestrator.service.ts`:
  - Before processing any task: check both `isAiEnabled()` AND `isCompanyConsentCurrent(tenantId)`
  - If company consent is stale: return `{ blocked: true, reason: 'consent_stale' }`

### Frontend (Admin)
- [ ] Create system AI disclosure modal component — shown when admin first enables AI
- [ ] Add PII Protection Level selector to AI Config admin page with descriptions
- [ ] Add PII acknowledgment dialog for permissive mode (separate from the main disclosure)
- [ ] Add per-provider data policy links (Anthropic, OpenAI, Google, Ollama, GLM-OCR Cloud, GLM-OCR Local)
- [ ] Add GLM-OCR recommendation banner when not configured
- [ ] Show disclosure acceptance status: "Accepted on [date] by [admin name]"

### Frontend (Company)
- [ ] Create `CompanyAiSettingsPage.tsx` — AI status, per-task toggles, current config summary, disclosure history
- [ ] Create company AI disclosure modal — dynamically generated based on current system config (provider names, PII level)
- [ ] Implement per-task enable/disable toggles (categorization, receipt OCR, statement parsing, document classification)
- [ ] Implement re-consent flow: when system config changes, show "Configuration has changed — please review and re-accept"
- [ ] Implement consent revocation ("Revoke consent" → disables AI, clears acceptance)
- [ ] Add "AI Processing" to company Settings sidebar

### Frontend (On-Screen Disclosure)
- [ ] Create `AiDisclosureBadge.tsx` — compact pill badge with provider info, click to expand
- [ ] Create `AiDisclosurePopover.tsx` — detailed popover showing what was/wasn't sent, per-provider
- [ ] Add AI badge to bank feed page toolbar (when auto-categorization active)
- [ ] Add AI badge to each AI-categorized bank feed item (hover for details)
- [ ] Add AI badge to receipt capture during and after OCR processing
- [ ] Add AI badge to bank statement import page during and after parsing
- [ ] Add AI badge to transaction list/register for AI-categorized transactions (permanent)
- [ ] Add AI footer to dashboard when any AI feature is active
- [ ] Self-hosted badge variant: "Processed locally — no data sent externally"
- [ ] Add quality warnings on receipts processed with Tesseract
- [ ] Add quality warnings on scanned statements without GLM-OCR
- [ ] Add manual document type selector fallback

### Tests
- [ ] Write Vitest tests:
  - [ ] Sanitizer detects and masks SSN (XXX-XX-XXXX format)
  - [ ] Sanitizer detects and masks EIN (XX-XXXXXXX format)
  - [ ] Sanitizer detects and masks bank account numbers in context
  - [ ] Sanitizer detects and masks full credit card numbers
  - [ ] Sanitizer preserves card last-4 (useful for matching)
  - [ ] Sanitizer masks personal names after VENMO/ZELLE/PAYPAL keywords
  - [ ] Sanitizer preserves merchant names and amounts
  - [ ] Sanitizer preserves dates in all common formats
  - [ ] Strict mode masks more aggressively than minimal mode
  - [ ] Self-hosted provider bypasses sanitizer entirely
  - [ ] Cloud provider with strict mode: no images sent, only sanitized text
  - [ ] Permissive mode without admin acknowledgment: cloud vision blocked
  - [ ] Permissive mode with admin acknowledgment: cloud vision allowed
  - [ ] Text-based PDF detected correctly and processed without OCR
  - [ ] Scanned PDF detected and routed to Tesseract fallback
  - [ ] Tesseract produces readable output from a clean receipt image
  - [ ] Keyword classifier correctly identifies receipt, invoice, statement from text alone
  - [ ] Quality warning attached to AI job when Tesseract used instead of GLM-OCR
  - [ ] Two-tier consent: system enabled + company enabled → AI processes
  - [ ] Two-tier consent: system enabled + company disabled → AI blocked
  - [ ] Two-tier consent: system disabled + company enabled → AI blocked
  - [ ] Company disclosure invalidated on provider change → AI paused until re-consent
  - [ ] Company disclosure NOT invalidated when switching cloud → self-hosted (more protective)
  - [ ] Re-consent required when switching self-hosted → cloud
  - [ ] AI badge renders on bank feed items categorized by AI
  - [ ] AI badge popover shows correct provider and data-sent details
  - [ ] Self-hosted AI badge shows "processed locally" variant

### Ship Gate Additions
- [ ] **System disclosure:** Admin cannot enable AI without accepting system disclosure
- [ ] **System disclosure:** Acceptance recorded with timestamp and admin identity in audit log
- [ ] **Company disclosure:** Company owner cannot enable AI without accepting company disclosure
- [ ] **Company disclosure:** Disclosure text dynamically includes current provider names and PII level
- [ ] **Re-consent:** Admin switches categorization from Ollama to Anthropic → company consent invalidated → AI paused
- [ ] **Re-consent:** Company owner sees "Configuration changed" banner → re-accepts → AI resumes
- [ ] **Re-consent:** Admin switches from cloud to Ollama → company consent NOT invalidated (more protective)
- [ ] **Per-task toggles:** Company enables receipt OCR but disables statement parsing → receipts processed, statements not
- [ ] **On-screen badge:** Bank feed shows `[🤖 AI categorization · Anthropic]` badge when active
- [ ] **On-screen badge:** AI-categorized transaction shows permanent AI badge in register
- [ ] **On-screen badge:** Click badge → popover shows what was sent and what wasn't
- [ ] **On-screen badge:** Self-hosted → badge shows "Processed locally — no data sent externally"
- [ ] **Strict mode:** Upload bank statement → processed with local PDF extraction + sanitized text to cloud → no PII in cloud request
- [ ] **Strict mode:** Upload receipt photo without GLM-OCR → Tesseract extracts text → sanitized text sent to cloud → no image sent
- [ ] **Strict mode:** Categorization of "VENMO PAYMENT JOHN SMITH" → name masked before cloud call
- [ ] **Permissive mode:** Requires admin acknowledgment → cloud vision enabled → scanned statement image sent to cloud
- [ ] **Self-hosted (Ollama/GLM-OCR):** No sanitization applied, full data stays local, badges show "local"
- [ ] **Text-based PDF:** Detected and processed entirely locally — zero cloud calls for extraction
- [ ] **GLM-OCR banner:** Shown when not configured, links to setup docs
- [ ] **Quality warning:** Receipt processed with Tesseract shows amber confidence badge and recommendation
- [ ] **Consent revocation:** Company owner revokes consent → AI disabled → AI badges disappear from all screens
