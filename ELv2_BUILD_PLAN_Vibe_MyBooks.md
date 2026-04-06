# ELv2 Licensing Implementation — Vibe MyBooks

**Author:** Kisaes LLC  
**Product:** Vibe MyBooks  
**Target License:** Elastic License 2.0 (ELv2) + Commercial License for client-facing SaaS  
**Date:** April 2026

---

## Executive Summary

Launch Vibe MyBooks under Elastic License 2.0 (replacing the originally planned BSL 1.1). ELv2 provides permanent protection against service-offering competitors (no 4-year conversion timer) while keeping the software free for individuals, freelancers, and CPA firms to self-host for personal or internal bookkeeping. A supplemental Commercial License covers the specific case of firms providing client-facing portal access to a hosted instance.

---

## Phase 1 — License Text Preparation

### 1.1 Obtain and Customize ELv2 Base Text

- [ ] Download the canonical ELv2 text from Elastic's repository (it's freely reusable)
- [ ] Replace `Elastic` / `Elasticsearch` references with `Kisaes LLC` and `Vibe MyBooks`
- [ ] Verify the three core restrictions are intact:
  1. No providing the software as a hosted/managed service to third parties
  2. No circumventing license keys or functionality-limiting code
  3. No removing or obscuring license/attribution notices
- [ ] Have a lawyer review the customized text (recommended but not required — ELv2 is designed to be used as-is with name substitution)

### 1.2 Draft the Supplemental Commercial License

This covers the gray area ELv2 alone doesn't address: **firms giving clients direct login access to a firm-hosted instance.**

