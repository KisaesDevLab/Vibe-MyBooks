# KIS Books — AI Processing Integration Feature Plan

**Feature:** Multi-provider AI integration for transaction categorization, document parsing, receipt OCR, and bank statement import — with Anthropic, OpenAI, Gemini, self-hosted LLM, and GLM-OCR support
**Date:** April 2, 2026
**Depends on:** BUILD_PLAN.md Phases 1–7 (full MVP through banking), Bank Rules feature
**Integrates with:** Bank Feed, Receipt Capture, Bank Statement Import, Batch Entry, Account Register

---

## Feature Overview

AI in KIS Books is a **processing assistant**, not an analyst. It helps with mechanical tasks that are tedious, error-prone, or time-consuming when done manually. It never generates financial reports, offers business advice, or interprets the numbers — that's the accountant's job.

### AI-Powered Tasks

| Task | Input | AI Output | User Action |
|---|---|---|---|
| **Transaction Categorization** | Bank feed item (description, amount, date) | Suggested COA account + vendor + memo | Review and approve or override |
| **Bank Statement Parsing** | PDF/image of a bank statement | Structured transaction rows (date, description, amount, balance) | Review in bank feed or batch entry grid |
| **Receipt OCR** | Photo/scan of a receipt | Vendor name, date, line items, total, tax, payment method | Match to existing transaction or create new expense |
| **Invoice OCR** | Photo/scan of a vendor invoice/bill | Vendor, invoice number, date, due date, line items, total | Create expense or bill (future AP) |
| **Document Classification** | Any uploaded document | Document type (receipt, invoice, bank statement, tax form, other) | Route to appropriate processing pipeline |

### What AI Does NOT Do

- No financial analysis or reporting
- No business advice or recommendations
- No access to aggregate financial data
- No autonomous transaction creation — every AI output is a suggestion that the user approves
- No training on user data — all processing is stateless prompt-based

### Provider Support

| Provider | Type | Models | Use Cases |
|---|---|---|---|
| **Anthropic** | Cloud API | Claude Sonnet, Claude Haiku | Categorization, document understanding |
| **OpenAI** | Cloud API | GPT-4o, GPT-4o-mini | Categorization, document understanding |
| **Google** | Cloud API | Gemini 2.5 Flash, Gemini 2.5 Pro | Categorization, document understanding |
| **Self-Hosted (Ollama)** | Local | Any Ollama-compatible model | Categorization, privacy-sensitive processing |
| **GLM-OCR** | Cloud API or Local (Ollama) | GLM-OCR 0.9B | Receipt OCR, bank statement parsing, document extraction |

---

## 1. Data Model

### 1.1 AI Provider Configuration

