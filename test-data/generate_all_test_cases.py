import os
from openpyxl import Workbook

output_dir = r"C:\projects\vendor_reconcile\test-data\scenarios"
os.makedirs(output_dir, exist_ok=True)

# Helper function to generate statement workbook
def create_statement(filename, title, rows):
    wb = Workbook()
    ws = wb.active
    ws.title = "Statement"
    ws.append([title])
    ws.append([]) # Blank row
    ws.append(['VendorCode', 'VendorInvoiceNo', 'InvoiceDate', 'InvoiceAmount', 'Currency', 'PoReference', 'GstTdsAmount', 'PaymentReference', 'Gstin', 'Irn', 'IrnStatus', 'EwayBill', 'Gstr2bStatus'])
    for r in rows:
        ws.append(r)
    path = os.path.join(output_dir, filename)
    wb.save(path)
    print(f"Generated {filename}")

# TC001: Standard Match (Vendor V-1002)
create_statement(
    "TC001_Standard_Match_Statement.xlsx",
    "Vendor Statement · April 2026 · Delta Forge (V-1002) - TC001 Standard Match",
    [
        ['V-1002', 'INV-22475', '2026-04-16', 89208, 'INR', '4501220051', 9558, 'PAY005', '24AADCD4521F1Z3', 'IRN-773121X88', 'Generated', 'EWB-202604169', '2B Matched']
    ]
)

# TC002: Invoice Qty Less than GR (Vendor V-1004)
create_statement(
    "TC002_Qty_Less_Statement.xlsx",
    "Vendor Statement · April 2026 · Orion Castings (V-1004) - TC002 Qty Less",
    [
        ['V-1004', 'INV-22490', '2026-04-20', 339250, 'INR', '4501220062', 51750, 'PAY006', '27AAHFO2314M1Z2', 'IRN-990123A88', 'Generated', 'EWB-202604201', '2B Matched']
    ]
)

# TC003: Invoice Qty More than GR (Vendor V-1001)
create_statement(
    "TC003_Qty_More_Statement.xlsx",
    "Vendor Statement · April 2026 · Sigma Components (V-1001) - TC003 Qty More",
    [
        ['V-1001', 'INV-22418', '2026-04-02', 1469100, 'INR', '4501220001', 224100, 'PAY001', '27AAACS1210B1Z5', 'IRN-998218A98', 'Generated', 'EWB-202604021', '2B Matched']
    ]
)

# TC004: Invoice Price Higher than PO (Vendor V-1001)
create_statement(
    "TC004_Price_High_Statement.xlsx",
    "Vendor Statement · April 2026 · Sigma Components (V-1001) - TC004 Price High",
    [
        ['V-1001', 'INV-22440', '2026-04-09', 386656.50, 'INR', '4501220040', 58981.50, None, '27AAACS1210B1Z5', 'IRN-881275C22', 'Generated', 'EWB-202604092', '2B Matched']
    ]
)

# TC005: Missing GR reference / GR Pending (Vendor V-1001)
create_statement(
    "TC005_Missing_GR_Statement.xlsx",
    "Vendor Statement · April 2026 · Sigma Components (V-1001) - TC005 Missing GR",
    [
        ['V-1001', 'INV-22461', '2026-04-14', 247800, 'INR', '4501220033', 37800, None, '27AAACS1210B1Z5', 'IRN-449108E11', 'Generated', 'EWB-202604143', '2B Matched']
    ]
)

# TC006: GST 2B Gap (Vendor V-1002)
create_statement(
    "TC006_GST_2B_Gap_Statement.xlsx",
    "Vendor Statement · April 2026 · Delta Forge (V-1002) - TC006 GST 2B Gap",
    [
        ['V-1002', 'INV-22482', '2026-04-18', 9912, 'INR', '4501220051', 1062, None, '24AADCD4521F1Z3', '', 'NOT generated', '', '2B Gap']
    ]
)

# TC007: TDS Section 194Q (Vendor V-1001)
create_statement(
    "TC007_TDS_194Q_Statement.xlsx",
    "Vendor Statement · April 2026 · Sigma Components (V-1001) - TC007 TDS 194Q",
    [
        ['V-1001', 'INV-22418', '2026-04-02', 1469100, 'INR', '4501220001', 224100, 'PAY001', '27AAACS1210B1Z5', 'IRN-998218A98', 'Generated', 'EWB-202604021', '2B Matched'],
        ['V-1001', 'TDS deducted', '2026-04-25', -1469, 'INR', None, 0, None, '27AAACS1210B1Z5', '', '', '', '']
    ]
)

# TC008: Payment in Transit (Vendor V-1001)
create_statement(
    "TC008_Payment_in_Transit_Statement.xlsx",
    "Vendor Statement · April 2026 · Sigma Components (V-1001) - TC008 Payment Transit",
    [
        ['V-1001', 'Payment UTR-88214', '2026-04-25', -1000000, 'INR', None, 0, 'UTR-88214', '27AAACS1210B1Z5', '', '', '', '']
    ]
)

# TC009: Credit Note Missing (Vendor V-1001)
create_statement(
    "TC009_Credit_Note_Missing_Statement.xlsx",
    "Vendor Statement · April 2026 · Sigma Components (V-1001) - TC009 Credit Note Missing",
    [
        ['V-1001', 'CN-0091', '2026-04-11', -14160, 'INR', '4501220040', -2160, None, '27AAACS1210B1Z5', 'IRN-CN77123A', 'Generated', '', '2B Matched']
    ]
)

# TC010: FX Revaluation (Vendor V-1005)
create_statement(
    "TC010_FX_Revaluation_Statement.xlsx",
    "Vendor Statement · April 2026 · Helix Precision (V-1005) - TC010 FX Revaluation",
    [
        ['V-1005', 'HX-2026-07', '2026-04-12', 17000, 'USD', '4501220075', 0, 'PAY007', '—', '—', '—', '—', '']
    ]
)

print("\nAll individual statement scenario workbooks generated successfully inside test-data/scenarios/")
