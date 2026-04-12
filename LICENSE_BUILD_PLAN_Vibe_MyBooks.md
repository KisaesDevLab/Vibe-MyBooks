# Licensing Implementation — Vibe MyBooks

**Author:** Kisaes LLC  
**Product:** Vibe MyBooks  
**Target License:** PolyForm Internal Use 1.0.0 + Supplemental Commercial License  
**Date:** April 2026

---

## Executive Summary

Migrate Vibe MyBooks from Elastic License 2.0 to the PolyForm Internal Use License 1.0.0. PolyForm Internal Use permits individuals and firms to use and modify the software for internal business operations while explicitly prohibiting distribution and any use beyond internal operations. There is no conversion timer — restrictions are permanent. A supplemental Commercial License covers the specific case of firms providing client-facing portal access to a hosted instance.

### Why PolyForm Internal Use Over ELv2

| Requirement | ELv2 (current) | PolyForm Internal Use |
|---|---|---|
| Free for individuals and firms (internal use) | Yes | Yes |
| Modify for own deployment | Yes | Yes |
| Block redistribution | No — explicitly grants "distribute, make available" | **Yes — "you may not distribute the software"** |
| Block hosted SaaS competitors | Yes (explicit clause) | Yes (covered by "internal business use only") |
| Block license key circumvention | Yes (explicit clause) | Covered via supplemental Commercial License |
| Recognized standard license | Yes | Yes (PolyForm Project, lawyer-drafted) |
| No time-bomb conversion | Yes (permanent) | Yes (permanent) |

---

## Phase 1 — License Text Preparation

### 1.1 Prepare the PolyForm Internal Use License

- [ ] Download the canonical PolyForm Internal Use 1.0.0 text from https://polyformproject.org/licenses/internal-use/1.0.0
- [ ] The license text is used as-is — no modifications to the standard text (PolyForm requires removing all PolyForm branding if you modify the text, so we use it verbatim)
- [ ] Add a preamble above the license text identifying the licensor:
  ```
  Licensor: Kisaes LLC
  Software: Vibe MyBooks
  License: PolyForm Internal Use License 1.0.0
  ```
- [ ] Have a lawyer review (recommended but not required — PolyForm is designed by licensing lawyers for direct use)

### 1.2 Draft the Supplemental Commercial License

This covers two things PolyForm Internal Use doesn't address directly: **client-facing access** and **license key protection**.