- [ ] Draft a plain-English Commercial License Agreement with these terms:
  - **Covered use:** Provisioning access to the Licensed Software to third-party end users (clients) as a standalone product, portal, or service — whether hosted by the licensee, a cloud provider, or any other infrastructure
  - **Explicitly excluded from requiring commercial license:**
    - Individual use for personal or business bookkeeping
    - Freelancer use for tracking income and expenses
    - Accounting firm use for internal operations (firm's own books, internal invoicing)
    - Accounting firm staff using the software to perform bookkeeping on behalf of clients (firm controls the instance, clients do not have direct access)
  - **License tiers** (define pricing later, but structure now):
    - Per-firm annual license (unlimited client entities)
    - Per-firm annual license (capped at N client entities)
    - Per-client-entity monthly license
  - **Grant includes:** right to modify, deploy, and sublicense access to clients within the scope of the commercial license
  - **Does not include:** right to redistribute the source code, white-label resale to other firms, or compete with Kisaes LLC as a SaaS vendor
- [ ] Create a `COMMERCIAL_LICENSE.md` template for distribution
- [ ] Create a `licensing@kisaes.com` (or equivalent) contact for commercial inquiries

### 1.3 Draft the License FAQ

- [ ] Create a `LICENSING_FAQ.md` covering the most common questions:
  - "Can I use this for free as a sole proprietor?" → Yes, completely free for personal or business bookkeeping
  - "Can I use this for free as a freelancer?" → Yes, no restrictions on individual use
  - "Can our accounting firm use this internally?" → Yes, free for your firm's own books and internal operations
  - "Can our staff use it to do bookkeeping for clients?" → Yes, as long as staff control the instance and clients don't have direct login access
  - "Can I give my clients their own login to see their books?" → That requires a commercial license
  - "Can I fork and modify it?" → Yes, as long as you keep the ELv2 license
  - "Can I fork and host it as a competing SaaS?" → No, that's the one thing ELv2 prohibits
  - "What happens if I violate the license?" → Standard copyright remedies apply
  - "Is this open source?" → It's source-available. The code is public and free to use under ELv2 terms, but ELv2 is not OSI-approved

### Ship Gate — Phase 1
- [ ] ELv2 license text finalized with "Vibe MyBooks" and "Kisaes LLC"
- [ ] Commercial License Agreement drafted
- [ ] Licensing FAQ written
- [ ] All three documents reviewed for internal consistency

---

## Phase 2 — Repository License Setup

### 2.1 Prepare the License Files

- [ ] Create `LICENSE` file containing the full ELv2 text with Kisaes LLC and "Vibe MyBooks" substituted
- [ ] Create `NOTICE` file with:
  - Copyright line: `Copyright 2026 Kisaes LLC`
  - Product name and description
  - Link to the commercial license inquiry page
  - Third-party attribution notices (list all dependencies with their licenses)
- [ ] Place `COMMERCIAL_LICENSE.md` in repo root
- [ ] Place `LICENSING_FAQ.md` in `docs/` directory

### 2.2 Update Source File Headers

- [ ] Create a standard header block:
  ```
  // Copyright 2026 Kisaes LLC
  // Licensed under the Elastic License 2.0 (ELv2); you may not use this file
  // except in compliance with the Elastic License 2.0.
  // See LICENSE file in the project root for full license text.
  ```
- [ ] Add the header to all existing source files (`.ts`, `.tsx`, `.js`, `.jsx`, `.py`, `.sql`, `.sh`)
- [ ] Script the header insertion for automation:
  - Create `scripts/add-license-header.sh` that prepends the header to files missing it
  - Add a CI check that fails if any source file is missing the header
- [ ] Remove any existing BSL 1.1 headers or references

### 2.3 Update Documentation

- [ ] Update `README.md`:
  - Set license badge to ELv2
  - Add a "License" section explaining: free for personal/internal use, commercial license required for client-facing access
  - Link to `LICENSING_FAQ.md`
  - Link to commercial inquiry contact
- [ ] Update `CLAUDE.md` license reference from `BSL 1.1 (Apache 2.0 conversion after 4 years)` to `Elastic License 2.0 (ELv2)`
- [ ] Update `BUILD_PLAN.md`:
  - Change all references from "BSL 1.1" to "ELv2"
  - Remove "Apache 2.0 conversion after 4 years" language
  - Update the file structure section: `LICENSE` comment from `# BSL 1.1` to `# Elastic License 2.0`
  - Update Phase 11.3 docs checklist: change "Add LICENSE file (BSL 1.1, Apache 2.0 conversion after 4 years)" to "Add LICENSE file (Elastic License 2.0)"
- [ ] Update any `CONTRIBUTING.md` to reference ELv2 contributor terms
- [ ] Search all markdown/text files for "BSL" or "Business Source License" and update

### 2.4 Update Package Metadata

- [ ] Update `package.json` → `"license": "Elastic-2.0"`
- [ ] Update `docker-compose.yml` labels if license is referenced there

### 2.5 Git History and Release

- [ ] If BSL code already exists on main:
  - Create a dedicated branch: `license/elv2-migration`
  - Make all license changes in a single commit: `license: migrate from BSL 1.1 to Elastic License 2.0`
  - Tag the last BSL 1.1 commit: `v{current}-bsl-final`
  - Merge to main
  - Tag the first ELv2 commit: `v{next}-elv2`
- [ ] If this is a fresh repo (no BSL code shipped yet):
  - Simply commit with ELv2 from the start: `license: add Elastic License 2.0`
  - No BSL tags needed
- [ ] Create a GitHub Release with license details in the release notes

### Ship Gate — Phase 2
- [ ] Vibe MyBooks repo has LICENSE (ELv2), NOTICE, COMMERCIAL_LICENSE.md, LICENSING_FAQ.md
- [ ] All source files have the ELv2 header
- [ ] No BSL 1.1 references remain anywhere in the codebase
- [ ] README, CLAUDE.md, and BUILD_PLAN.md all reflect ELv2
- [ ] Package metadata updated
- [ ] Clean git history with proper tags (if migrating from BSL)

---

## Phase 3 — Launch Communication

### 3.1 Announce the License

- [ ] Include license details in the Vibe MyBooks launch announcement:
  - Free for individuals, freelancers, and firms for internal use
  - Commercial license available for firms offering client-facing portal access
  - Source-available under ELv2
- [ ] Post on GitHub Discussions / Releases
- [ ] Include in any launch blog post or Product Hunt listing

### 3.2 Set Up Marketing Materials

- [ ] Add to the Kisaes LLC website:
  - License badge/description on Vibe MyBooks product page
  - "Source Available under ELv2" messaging
  - Comparison table: what's free vs what requires commercial license
- [ ] Update any pitch decks or one-pagers
- [ ] Update Docker Hub image description

### Ship Gate — Phase 3
- [ ] All external-facing materials reflect ELv2
- [ ] License is clearly communicated in all launch materials
- [ ] Free vs commercial boundary is unambiguous in public documentation

---

## Future Phases (Deferred)

- **License Key Infrastructure** — Signed JWT-based license keys, feature gating for client portal / client login functionality, soft/hard enforcement modes
- **Commercial License Operations** — Pricing tiers, Stripe checkout, automated key delivery, renewal reminders
- **CI/CD Enforcement** — Automated license header checks on PRs, dependency license auditing, NOTICE file automation

---

## Appendix A — ELv2 License Template (Vibe MyBooks)

```
Elastic License 2.0

URL: https://www.elastic.co/licensing/elastic-license

## Acceptance

By using the software, you agree to all of the terms and conditions below.

## Copyright License

The licensor grants you a non-exclusive, royalty-free, worldwide, non-sublicensable,
non-transferable license to use, copy, distribute, make available, and prepare
derivative works of the software, in each case subject to the limitations and
conditions below.

## Limitations

You may not provide the software to third parties as a hosted or managed service,
where the service provides users with access to any substantial set of the features
or functionality of the software.

You may not move, change, disable, or circumvent the license key functionality in
the software, and you may not remove or obscure any functionality in the software
that is protected by the license key.

You may not alter, remove, or obscure any licensing, copyright, or other notices of
the licensor in the software. Any use of the licensor's trademarks is subject to
applicable law.

## Patents

The licensor grants you a license, under any patent claims the licensor can license,
or becomes able to license, to make, have made, use, sell, offer for sale, import
and have imported the software, in each case subject to the limitations and
conditions in this license. This license does not cover any patent claims that you
cause to be infringed by modifications or additions to the software. If you or your
company make any written claim that the software infringes or contributes to
infringement of any patent, your patent license for the software granted under these
terms ends immediately. If your company makes such a claim, your patent license ends
immediately for work on behalf of your company.

## Notices

You must ensure that anyone who gets a copy of any part of the software from you
also gets a copy of these terms.

If you modify the software, you must include in any modified copies of the software
prominent notices stating that you have modified the software.

## No Other Rights

These terms do not imply any licenses other than those expressly granted in these
terms.

## Termination

If you use the software in violation of these terms, such use is not licensed, and
your licenses will automatically terminate. If the licensor provides you with a
notice of your violation, and you cease all violation of this license no later than
30 days after you receive that notice, your licenses will be reinstated
retroactively. However, if you violate these terms after such reinstatement, any
additional violation of these terms will cause your licenses to terminate
automatically and permanently.

## No Liability

As far as the law allows, the software comes as is, without any warranty or
condition, and the licensor will not be liable to you for any damages arising out of
these terms or the use or nature of the software, under any kind of legal claim.

## Definitions

The "licensor" is Kisaes LLC.

The "software" is the software the licensor makes available under these terms,
including Vibe MyBooks and all associated components.

"You" refers to the individual or entity agreeing to these terms.

"Your company" is any legal entity, sole proprietorship, or other kind of
organization that you work for, plus all organizations that have control over, are
under the control of, or are under common control with that organization. Control
means ownership of substantially all the assets of an entity, or the power to direct
the management and policies of an entity.
```

---

## Appendix B — Source File Header (Copy-Paste Ready)

**TypeScript / JavaScript:**
```
// Copyright 2026 Kisaes LLC
// Licensed under the Elastic License 2.0 (ELv2); you may not use this file
// except in compliance with the Elastic License 2.0.
// See LICENSE file in the project root for full license text.
```

**SQL / Shell:**
```
-- Copyright 2026 Kisaes LLC
-- Licensed under the Elastic License 2.0 (ELv2); you may not use this file
-- except in compliance with the Elastic License 2.0.
-- See LICENSE file in the project root for full license text.
```

**HTML / Markdown (comment):**
```
<!-- Copyright 2026 Kisaes LLC — Elastic License 2.0 -->
```

---

## Appendix C — Header Check Script

```bash
#!/bin/bash
# scripts/check-license-headers.sh
# Fails if any source file is missing the ELv2 license header.

HEADER_PATTERN="Licensed under the Elastic License 2.0"
EXTENSIONS=("ts" "tsx" "js" "jsx" "sql" "sh" "py")
EXCLUDE_DIRS=("node_modules" ".git" "dist" "build" ".next" "coverage")
MISSING=0

EXCLUDE_ARGS=""
for dir in "${EXCLUDE_DIRS[@]}"; do
  EXCLUDE_ARGS="$EXCLUDE_ARGS -not -path '*/$dir/*'"
done

for ext in "${EXTENSIONS[@]}"; do
  while IFS= read -r file; do
    if ! head -5 "$file" | grep -q "$HEADER_PATTERN"; then
      echo "MISSING HEADER: $file"
      MISSING=$((MISSING + 1))
    fi
  done < <(eval "find . -name '*.$ext' $EXCLUDE_ARGS -type f")
done

if [ $MISSING -gt 0 ]; then
  echo ""
  echo "ERROR: $MISSING file(s) missing ELv2 license header."
  echo "Run: bash scripts/add-license-header.sh"
  exit 1
fi

echo "All source files have license headers."
exit 0
```

---

## Appendix D — Decision Log

| Decision | Rationale |
|----------|-----------|
| ELv2 over BSL 1.1 | No 4-year conversion timer; permanent protection for the QBO-alternative positioning |
| ELv2 over AGPL | AGPL copyleft requirements deter enterprise/firm adoption; ELv2's restriction is narrower and better understood |
| Supplemental Commercial License | ELv2 alone doesn't clearly distinguish "firm does bookkeeping for clients" (free) from "firm gives clients a login" (paid) |
| Copyright year 2026 only | Vibe MyBooks is a new product; no need for range starting at 2025 |
