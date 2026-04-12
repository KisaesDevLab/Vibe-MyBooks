"""Generate packages/shared/src/constants/coa-templates.ts from BusinessCategoryList.xlsx.

The xlsx is the source of truth for per-business-type COAs. This script:
- Reads each row of the spreadsheet
- Maps Asset/Liability/Equity/Revenue/Expenses → asset/liability/equity/revenue/expense
- Picks a sensible detailType per (accountType, accountNumber, name)
- Tags system accounts (cash_on_hand, accounts_receivable, accounts_payable, retained_earnings)
- Injects required system accounts the spreadsheet does NOT contain:
    10150 Payments Clearing  (asset / other_current_asset / payments_clearing)
    20900 Sales Tax Payable  (liability / other_current_liability / sales_tax_payable)
    30000 Opening Balances   (equity / opening_balance / opening_balances)
- Preserves the existing `general_business` template (not in xlsx) as a sane fallback
- Emits the TypeScript file with BUSINESS_TYPE_OPTIONS, BUSINESS_TEMPLATES, COA_TEMPLATES,
  and the legacy DEFAULT_/SERVICE_/RETAIL_/FREELANCER_TEMPLATE aliases.
"""

import openpyxl
import re
import json
from pathlib import Path

ROOT = Path(r"C:\Users\kwkcp\Projects\myBooks")
XLSX = ROOT / "BusinessCategoryList.xlsx"
OUT = ROOT / "packages" / "shared" / "src" / "constants" / "coa-templates.ts"

TYPE_MAP = {
    "Asset": "asset",
    "Liability": "liability",
    "Equity": "equity",
    "Revenue": "revenue",
    "Expenses": "expense",
}


def slug(label: str) -> str:
    s = label.lower()
    s = re.sub(r"[^a-z0-9]+", "_", s)
    return s.strip("_")


def detail_type(account_type: str, num: int, name: str) -> str:
    n = name.lower()
    if account_type == "asset":
        if num == 10100 or "cash" in n and num < 10200:
            return "bank"
        if num == 10200 or "receivable" in n:
            return "accounts_receivable"
        if num in (10500, 10510, 10600, 70110):
            return "fixed_asset"
        if "fixed asset" in n or "depreciation" in n or "vehicle" in n or "asset purchase" in n:
            return "fixed_asset"
        return "other_current_asset"
    if account_type == "liability":
        if num == 20100 or "accounts payable" in n:
            return "accounts_payable"
        if num == 20200 or "credit card" in n:
            return "credit_card"
        if num in (20500, 20600, 20700) or "loan" in n or "line of credit" in n or "notes payable" in n or "mortgage" in n:
            return "long_term_liability"
        return "other_current_liability"
    if account_type == "equity":
        if num == 30120 or "retained earnings" in n:
            return "retained_earnings"
        if "opening balance" in n:
            return "opening_balance"
        return "owners_equity"
    if account_type == "revenue":
        if "interest" in n:
            return "interest_earned"
        if num >= 49000 or "other" in n or "gain" in n or "non-includible" in n:
            return "other_income"
        return "service"
    if account_type == "expense":
        return "other_expense"
    return "other_expense"


def system_tag_for(num: int, name: str, account_type: str) -> str | None:
    n = name.lower().strip()
    if account_type == "asset":
        if num == 10100 or n == "cash":
            return "cash_on_hand"
        if num == 10200 or n == "accounts receivable":
            return "accounts_receivable"
    if account_type == "liability":
        if num == 20100 or n == "accounts payable":
            return "accounts_payable"
    if account_type == "equity":
        if num == 30120 or n == "retained earnings":
            return "retained_earnings"
    return None


# Required system accounts injected into every business template.
# These are not in the xlsx but the application code looks them up by systemTag.
INJECTED_SYSTEM_ACCOUNTS = [
    {
        "accountNumber": "10150",
        "name": "Payments Clearing",
        "accountType": "asset",
        "detailType": "other_current_asset",
        "isSystem": True,
        "systemTag": "payments_clearing",
    },
    {
        "accountNumber": "20900",
        "name": "Sales Tax Payable",
        "accountType": "liability",
        "detailType": "other_current_liability",
        "isSystem": True,
        "systemTag": "sales_tax_payable",
    },
    {
        "accountNumber": "30000",
        "name": "Opening Balances",
        "accountType": "equity",
        "detailType": "opening_balance",
        "isSystem": True,
        "systemTag": "opening_balances",
    },
]


# `general_business` is not in the xlsx — preserve a sensible fallback that
# already worked. We rebuild it from a simplified universal set so it stays
# in sync with the new shape.
GENERAL_BUSINESS_LABEL = "General Business"