```sql
CREATE TABLE ai_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Master switch
  is_enabled BOOLEAN DEFAULT FALSE,
  -- Provider selection per task
  categorization_provider VARCHAR(30),          -- 'anthropic' | 'openai' | 'gemini' | 'ollama'
  categorization_model VARCHAR(100),            -- e.g., 'claude-sonnet-4-20250514'
  ocr_provider VARCHAR(30),                     -- 'glm_ocr_cloud' | 'glm_ocr_local' | 'anthropic' | 'openai' | 'gemini' | 'ollama'
  ocr_model VARCHAR(100),                       -- e.g., 'glm-ocr'
  document_classification_provider VARCHAR(30),
  document_classification_model VARCHAR(100),
  -- Fallback chain (JSON array of provider names, tried in order)
  fallback_chain JSONB DEFAULT '["anthropic","openai","gemini","ollama"]'::jsonb,
  -- Provider credentials (all encrypted)
  anthropic_api_key_encrypted TEXT,
  openai_api_key_encrypted TEXT,
  gemini_api_key_encrypted TEXT,
  ollama_base_url VARCHAR(500),                -- e.g., 'http://ollama:11434' or 'http://localhost:11434'
  glm_ocr_api_key_encrypted TEXT,              -- for GLM-OCR cloud API
  glm_ocr_base_url VARCHAR(500),               -- for self-hosted GLM-OCR (Ollama endpoint)
  -- Processing settings
  auto_categorize_on_import BOOLEAN DEFAULT TRUE,
  auto_ocr_on_upload BOOLEAN DEFAULT TRUE,
  categorization_confidence_threshold DECIMAL(3,2) DEFAULT 0.70,  -- minimum confidence to auto-suggest
  max_concurrent_jobs INT DEFAULT 5,
  -- Cost tracking
  track_usage BOOLEAN DEFAULT TRUE,
  monthly_budget_limit DECIMAL(19,4),          -- NULL = unlimited
  -- Metadata
  configured_by UUID REFERENCES users(id),
  configured_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 1.2 AI Processing Jobs

```sql
CREATE TABLE ai_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  -- Job type and status
  job_type VARCHAR(50) NOT NULL,              -- 'categorize' | 'ocr_receipt' | 'ocr_statement' | 'ocr_invoice' | 'classify_document'
  status VARCHAR(20) DEFAULT 'pending',       -- 'pending' | 'processing' | 'complete' | 'failed' | 'cancelled'
  -- Provider used
  provider VARCHAR(30),
  model VARCHAR(100),
  -- Input reference
  input_type VARCHAR(30),                     -- 'bank_feed_item' | 'attachment' | 'text'
  input_id UUID,                              -- ID of the bank_feed_item or attachment
  input_data JSONB,                           -- raw input sent to the model (for debugging/replay)
  -- Output
  output_data JSONB,                          -- structured result from AI
  confidence_score DECIMAL(3,2),              -- 0.00–1.00
  -- User action
  user_accepted BOOLEAN,                      -- TRUE if user approved the suggestion
  user_modified BOOLEAN,                      -- TRUE if user accepted with modifications
  user_action_at TIMESTAMPTZ,
  -- Cost tracking
  input_tokens INT,
  output_tokens INT,
  estimated_cost DECIMAL(10,6),               -- estimated USD cost for this call
  -- Timing
  processing_started_at TIMESTAMPTZ,
  processing_completed_at TIMESTAMPTZ,
  processing_duration_ms INT,
  -- Error handling
  error_message TEXT,
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_aij_tenant ON ai_jobs(tenant_id);
CREATE INDEX idx_aij_status ON ai_jobs(tenant_id, status);
CREATE INDEX idx_aij_type ON ai_jobs(tenant_id, job_type);
CREATE INDEX idx_aij_input ON ai_jobs(input_type, input_id);
```

### 1.3 AI Usage Tracking

```sql
CREATE TABLE ai_usage_log (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL,
  provider VARCHAR(30) NOT NULL,
  model VARCHAR(100) NOT NULL,
  job_type VARCHAR(50) NOT NULL,
  input_tokens INT DEFAULT 0,
  output_tokens INT DEFAULT 0,
  estimated_cost DECIMAL(10,6) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_aul_tenant_month ON ai_usage_log(tenant_id, created_at);
CREATE INDEX idx_aul_provider ON ai_usage_log(provider, created_at);
```

### 1.4 Prompt Templates

```sql
CREATE TABLE ai_prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type VARCHAR(50) NOT NULL,             -- 'categorize' | 'ocr_receipt' | 'ocr_statement' | 'classify_document'
  provider VARCHAR(30),                       -- NULL = works with any provider
  version INT NOT NULL DEFAULT 1,
  system_prompt TEXT NOT NULL,
  user_prompt_template TEXT NOT NULL,          -- supports {{variable}} substitution
  output_schema JSONB,                        -- expected JSON structure for validation
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(task_type, provider, version)
);
```

### 1.5 Categorization Learning Cache

```sql
CREATE TABLE categorization_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  -- What was categorized
  payee_pattern VARCHAR(255) NOT NULL,        -- normalized payee/description (lowercased, trimmed)
  amount_range_min DECIMAL(19,4),
  amount_range_max DECIMAL(19,4),
  -- What it was categorized as
  account_id UUID NOT NULL REFERENCES accounts(id),
  contact_id UUID REFERENCES contacts(id),
  tags UUID[],
  -- Confidence
  times_confirmed INT DEFAULT 1,             -- incremented each time user confirms this mapping
  times_overridden INT DEFAULT 0,            -- incremented when user chooses differently
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ch_tenant_payee ON categorization_history(tenant_id, payee_pattern);
```

This table is the "memory" that makes categorization better over time — without sending financial data to the LLM for training. It's a local lookup table of past user decisions.

---

## 2. Provider Abstraction Layer

### 2.1 Provider Interface

```typescript
interface AiProvider {
  name: string;
  supportsVision: boolean;
  
  // Text completion
  complete(params: CompletionParams): Promise<CompletionResult>;
  
  // Vision (image + text)
  completeWithImage(params: VisionParams): Promise<CompletionResult>;
  
  // Test connection
  testConnection(): Promise<{ success: boolean; error?: string; model_info?: string }>;
  
  // Cost estimation
  estimateCost(inputTokens: number, outputTokens: number): number;
}

interface CompletionParams {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;         // default 0.1 for deterministic processing
  maxTokens?: number;
  responseFormat?: 'json' | 'text';
}

interface VisionParams extends CompletionParams {
  images: Array<{ base64: string; mimeType: string }>;
}