- [ ] Draft a plain-English Commercial License Agreement with these terms:
  - **Covered use:** Provisioning access to the Licensed Software to third-party end users (clients) as a standalone product, portal, or service — whether hosted by the licensee, a cloud provider, or any other infrastructure
  - **Explicitly excluded from requiring commercial license:**
    - Individual use for personal or business bookkeeping
    - Freelancer use for tracking income and expenses
    - Accounting firm use for internal operations (firm's own books, internal invoicing)
    - Accounting firm staff using the software to perform bookkeeping on behalf of clients (firm controls the instance, clients do not have direct access)
  - **License key clause:** Licensee shall not move, change, disable, or circumvent any license key functionality in the software, nor remove or obscure any functionality protected by a license key
  - **License tiers** (define pricing later, but structure now):
    - Per-firm annual license (unlimited client entities)
    - Per-firm annual license (capped at N client entities)
    - Per-client-entity monthly license
  - **Grant includes:** right to deploy and provide access to clients within the scope of the commercial license
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
  - "Can I modify the code for my firm's needs?" → Yes, for your own internal use
  - "Can I share my modified version with another firm?" → No, distribution is not permitted under the license
  - "Can I fork and host it as a competing SaaS?" → No, the license restricts use to internal business operations
  - "What happens if I violate the license?" → You have 32 days to cure after written notice; otherwise your license ends
  - "Is this open source?" → No. The source code is publicly viewable, but PolyForm Internal Use is not an OSI-approved open source license. It's a source-available license that permits internal use only.

### Ship Gate — Phase 1
- [ ] PolyForm Internal Use license text finalized with licensor preamble
- [ ] Commercial License Agreement drafted with license key protection clause
- [ ] Licensing FAQ written
- [ ] All three documents reviewed for internal consistency

---

## Phase 2 — Repository License Swap

### 2.1 Prepare the License Files

- [ ] Replace `LICENSE` file with the licensor preamble + full PolyForm Internal Use 1.0.0 text
- [ ] Update `NOTICE` file:
  - Copyright line: `Copyright 2026 Kisaes LLC`
  - Product name and description
  - Link to the commercial license inquiry page
  - Third-party attribution notices (list all dependencies with their licenses)
- [ ] Replace `COMMERCIAL_LICENSE.md` with updated version including license key clause
- [ ] Place `LICENSING_FAQ.md` in `docs/` directory

### 2.2 Update Source File Headers

- [ ] Create a standard header block:
  ```
  // Copyright 2026 Kisaes LLC
  // Licensed under the PolyForm Internal Use License 1.0.0.
  // You may not distribute this software. See LICENSE for terms.
  ```
- [ ] Replace the existing ELv2 headers in all source files (`.ts`, `.tsx`, `.js`, `.jsx`, `.py`, `.sql`, `.sh`)
- [ ] Update `scripts/add-license-header.sh` to use the new header text
- [ ] Update the CI header check to match the new pattern

### 2.3 Update Documentation

- [ ] Update `README.md`:
  - Change license badge from ELv2 to PolyForm Internal Use 1.0.0
  - Replace the License section:
    - Change "Elastic License 2.0 (ELv2)" → "PolyForm Internal Use License 1.0.0"
    - Change "You may self-host, modify, and redistribute under ELv2 terms" → "Free to use and modify for personal or internal business operations"
    - Add "Distribution is not permitted"
    - Keep "Commercial license required for client-facing portal access"
    - Keep link to COMMERCIAL_LICENSE.md
  - Remove any "open-source" language from the description
- [ ] Update `CLAUDE.md` license reference from ELv2 to PolyForm Internal Use 1.0.0
- [ ] Update `BUILD_PLAN.md`:
  - Change all references from "ELv2" / "Elastic License 2.0" to "PolyForm Internal Use 1.0.0"
  - Update the file structure section: `LICENSE` comment to `# PolyForm Internal Use 1.0.0`
  - Update Phase 11.3 docs checklist
- [ ] Update any `CONTRIBUTING.md` to reference PolyForm Internal Use contributor terms
- [ ] Search all markdown/text files for "ELv2", "Elastic License", "BSL", "Business Source License", "redistribute", "open-source" and update

### 2.4 Update Package Metadata

- [ ] Update `package.json` → `"license": "SEE LICENSE IN LICENSE"` (PolyForm Internal Use is not an SPDX identifier)
- [ ] Update `docker-compose.yml` labels if license is referenced there

### 2.5 Git History and Release

- [ ] Create a dedicated branch: `license/polyform-migration`
- [ ] Make all license changes in a single commit: `license: migrate from ELv2 to PolyForm Internal Use 1.0.0`
- [ ] Tag the last ELv2 commit: `v{current}-elv2-final`
- [ ] Merge to main
- [ ] Tag the first PolyForm commit: `v{next}-polyform`
- [ ] Create a GitHub Release with release notes explaining the license change

### Ship Gate — Phase 2
- [ ] Vibe MyBooks repo has LICENSE (PolyForm Internal Use), NOTICE, COMMERCIAL_LICENSE.md, LICENSING_FAQ.md
- [ ] All source files have the PolyForm header
- [ ] No ELv2, BSL 1.1, or "open-source" references remain anywhere in the codebase
- [ ] No "redistribute" language in any documentation
- [ ] README, CLAUDE.md, and BUILD_PLAN.md all reflect PolyForm Internal Use
- [ ] Package metadata updated
- [ ] Clean git history with proper tags

---

## Phase 3 — Communication

### 3.1 Announce the License Change

- [ ] Include license details in release notes:
  - What changed: ELv2 → PolyForm Internal Use 1.0.0
  - What stays the same: free for individuals, freelancers, and firms for internal use
  - What's tighter: distribution is now explicitly prohibited (it was permitted under ELv2)
  - What to do: nothing — existing deployments are unaffected
- [ ] Post on GitHub Discussions / Releases

### 3.2 Update Marketing Materials

- [ ] Update the Kisaes LLC website:
  - License badge/description on Vibe MyBooks product page
  - "Source Available — PolyForm Internal Use" messaging
  - Remove any "Elastic License" or "redistribute" language
  - Comparison table: what's free vs what requires commercial license
- [ ] Update any pitch decks or one-pagers
- [ ] Update Docker Hub image description

### Ship Gate — Phase 3
- [ ] All external-facing materials reflect PolyForm Internal Use
- [ ] License change communicated in release notes
- [ ] Free vs commercial boundary is unambiguous in public documentation
- [ ] No ELv2 or "redistribute" references remain in any public material

---

## Future Phases (Deferred)

- **License Key Infrastructure** — Signed JWT-based license keys, feature gating for client portal / client login functionality, soft/hard enforcement modes
- **Commercial License Operations** — Pricing tiers, Stripe checkout, automated key delivery, renewal reminders
- **CI/CD Enforcement** — Automated license header checks on PRs, dependency license auditing, NOTICE file automation

---

## Appendix A — PolyForm Internal Use License 1.0.0 (Full Text)

```
Licensor:  Kisaes LLC
Software:  Vibe MyBooks
License:   PolyForm Internal Use License 1.0.0
           https://polyformproject.org/licenses/internal-use/1.0.0


PolyForm Internal Use License 1.0.0

https://polyformproject.org/licenses/internal-use/1.0.0

Acceptance

In order to get any license under these terms, you must agree to them
as both strict obligations and conditions to all your licenses.

Copyright License

The licensor grants you a copyright license for the software to do
everything you might do with the software that would otherwise infringe
the licensor's copyright in it for any permitted purpose. However, you
may only make changes or new works based on the software according to
Changes and New Works License, and you may not distribute the software.

Changes and New Works License

The licensor grants you an additional copyright license to make changes
and new works based on the software for any permitted purpose.

Patent License

The licensor grants you a patent license for the software that covers
patent claims the licensor can license, or becomes able to license,
that you would infringe by using the software.

Fair Use

You may have "fair use" rights for the software under the law. These
terms do not limit them.

Internal Business Use

Use of the software for the internal business operations of you and
your company is use for a permitted purpose.

No Other Rights

These terms do not allow you to sublicense or transfer any of your
licenses to anyone else, or prevent the licensor from granting licenses
to anyone else. These terms do not imply any other licenses.

Patent Defense

If you make any written claim that the software infringes or
contributes to infringement of any patent, your patent license for the
software granted under these terms ends immediately. If your company
makes such a claim, your patent license ends immediately for work on
behalf of your company.

Violations

The first time you are notified in writing that you have violated any
of these terms, or done anything with the software not covered by your
licenses, your licenses can nonetheless continue if you come into full
compliance with these terms, and take practical steps to correct past
violations, within 32 days of receiving notice. Otherwise, all your
licenses end immediately.

No Liability

As far as the law allows, the software comes as is, without any
warranty or condition, and the licensor will not be liable to you for
any damages arising out of these terms or the use or nature of the
software, under any kind of legal claim.

Definitions

The licensor is the individual or entity offering these terms, and the
software is the software the licensor makes available under these
terms.

You refers to the individual or entity agreeing to these terms.

Your company is any legal entity, sole proprietorship, or other kind of
organization that you work for, plus all organizations that have
control over, are under the control of, or are under common control
with that organization. Control means ownership of substantially all
the assets of an entity, or the power to direct its management and
policies by vote, contract, or otherwise. Control can be direct or
indirect.

Your licenses are all the licenses granted to you for the software
under these terms.

Use means anything you do with the software requiring one of your
licenses.
```

---

## Appendix B — Source File Header (Copy-Paste Ready)

**TypeScript / JavaScript:**
```
// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.
```

**SQL / Shell:**
```
-- Copyright 2026 Kisaes LLC
-- Licensed under the PolyForm Internal Use License 1.0.0.
-- You may not distribute this software. See LICENSE for terms.
```

**HTML / Markdown (comment):**
```
<!-- Copyright 2026 Kisaes LLC — PolyForm Internal Use 1.0.0 -->
```

---

## Appendix C — Header Check Script

```bash
#!/bin/bash
# scripts/check-license-headers.sh
# Fails if any source file is missing the PolyForm license header.

HEADER_PATTERN="Licensed under the PolyForm Internal Use License"
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
  echo "ERROR: $MISSING file(s) missing PolyForm license header."
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
| PolyForm Internal Use over ELv2 | ELv2 explicitly grants redistribution ("distribute, make available") which is not desired. PolyForm explicitly blocks it. |
| PolyForm Internal Use over modified ELv2 | Modifying ELv2 to remove redistribution creates a non-standard license that can't be called ELv2. PolyForm says what we need out of the box. |
| License key protection in Commercial License | PolyForm doesn't mention license keys. The anti-circumvention clause moves to the Commercial License Agreement (only relevant to paying licensees). |
| Unmodified PolyForm text | PolyForm requires removing all PolyForm branding if the text is modified. Using it verbatim avoids this and maintains standard recognition. |
| Licensor preamble above license text | PolyForm's definitions section says "the licensor is the individual or entity offering these terms" — the preamble makes it explicit that this is Kisaes LLC. |
| ELv2 → PolyForm migration tags | Clean git history: tag the last ELv2 commit and the first PolyForm commit so the licensing boundary is auditable. |
| Copyright year 2026 only | Vibe MyBooks is a new product launched in 2026; no prior year needed. |