def build_general_business():
    """Generic fallback COA — used when no business type is selected."""
    rows = [
        # Assets
        (10100, "Cash"),
        (10200, "Accounts Receivable"),
        (10300, "Prepaid Expenses"),
        (10400, "Other Current Assets"),
        (10500, "Fixed Assets"),
        (10510, "Accumulated Depreciation"),
        (10600, "Vehicles"),
        (10700, "Inventory"),
        # Liabilities
        (20100, "Accounts Payable"),
        (20200, "Credit Cards Payable"),
        (20300, "Accrued Liabilities"),
        (20400, "Payroll Liabilities"),
        (20500, "Loans Payable"),
        (20600, "Line of Credit"),
        (20700, "Notes Payable"),
        # Equity
        (30100, "Equity"),
        (30110, "Owner's Capital"),
        (30120, "Retained Earnings"),
        (30130, "Current Year Earnings"),
        (30160, "Owner Contribution"),
        (30170, "Owner Withdraw"),
        # Revenue
        (40100, "Sales Revenue"),
        (40200, "Service Revenue"),
        (48100, "Interest Income"),
        (49000, "Other Revenues"),
        # Expenses
        (50100, "Cost of Goods Sold"),
        (50200, "Materials & Supplies"),
        (60100, "Advertising"),
        (60200, "Bad Debt"),
        (60300, "Bank Charges & Fees"),
        (60500, "Contractors"),
        (60700, "Donations"),
        (60900, "Employee Benefits"),
        (61400, "Insurance"),
        (61600, "Office"),
        (61620, "Office Supplies"),
        (61770, "Employee Wages and Taxes"),
        (61800, "Professional Services"),
        (61810, "Accounting"),
        (61820, "Legal Fees"),
        (61840, "Tax Preparation"),
        (61900, "Rent or Lease"),
        (62500, "Travel"),
        (62600, "Utilities"),
        (62610, "Communications/Telephone/Internet"),
        # Other
        (70110, "Asset Purchase"),
        (80110, "Gain Loss on Sale"),
        (89999, "Uncategorized"),
    ]
    accounts = []
    for num, name in rows:
        if num == 70110:
            # Asset Purchase is an asset, even though it lives in the 7xxxx range
            account_type = "asset"
        elif num == 80110:
            # Gain Loss on Sale is treated as revenue (other_income)
            account_type = "revenue"
        elif num < 20000:
            account_type = "asset"
        elif num < 30000:
            account_type = "liability"
        elif num < 40000:
            account_type = "equity"
        elif num < 50000:
            account_type = "revenue"
        else:
            account_type = "expense"
        accounts.append({
            "accountNumber": str(num),
            "name": name,
            "accountType": account_type,
            "detailType": detail_type(account_type, num, name),
            "isSystem": system_tag_for(num, name, account_type) is not None,
            "systemTag": system_tag_for(num, name, account_type),
        })
    return accounts


def build_template_from_xlsx_rows(rows):
    """Convert raw xlsx rows for one business type into a list of CoaTemplateAccount dicts."""
    accounts = []
    for num, name in rows:
        account_type = None  # set below
        # use category type from xlsx via outer loop
    return accounts