interface CompletionResult {
  text: string;
  parsed?: any;                 // parsed JSON if responseFormat = 'json'
  inputTokens: number;
  outputTokens: number;
  model: string;
  provider: string;
  durationMs: number;
}
```

### 2.2 Provider Implementations

```
packages/api/src/services/ai-providers/
├── ai-provider.interface.ts       # Interface definition
├── anthropic.provider.ts          # Claude models
├── openai.provider.ts             # GPT models
├── gemini.provider.ts             # Gemini models
├── ollama.provider.ts             # Self-hosted (Ollama API)
├── glm-ocr.provider.ts            # GLM-OCR (cloud API or local Ollama)
└── index.ts                       # Provider factory
```

**Anthropic Provider:**
- [ ] SDK: `@anthropic-ai/sdk`
- [ ] Models: `claude-sonnet-4-20250514`, `claude-haiku-4-5-20251001`
- [ ] Vision: supported (image in `content` array with `type: "image"`)
- [ ] JSON mode: via `response_format: { type: "json_object" }` or system prompt instruction
- [ ] Cost: varies by model (e.g., Sonnet: $3/$15 per MTok input/output)

**OpenAI Provider:**
- [ ] SDK: `openai`
- [ ] Models: `gpt-4o`, `gpt-4o-mini`
- [ ] Vision: supported (image_url in content)
- [ ] JSON mode: `response_format: { type: "json_object" }`
- [ ] Cost: varies by model

**Gemini Provider:**
- [ ] SDK: `@google/genai`
- [ ] Models: `gemini-2.5-flash`, `gemini-2.5-pro`
- [ ] Vision: supported (inline_data with base64)
- [ ] JSON mode: `responseMimeType: "application/json"` + `responseSchema`
- [ ] Cost: varies by model

**Ollama Provider:**
- [ ] No SDK needed — direct HTTP calls to Ollama REST API
- [ ] Base URL configurable (default `http://localhost:11434`)
- [ ] Endpoint: `POST /api/chat` with `model`, `messages`, `format: "json"`, `stream: false`
- [ ] Vision: supported by vision-capable models (llava, llama3.2-vision, etc.)
- [ ] Cost: $0 (self-hosted)
- [ ] `testConnection()`: calls `GET /api/tags` to list available models

**GLM-OCR Provider:**
- [ ] Two modes:
  - **Cloud API:** HTTP calls to `https://api.z.ai/api/paas/v4/layout_parsing` with API key
  - **Local (Ollama):** Same Ollama endpoint but with `model: "glm-ocr"`
- [ ] Specialized for document parsing — returns structured Markdown/JSON
- [ ] Input: image (base64 or URL)
- [ ] `testConnection()`: send a simple test image, verify response

### 2.3 Provider Factory

```typescript
function getProvider(providerName: string, config: AiConfig): AiProvider {
  switch (providerName) {
    case 'anthropic': return new AnthropicProvider(decrypt(config.anthropic_api_key_encrypted));
    case 'openai': return new OpenAiProvider(decrypt(config.openai_api_key_encrypted));
    case 'gemini': return new GeminiProvider(decrypt(config.gemini_api_key_encrypted));
    case 'ollama': return new OllamaProvider(config.ollama_base_url);
    case 'glm_ocr_cloud': return new GlmOcrProvider('cloud', decrypt(config.glm_ocr_api_key_encrypted));
    case 'glm_ocr_local': return new GlmOcrProvider('local', config.glm_ocr_base_url);
    default: throw new Error(`Unknown AI provider: ${providerName}`);
  }
}
```

### 2.4 Fallback Chain

If the primary provider fails (API error, rate limit, timeout), try the next provider in the fallback chain:

```typescript
async function executeWithFallback(
  task: AiTask, 
  config: AiConfig
): Promise<CompletionResult> {
  const chain = config.fallback_chain as string[];
  for (const providerName of chain) {
    if (!hasCredentials(providerName, config)) continue;
    try {
      const provider = getProvider(providerName, config);
      return await provider.complete(task.params);
    } catch (error) {
      log.warn(`AI provider ${providerName} failed, trying next`, error);
      continue;
    }
  }
  throw new Error('All AI providers failed');
}
```

---

## 3. AI Task: Transaction Categorization

### 3.1 How It Works

When a new bank feed item arrives (from Plaid or CSV import):

1. **Bank Rules check** (deterministic, instant) — if a rule matches, use it. Done.
2. **Categorization history lookup** (local, no AI call) — if the payee pattern has been confirmed 3+ times for the same account, suggest it with high confidence. Done.
3. **AI categorization** (cloud/local call) — send the transaction description, amount, and the tenant's COA list to the LLM. The LLM returns a suggested account, vendor, and confidence score.

This three-layer approach minimizes AI calls (and cost) while maximizing accuracy over time.

### 3.2 Categorization Prompt

```
System: You are a bookkeeping assistant. Given a bank transaction description and amount, 
suggest the most likely expense category (account) and vendor from the provided lists.

Respond in JSON format:
{
  "account_name": "string — exact name from the accounts list",
  "contact_name": "string — vendor name (clean, normalized) or null",
  "memo": "string — brief description for the transaction",
  "confidence": 0.0 to 1.0
}

Rules:
- Match to the most specific account possible
- If the transaction is a deposit/income, use a revenue account
- If uncertain, set confidence below 0.5
- Do not invent account names — only use names from the provided list

User: 
Transaction: "AMZN MKTP US*2K1AB3CD0"
Amount: -$47.82 (expense)
Date: 2026-03-15

Available accounts:
{{accounts_list}}

Recent categorizations for similar transactions:
{{history_context}}
```

### 3.3 Context Window Management

The COA list can be large (250 accounts). To fit within reasonable context limits:

- Only send active accounts relevant to the transaction direction (expenses for debits, revenue for credits)
- Include account name and number only (not descriptions)
- Include last 5 categorization history matches for similar payee patterns
- Total prompt should stay under 2,000 tokens for efficiency