def main():
    wb = openpyxl.load_workbook(XLSX, data_only=True)
    ws = wb["Business Category List"]

    # Group rows by business type
    by_biz: dict[str, list] = {}
    for row in ws.iter_rows(min_row=2, values_only=True):
        biz, num, name, sub, ctype, dr = row
        if not biz or not num or not name or not ctype:
            continue
        by_biz.setdefault(biz, []).append((int(num), str(name), ctype))

    # Build slug → label map (sorted)
    biz_labels = sorted(by_biz.keys())
    # Normalize the consulting label to match existing slug (it has a double space in the xlsx)
    label_to_slug = {label: slug(label) for label in biz_labels}

    # Verify there are no slug collisions
    slugs_seen = set()
    for label, s in label_to_slug.items():
        if s in slugs_seen:
            raise SystemExit(f"slug collision: {s} for {label}")
        slugs_seen.add(s)

    templates: dict[str, list] = {}

    # general_business comes first (not in xlsx)
    gb = build_general_business()
    gb_nums = {a["accountNumber"] for a in gb}
    for sa in INJECTED_SYSTEM_ACCOUNTS:
        if sa["accountNumber"] not in gb_nums:
            gb.append(sa.copy())
    gb.sort(key=lambda a: a["accountNumber"])
    templates["general_business"] = gb

    for label in biz_labels:
        accounts = []
        for num, name, ctype in sorted(by_biz[label], key=lambda x: x[0]):
            account_type = TYPE_MAP.get(ctype)
            if not account_type:
                continue
            tag = system_tag_for(num, name, account_type)
            accounts.append({
                "accountNumber": str(num),
                "name": name,
                "accountType": account_type,
                "detailType": detail_type(account_type, num, name),
                "isSystem": tag is not None,
                "systemTag": tag,
            })
        # Inject required system accounts (dedupe by accountNumber)
        existing_nums = {a["accountNumber"] for a in accounts}
        for sa in INJECTED_SYSTEM_ACCOUNTS:
            if sa["accountNumber"] not in existing_nums:
                accounts.append(sa.copy())
        # Sort by account number
        accounts.sort(key=lambda a: a["accountNumber"])
        templates[label_to_slug[label]] = accounts

    # Build BUSINESS_TYPE_OPTIONS — general_business + xlsx labels in alphabetical label order
    options = [{"value": "general_business", "label": GENERAL_BUSINESS_LABEL}]
    for label in biz_labels:
        options.append({"value": label_to_slug[label], "label": label})

    # Render TypeScript
    out_lines = []
    out_lines.append("import type { AccountType } from '../types/accounts.js';")
    out_lines.append("")
    out_lines.append("export interface CoaTemplateAccount {")
    out_lines.append("  accountNumber: string;")
    out_lines.append("  name: string;")
    out_lines.append("  accountType: AccountType;")
    out_lines.append("  detailType: string;")
    out_lines.append("  isSystem: boolean;")
    out_lines.append("  systemTag: string | null;")
    out_lines.append("}")
    out_lines.append("")
    out_lines.append("export const BUSINESS_TYPE_OPTIONS = [")
    for opt in options:
        out_lines.append("  {")
        out_lines.append(f"    \"value\": {json.dumps(opt['value'])},")
        out_lines.append(f"    \"label\": {json.dumps(opt['label'])}")
        out_lines.append("  },")
    # Drop trailing comma on last item — but TS allows trailing commas; leave them.
    out_lines.append("] as const;")
    out_lines.append("")
    out_lines.append("export const BUSINESS_TEMPLATES: Record<string, CoaTemplateAccount[]> = {")

    # Emit general_business first, then the rest in label order
    slug_order = ["general_business"] + [label_to_slug[l] for l in biz_labels]
    for sl in slug_order:
        out_lines.append(f"  {sl}: [")
        for a in templates[sl]:
            tag = "null" if a["systemTag"] is None else json.dumps(a["systemTag"])
            is_sys = "true" if a["isSystem"] else "false"
            out_lines.append(
                f"    {{ accountNumber: {json.dumps(a['accountNumber'])}, "
                f"name: {json.dumps(a['name'])}, "
                f"accountType: {json.dumps(a['accountType'])}, "
                f"detailType: {json.dumps(a['detailType'])}, "
                f"isSystem: {is_sys}, "
                f"systemTag: {tag} }},"
            )
        out_lines.append("  ],")
    out_lines.append("};")
    out_lines.append("")
    out_lines.append("// Backward compatibility aliases")
    out_lines.append("export const DEFAULT_TEMPLATE = BUSINESS_TEMPLATES['general_business']!;")
    out_lines.append("export const SERVICE_TEMPLATE = BUSINESS_TEMPLATES['consulting_and_design_services']!;")
    out_lines.append("export const RETAIL_TEMPLATE = BUSINESS_TEMPLATES['retail_and_wholesale_product_sales']!;")
    out_lines.append("export const FREELANCER_TEMPLATE = BUSINESS_TEMPLATES['graphic_design_and_desktop_publishing']!;")
    out_lines.append("")
    out_lines.append("// COA_TEMPLATES map — used by seedFromTemplate")
    out_lines.append("export const COA_TEMPLATES: Record<string, CoaTemplateAccount[]> = {")
    out_lines.append("  default: DEFAULT_TEMPLATE,")
    out_lines.append("  service: SERVICE_TEMPLATE,")
    out_lines.append("  retail: RETAIL_TEMPLATE,")
    out_lines.append("  freelancer: FREELANCER_TEMPLATE,")
    out_lines.append("  ...BUSINESS_TEMPLATES,")
    out_lines.append("};")
    out_lines.append("")

    OUT.write_text("\n".join(out_lines), encoding="utf-8")
    print(f"Wrote {OUT}")
    print(f"  business types: {len(slug_order)}")
    total = sum(len(templates[s]) for s in slug_order)
    print(f"  total accounts: {total}")


if __name__ == "__main__":
    main()