### 3.4 Learning Loop

After the user accepts, modifies, or overrides an AI suggestion:

1. Normalize the payee pattern: lowercase, trim, remove transaction-specific suffixes (order numbers, dates)
2. Upsert `categorization_history`: if the payee pattern + account combination exists, increment `times_confirmed`; if the user chose differently, increment `times_overridden` on the old mapping and create/increment the new one
3. Over time, patterns with high `times_confirmed` and low `times_overridden` become trusted and skip the AI call entirely

---

## 4. AI Task: Receipt OCR

### 4.1 Pipeline

```
Receipt image uploaded →
  Document classification (is this a receipt?) →
    GLM-OCR extracts structured data →
      AI post-processes and normalizes →
        Match to existing transaction OR create new expense
```

### 4.2 GLM-OCR Receipt Extraction

GLM-OCR is the primary engine for receipt processing. It returns structured Markdown or JSON from a receipt image.

**Prompt for GLM-OCR (or vision LLM):**

```
Extract the following information from this receipt image. Return JSON only:
{
  "vendor_name": "string",
  "vendor_address": "string or null",
  "date": "YYYY-MM-DD",
  "items": [
    { "description": "string", "quantity": number, "unit_price": number, "amount": number }
  ],
  "subtotal": number,
  "tax_amount": number,
  "tax_rate": number or null,
  "total": number,
  "payment_method": "cash | credit_card | debit_card | other | null",
  "last_four_digits": "string or null",
  "currency": "USD"
}

If any field cannot be determined, set it to null.
```

### 4.3 Post-Processing

After OCR extraction:

1. **Normalize vendor name:** strip "Inc", "LLC", punctuation variations. Match against existing contacts (fuzzy).
2. **Validate amounts:** check `subtotal + tax = total` (within $0.02 tolerance for rounding)
3. **Match to transaction:** look for existing bank feed items or posted transactions with:
   - Amount within $0.50 of the receipt total
   - Date within ±5 days
   - Same vendor (if matched to a contact)
4. **Confidence scoring:**
   - All fields extracted clearly: 0.9+
   - Some fields uncertain: 0.6–0.8
   - Major fields missing (total, vendor): < 0.5

### 4.4 User Review

The user sees the extracted data in a review form (pre-filled, editable):
- Vendor name (matched to existing contact or "Create new")
- Date
- Line items (if extracted) or just total
- Tax amount
- Total
- Matched transaction (if found) with "Confirm Match" button
- "Create Expense" button (if no match)
- Confidence indicator

---

## 5. AI Task: Bank Statement Parsing

### 5.1 Pipeline

```
Bank statement PDF/image uploaded →
  Document classification (is this a bank statement?) →
    GLM-OCR extracts full page structure →
      AI parses transactions table into structured rows →
        Rows loaded into bank feed or batch entry grid for review
```

### 5.2 Statement Extraction Prompt

**Step 1: GLM-OCR Document Parsing**

Send each page to GLM-OCR for layout-aware text extraction. GLM-OCR returns structured Markdown with tables preserved.

**Step 2: LLM Transaction Extraction**

```
System: You are a bank statement parser. Given the text content of a bank statement page,
extract each transaction into a structured JSON array.

For each transaction, extract:
{
  "date": "YYYY-MM-DD",
  "description": "string — the full transaction description",
  "amount": number — positive for deposits, negative for withdrawals/debits,
  "balance": number or null — running balance if shown,
  "ref_number": "string or null — check number or reference"
}

Also extract the statement metadata:
{
  "bank_name": "string",
  "account_name": "string",
  "account_number_last4": "string",
  "statement_period_start": "YYYY-MM-DD",
  "statement_period_end": "YYYY-MM-DD",
  "beginning_balance": number,
  "ending_balance": number,
  "transactions": [ ... ]
}

Rules:
- Parse dates according to the format used in the statement
- Amounts: debits/withdrawals are negative, credits/deposits are positive
- Include ALL transactions on the page
- Preserve the exact description text

User: 
{{glm_ocr_markdown_output}}
```

### 5.3 Multi-Page Handling

Bank statements are often multi-page. The pipeline:

1. Split PDF into individual pages
2. Send each page to GLM-OCR independently (parallel processing)
3. Send each page's OCR output to the LLM for transaction extraction
4. Merge results: combine transaction arrays, deduplicate by date + amount + description
5. Validate: check that the running balance is consistent across pages
6. Present to user in the bank feed review queue or batch entry grid

### 5.4 Post-Processing

After extraction:

1. **Validate totals:** Sum of transactions should approximately equal ending_balance - beginning_balance
2. **Detect duplicates:** Check each extracted transaction against existing `bank_feed_items` (by date + amount + description fuzzy match)
3. **Flag issues:** Mark any transactions where the extraction seems uncertain (e.g., amount couldn't be parsed clearly)
4. **Pre-categorize:** Run each extracted transaction through the categorization pipeline (bank rules → history → AI)

---

## 6. AI Task: Document Classification

### 6.1 Purpose

When a user uploads a document (from the attachments library or receipt capture), automatically determine what type of document it is and route it to the correct processing pipeline.

### 6.2 Classification Prompt

```
System: Classify this document image into one of these categories:
- receipt (store receipt, restaurant receipt, online order receipt)
- invoice (vendor invoice or bill)
- bank_statement (bank or credit card statement)
- tax_form (W-2, 1099, tax return, etc.)
- contract (agreement, engagement letter)
- other (anything else)

Respond in JSON:
{
  "document_type": "string",
  "confidence": 0.0 to 1.0,
  "details": "brief description of what you see"
}
```

### 6.3 Routing

| Classification | Pipeline | Action |
|---|---|---|
| `receipt` | Receipt OCR (§4) | Extract vendor, amount, date → match or create expense |
| `invoice` | Invoice OCR | Extract vendor, amount, due date → create expense (or future bill) |
| `bank_statement` | Statement Parser (§5) | Extract transactions → load into bank feed |
| `tax_form` | None (store only) | Attach to tenant files, tag as "tax document" |
| `contract` | None (store only) | Attach, no processing |
| `other` | None (store only) | Attach, no processing |

---

## 7. API Endpoints

### 7.1 Admin — AI Configuration

```
GET    /api/v1/admin/ai/config              # Get AI configuration
PUT    /api/v1/admin/ai/config              # Update configuration (credentials, providers, settings)
POST   /api/v1/admin/ai/test/:provider      # Test a specific provider connection
GET    /api/v1/admin/ai/usage               # Usage statistics (calls, tokens, cost by provider/task/month)
GET    /api/v1/admin/ai/models/:provider    # List available models for a provider (Ollama: from /api/tags)
```

### 7.2 AI Processing

```
POST   /api/v1/ai/categorize               # Categorize a bank feed item (or batch of items)
POST   /api/v1/ai/ocr/receipt               # Process a receipt image
POST   /api/v1/ai/ocr/statement             # Process a bank statement PDF/image
POST   /api/v1/ai/ocr/invoice               # Process a vendor invoice image
POST   /api/v1/ai/classify                  # Classify an uploaded document
GET    /api/v1/ai/jobs                      # List AI processing jobs (filterable)
GET    /api/v1/ai/jobs/:id                  # Get job detail with input/output
POST   /api/v1/ai/jobs/:id/accept           # User accepts AI suggestion
POST   /api/v1/ai/jobs/:id/reject           # User rejects AI suggestion
POST   /api/v1/ai/jobs/:id/retry            # Retry a failed job
```

### 7.3 Prompt Templates (Admin)

```
GET    /api/v1/admin/ai/prompts             # List all prompt templates
GET    /api/v1/admin/ai/prompts/:id         # Get single template
PUT    /api/v1/admin/ai/prompts/:id         # Update template
POST   /api/v1/admin/ai/prompts/:id/test    # Test template with sample input
POST   /api/v1/admin/ai/prompts/:id/revert  # Revert to default template
```

---

## 8. Service Layer

### 8.1 AI Config Service

```
packages/api/src/services/ai-config.service.ts
```

- [ ] `getConfig()` — return configuration (decrypt credentials for internal use)
- [ ] `updateConfig(input)` — validate, encrypt credentials, save
- [ ] `isAiEnabled()` — master switch check
- [ ] `getProviderForTask(taskType)` — return configured provider + model for a task
- [ ] `testProvider(providerName)` — instantiate provider and call `testConnection()`
- [ ] `getAvailableModels(providerName)` — for Ollama: query `/api/tags`; for others: return known model list

### 8.2 AI Orchestrator Service

```
packages/api/src/services/ai-orchestrator.service.ts
```

Central service that routes AI tasks to the correct provider with fallback, logging, and cost tracking.

- [ ] `processTask(tenantId, task)`:
  1. Check AI is enabled
  2. Check monthly budget limit (if set)
  3. Get provider + model for task type
  4. Load prompt template for task type
  5. Build prompt with variable substitution
  6. Create `ai_jobs` row (status = 'processing')
  7. Call provider with fallback chain
  8. Parse response, validate against output schema
  9. Calculate confidence score
  10. Update `ai_jobs` row with results
  11. Log usage to `ai_usage_log`
  12. Return result

- [ ] `processBatch(tenantId, tasks)` — process multiple items concurrently (respecting `max_concurrent_jobs`)

- [ ] `recordUserAction(jobId, action, modifications?)`:
  - Update `ai_jobs` with user_accepted / user_modified
  - If categorization: update `categorization_history` for learning

### 8.3 Categorization Service

```
packages/api/src/services/ai-categorization.service.ts
```

- [ ] `categorize(tenantId, feedItem)`:
  1. Check bank rules (deterministic) — if match, return immediately
  2. Check categorization history (local lookup) — if strong match (confirmed 3+ times, overridden < 20%), return with high confidence
  3. Build categorization prompt with tenant's COA (active expense/revenue accounts only) and history context
  4. Call AI orchestrator
  5. Parse response: validate `account_name` exists in COA, resolve `contact_name` to existing contact or flag as new
  6. Return: `{ account_id, contact_id, memo, confidence, source: 'ai' }`

- [ ] `categorizeBatch(tenantId, feedItems)`:
  - Group items by similarity (same description pattern → one AI call with multiple examples)
  - Process groups in parallel
  - Return results array

- [ ] `updateLearning(tenantId, payeePattern, accountId, contactId, accepted)`:
  - Upsert `categorization_history`
  - This is called after every user accept/override

### 8.4 Receipt OCR Service

```
packages/api/src/services/ai-receipt-ocr.service.ts
```

- [ ] `processReceipt(tenantId, attachmentId)`:
  1. Load the attachment image
  2. If GLM-OCR configured: send to GLM-OCR for extraction
  3. If no GLM-OCR: send to vision-capable LLM (Anthropic/OpenAI/Gemini) with receipt extraction prompt
  4. Parse structured response (vendor, date, items, total, tax)
  5. Post-process: normalize vendor, validate amounts, check totals
  6. Match against existing transactions (amount + date proximity + vendor)
  7. Store results on the attachment record (ocr_vendor, ocr_date, ocr_total, ocr_tax)
  8. Return: extracted data + match candidates + confidence

- [ ] `matchReceiptToTransaction(tenantId, receiptData)`:
  - Query transactions where: amount within tolerance AND date within ±5 days AND (vendor matches OR no vendor filter)
  - Rank by match quality
  - Return top 5 candidates

### 8.5 Statement Parser Service

```
packages/api/src/services/ai-statement-parser.service.ts
```

- [ ] `parseStatement(tenantId, attachmentId)`:
  1. Load the PDF/image
  2. If PDF: split into pages
  3. For each page: send to GLM-OCR for document parsing (returns Markdown with tables)
  4. For each page's OCR output: send to LLM for transaction extraction
  5. Merge multi-page results
  6. Validate: running balances, total sum
  7. Deduplicate against existing bank feed items
  8. Return: `{ metadata, transactions[], issues[] }`

- [ ] `importParsedTransactions(tenantId, parsedData, accountId)`:
  - Create `bank_feed_items` from parsed transactions
  - Run categorization on each item
  - Return count imported + count duplicates skipped

### 8.6 Document Classifier Service

```
packages/api/src/services/ai-document-classifier.service.ts
```

- [ ] `classifyDocument(tenantId, attachmentId)`:
  1. Load the attachment image (first page if PDF)
  2. Send to LLM with classification prompt
  3. Return: `{ document_type, confidence, details }`

- [ ] `classifyAndRoute(tenantId, attachmentId)`:
  1. Classify the document
  2. Based on type, trigger the appropriate processing pipeline:
     - receipt → `receiptOcr.processReceipt()`
     - bank_statement → `statementParser.parseStatement()`
     - invoice → `receiptOcr.processReceipt()` (same pipeline, different prompt)
     - other → no processing, just store

### 8.7 Prompt Template Service

```
packages/api/src/services/ai-prompt.service.ts
```

- [ ] `getTemplate(taskType, provider?)` — get the active template, optionally provider-specific
- [ ] `renderPrompt(template, variables)` — substitute `{{variables}}` with actual values
- [ ] `updateTemplate(templateId, input)` — update system/user prompt text
- [ ] `revertToDefault(templateId)` — reset to the shipped default
- [ ] `testTemplate(templateId, sampleInput)` — run the template against sample data and return the AI response
- [ ] **Seed default templates** for all task types during setup

---

## 9. Frontend Components

### 9.1 Admin — AI Configuration Page

```
packages/web/src/features/admin/AiConfigPage.tsx
```

- [ ] **Master switch:** Enable/Disable AI processing

- [ ] **Provider credentials section:**
  - Anthropic: API key (password field + reveal toggle + test button)
  - OpenAI: API key (same pattern)
  - Google Gemini: API key (same pattern)
  - Ollama: Base URL (text field + test button that shows available models)
  - GLM-OCR Cloud: API key (same pattern)
  - GLM-OCR Local: Base URL (same as Ollama endpoint if using Ollama, or separate)
  - Each provider shows: "Connected ✓" / "Not configured" / "Error: [message]"

- [ ] **Task assignment section:**
  - For each task type (Categorization, OCR, Document Classification):
    - Provider dropdown (only configured providers shown)
    - Model dropdown (populated from provider's available models)
  - Fallback chain: drag-to-reorder list of providers

- [ ] **Processing settings:**
  - Auto-categorize on bank feed import (toggle)
  - Auto-OCR on document upload (toggle)
  - Confidence threshold slider (0%–100%, default 70%)
  - Max concurrent jobs (1–20)

- [ ] **Budget & usage:**
  - Monthly budget limit (currency input, blank = unlimited)
  - Current month usage: calls, tokens, estimated cost — broken out by provider
  - Historical usage chart (last 6 months)

- [ ] **Prompt templates section:**
  - Table: Task Type, Provider, Version, Status
  - Click → edit prompt template with:
    - System prompt (textarea)
    - User prompt template with `{{variable}}` highlighting
    - "Test" button → enter sample data → see AI response
    - "Revert to default" button
    - "Save" button

- [ ] Add "AI Processing" to Admin sidebar

### 9.2 User — AI Processing Status

Not a separate page — AI status is embedded in existing screens:

- [ ] **Bank feed page:**
  - Items with AI suggestions show: suggested account (with confidence badge), suggested vendor, "AI" source label
  - Confidence indicator: green (>80%), amber (50-80%), gray (<50%)
  - "Accept" button applies the AI suggestion
  - "Override" lets user change the suggestion (records in learning history)
  - Items currently being processed: spinner with "Categorizing..."

- [ ] **Receipt capture (updated):**
  - After upload: "Processing receipt..." spinner
  - When complete: pre-filled form with extracted data
  - Confidence indicators per field
  - "Matched to transaction: [EXP-0042 — $47.82 on 3/15]" if match found
  - "No match found — [Create Expense]" if no match

- [ ] **Bank statement import (new):**
  - Upload area in Bank Feed or Banking section: "Import bank statement (PDF or image)"
  - Processing status: page progress ("Processing page 3 of 8...")
  - Review screen: table of extracted transactions with:
    - Date, Description, Amount, Balance, Status (imported / duplicate / error)
    - Checkboxes to select which to import
    - "Import selected to bank feed" button
  - Duplicate highlights: "This transaction appears to already exist in your bank feed" with link to the existing item

- [ ] **Document upload (updated):**
  - When auto-classify is on: uploaded files show "Classifying..." → "[Receipt detected — processing OCR]" → results

### 9.3 AI Usage Dashboard Widget

- [ ] Small card on the admin dashboard:
  - "AI Processing: 342 tasks this month"
  - "Estimated cost: $2.47"
  - "Acceptance rate: 87%"
  - Link to full usage details

---

## 10. BullMQ Job Processors

### 10.1 Job Types

```
packages/worker/src/processors/ai/
├── categorize.processor.ts        # Transaction categorization
├── ocr-receipt.processor.ts       # Receipt OCR
├── ocr-statement.processor.ts     # Bank statement parsing
├── classify-document.processor.ts # Document classification
└── batch-categorize.processor.ts  # Batch categorization (multiple items)
```

- [ ] All processors:
  - Read from BullMQ queue
  - Respect `max_concurrent_jobs` setting
  - Implement retry with exponential backoff (3 retries)
  - Handle rate limits from cloud providers (429 → backoff)
  - Log failures with full error context
  - Update `ai_jobs` status throughout lifecycle

### 10.2 Auto-Trigger Integration

- [ ] **Bank feed import** (Plaid or CSV): after items are created, enqueue categorization jobs for each item (if `auto_categorize_on_import = TRUE`)
- [ ] **Attachment upload**: if `auto_ocr_on_upload = TRUE`, enqueue a classification job; if classified as receipt/statement, chain the OCR job
- [ ] **Manual trigger**: user can click "Categorize" on individual bank feed items or "Process" on attachments

---

## 11. Build Checklist

### 11.1 Database & Shared Types
- [x] Create migration: `ai_config` table
- [x] Create migration: `ai_jobs` table
- [x] Create migration: `ai_usage_log` table
- [x] Create migration: `ai_prompt_templates` table
- [x] Create migration: `categorization_history` table
- [x] Seed default prompt templates for all task types (auto-seeded on first config access)
- [x] Create `packages/shared/src/types/ai.ts` — all AI types, interfaces, enums
- [x] Create `packages/shared/src/schemas/ai.ts` — Zod schemas

### 11.2 Provider Abstraction
- [x] Create provider interface (`AiProvider`)
- [x] Install SDKs: `@anthropic-ai/sdk`, `openai`, `@google/genai`
- [x] Create Anthropic provider — complete, completeWithImage, testConnection, estimateCost
- [x] Create OpenAI provider — same interface
- [x] Create Gemini provider — same interface
- [x] Create Ollama provider — HTTP client, model listing, vision support detection
- [x] Create GLM-OCR provider — cloud mode (Z.AI API) and local mode (Ollama)
- [x] Create provider factory with credential decryption
- [x] Create fallback chain executor
- [x] Implement credential encryption/decryption (AES-256)
- [ ] Write Vitest tests:
  - [ ] Each provider constructs valid API requests (mocked)
  - [ ] Fallback chain tries next provider on failure
  - [ ] Cost estimation returns reasonable values
  - [ ] Ollama provider handles connection refused gracefully

### 11.3 AI Services
- [x] Create `ai-config.service.ts` — config management, provider resolution
- [x] Create `ai-orchestrator.service.ts` — task routing, logging, cost tracking, budget check
- [x] Create `ai-categorization.service.ts` — three-layer categorization (rules → history → AI)
- [x] Create `ai-receipt-ocr.service.ts` — receipt extraction, normalization, transaction matching
- [x] Create `ai-statement-parser.service.ts` — multi-page statement parsing, transaction extraction
- [x] Create `ai-document-classifier.service.ts` — classification and routing
- [x] Create `ai-prompt.service.ts` — template management, variable substitution, testing
- [x] Implement categorization learning loop (history upsert on accept/override)
- [x] Implement receipt-to-vendor matching
- [x] Implement statement deduplication on import
- [x] Implement budget limit enforcement

### 11.4 API Routes
- [x] Create `packages/api/src/routes/ai.routes.ts` — processing + admin endpoints (combined)
- [x] Admin config, test provider, usage, prompt CRUD
- [x] Integrate categorization triggers into bank feed import pipeline (CSV + OFX)
- [x] Integrate OCR triggers into attachment upload pipeline (auto-classify on image upload)

### 11.5 BullMQ Processors
- [x] Create categorization job processor
- [x] Create receipt OCR job processor
- [x] Create document classification job processor (combined in ai-ocr.processor.ts)
- [x] Batch categorization available via API endpoint
- [x] Implement retry with exponential backoff (retryWithBackoff utility with jitter)
- [x] Implement concurrency limiting (Semaphore in orchestrator, respects maxConcurrentJobs)
- [x] Implement rate limit handling (429 backoff with Retry-After header support)

### 11.6 API Tests
- [x] Write Vitest tests:
  - [x] Categorization: returns null when AI disabled (no AI call)
  - [x] Categorization: history match (3+ confirmations) returns without AI call
  - [ ] Categorization: AI call made when no rule or history match (requires live API key)
  - [ ] Categorization: response validates against COA
  - [x] Categorization: learning loop updates history on accept
  - [x] Categorization: learning loop updates history on override
  - [ ] Receipt OCR tests (require live API key)
  - [ ] Statement parser tests (require live API key)
  - [ ] Document classification tests (require live API key)
  - [x] Budget limit: job rejected when monthly budget exceeded
  - [x] Prompt templates: create, version, substitute variables
  - [x] Config: create default, update, encrypt API keys

### 11.7 Frontend — Admin
- [x] Create `AiConfigPage.tsx` — provider credentials, task assignment, settings
- [x] Implement provider test buttons with status indicators
- [x] Implement Ollama model listing (fetched from Ollama API)
- [x] Implement usage summary (by provider with call counts and cost)
- [x] Implement prompt template editor with create/edit/version
- [x] Add "AI Processing" to admin sidebar

### 11.8 Frontend — User Integration
- [x] Update bank feed page: AI suggestion display with confidence, accept/override actions, batch AI categorize button
- [x] Update receipt capture: processing spinner, pre-filled form from OCR, confidence badge
- [x] Create bank statement upload flow: file upload → AI parsing progress → review table → select/deselect → import
- [x] Auto-classify on image upload triggers document classification + OCR pipeline
- [x] Create `packages/web/src/api/hooks/useAi.ts` — React Query hooks

### 11.9 Ship Gate
- [ ] **Admin:** Configure Anthropic API key → test connection → success
- [ ] **Admin:** Configure OpenAI API key → test connection → success
- [ ] **Admin:** Configure Gemini API key → test connection → success
- [ ] **Admin:** Configure Ollama URL → test connection → shows available models
- [ ] **Admin:** Configure GLM-OCR (cloud) → test connection → success
- [ ] **Admin:** Assign categorization to Anthropic, OCR to GLM-OCR → tasks route correctly
- [ ] **Admin:** Fallback chain: primary fails → second provider used → result returned
- [ ] **Categorization:** Bank feed item with known payee (3+ history) → instant match, no AI call
- [ ] **Categorization:** Bank feed item with unknown payee → AI suggests account + vendor with confidence
- [ ] **Categorization:** User accepts suggestion → learning history updated
- [ ] **Categorization:** User overrides suggestion → learning history records override
- [ ] **Categorization:** Batch of 20 items → all categorized within 30 seconds
- [ ] **Receipt OCR:** Upload receipt photo → vendor, date, total, tax extracted → confidence shown
- [ ] **Receipt OCR:** Extracted receipt matches existing bank feed item → "Match found" shown
- [ ] **Receipt OCR:** No match → "Create Expense" creates correct transaction with receipt attached
- [ ] **Statement parsing:** Upload 4-page bank statement PDF → all transactions extracted → loaded into review table
- [ ] **Statement parsing:** Duplicate transactions detected and flagged → user can skip
- [ ] **Statement parsing:** Import selected rows → bank feed items created with pre-categorization
- [ ] **Document classification:** Upload receipt → classified as "receipt" → OCR triggered automatically
- [ ] **Document classification:** Upload bank statement → classified as "bank_statement" → parser triggered
- [ ] **Budget:** Monthly limit set to $5 → exceeded → jobs rejected with "AI budget exhausted" message
- [ ] **Usage:** Admin usage page shows correct call counts, tokens, and cost per provider
- [ ] **Prompt templates:** Edit categorization prompt → save → new prompt used on next categorization
- [ ] **Prompt templates:** Revert to default → original prompt restored
- [ ] **Ollama:** Categorization routed to local Ollama model → result returned (no cloud API call)
- [ ] All Vitest tests passing
- [ ] QUESTIONS.md reviewed and resolved
