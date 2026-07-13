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

# Helper function to generate ledger workbook
def create_ledger(filename, vendors, pos, grs, ledgers):
    wb = Workbook()
    
    # 1. VendorMaster
    ws_vm = wb.active
    ws_vm.title = "VendorMaster"
    ws_vm.append(['BusinessPartner', 'BusinessPartnerName', 'TaxNumber1', 'PaymentTerms', 'Currency', 'Pan', 'State', 'TdsSection', 'IsMsme'])
    for v in vendors:
        ws_vm.append(v)
        
    # 2. PurchaseOrders
    ws_po = wb.create_sheet(title="PurchaseOrders")
    ws_po.append(['PurchaseOrder', 'PurchaseOrderItem', 'PoQty', 'PoAmount', 'Supplier'])
    for p in pos:
        ws_po.append(p)
        
    # 3. GrirSnapshot
    ws_gr = wb.create_sheet(title="GrirSnapshot")
    ws_gr.append(['PurchaseOrder', 'PurchaseOrderItem', 'GoodsReceiptQty', 'InvoicedQuantity', 'GrirAmount', 'Plant', 'Supplier'])
    for g in grs:
        ws_gr.append(g)
        
    # 4. VendorLedgerItems
    ws_vl = wb.create_sheet(title="VendorLedgerItems")
    ws_vl.append(['Supplier', 'CompanyCode', 'AccountingDocument', 'DocumentDate', 'PostingDate', 'AmountInTransCrcy', 'TransactionCurrency', 'ClearingDocument', 'TaxAmount'])
    for l in ledgers:
        ws_vl.append(l)
        
    path = os.path.join(output_dir, filename)
    wb.save(path)
    print(f"Generated {filename}")

# ==========================================
# TC001: Standard Match (Vendor V-1002)
# ==========================================
create_ledger(
    "SAP_Ledger_Mock_TC001_Standard_Match.xlsx",
    [['V-1002', 'Delta Forge Industries', '24AADCD4521F1Z3', 'NT30', 'INR', 'AADCD4521F', 'Gujarat', '194Q', 'No']],
    [['4501220051', '10', 1000, 88500, 'V-1002']],
    [['4501220051', '10', 1000, 1000, 88500, '1000', 'V-1002']],
    [['V-1002', '1000', 'INV-22475', '2026-04-16', '2026-04-16', 89208, 'INR', 'PAY005', 9558]]
)
create_statement(
    "Vendor_Statement_Mock_TC001_Standard_Match.xlsx",
    "Vendor Statement · April 2026 · Delta Forge (V-1002) - TC001 Standard Match",
    [
        ['V-1002', 'INV-22475', '2026-04-16', 89208, 'INR', '4501220051', 9558, 'PAY005', '24AADCD4521F1Z3', 'IRN-773121X88', 'Generated', 'EWB-202604169', '2B Matched']
    ]
)

# ==========================================
# TC002: Invoice Qty Less than GR (Vendor V-1004)
# ==========================================
create_ledger(
    "SAP_Ledger_Mock_TC002_Qty_Less.xlsx",
    [['V-1004', 'Orion Castings LLP', '27AAHFO2314M1Z2', 'NT45', 'INR', 'AAHFO2314M', 'Maharashtra', '194C', 'No']],
    [['4501220062', '10', 300, 287500, 'V-1004']],
    [['4501220062', '10', 300, 280, 287500, '1000', 'V-1004']],
    [['V-1004', '1000', 'INV-22490', '2026-04-20', '2026-04-20', 339250, 'INR', 'PAY006', 51750]]
)
create_statement(
    "Vendor_Statement_Mock_TC002_Qty_Less.xlsx",
    "Vendor Statement · April 2026 · Orion Castings (V-1004) - TC002 Qty Less",
    [
        ['V-1004', 'INV-22490', '2026-04-20', 339250, 'INR', '4501220062', 51750, 'PAY006', '27AAHFO2314M1Z2', 'IRN-990123A88', 'Generated', 'EWB-202604201', '2B Matched']
    ]
)

# ==========================================
# TC003: Invoice Qty More than GR (Vendor V-1001)
# ==========================================
create_ledger(
    "SAP_Ledger_Mock_TC003_Qty_More.xlsx",
    [['V-1001', 'Sigma Components Pvt. Ltd.', '27AAACS1210B1Z5', 'NT45', 'INR', 'AAACS1210B', 'Maharashtra', '194Q', 'No']],
    [['4501220001', '10', 500, 1245000, 'V-1001']],
    [['4501220001', '10', 450, 500, 1120500, '1000', 'V-1001']], # GR Qty 450 < Invoice Qty 500
    [['V-1001', '1000', 'INV-22418', '2026-04-02', '2026-04-02', 1469100, 'INR', 'PAY001', 224100]]
)
create_statement(
    "Vendor_Statement_Mock_TC003_Qty_More.xlsx",
    "Vendor Statement · April 2026 · Sigma Components (V-1001) - TC003 Qty More",
    [
        ['V-1001', 'INV-22418', '2026-04-02', 1469100, 'INR', '4501220001', 224100, 'PAY001', '27AAACS1210B1Z5', 'IRN-998218A98', 'Generated', 'EWB-202604021', '2B Matched']
    ]
)

# ==========================================
# TC004: Invoice Price Higher than PO (Vendor V-1001)
# ==========================================
create_ledger(
    "SAP_Ledger_Mock_TC004_Price_High.xlsx",
    [['V-1001', 'Sigma Components Pvt. Ltd.', '27AAACS1210B1Z5', 'NT45', 'INR', 'AAACS1210B', 'Maharashtra', '194Q', 'No']],
    [['4501220040', '10', 200, 321250, 'V-1001']], # unit price 1606.25
    [['4501220040', '10', 200, 200, 321250, '1000', 'V-1001']],
    [['V-1001', '1000', 'INV-22440', '2026-04-09', '2026-04-09', 386656.50, 'INR', None, 58981.50]]
)
create_statement(
    "Vendor_Statement_Mock_TC004_Price_High.xlsx",
    "Vendor Statement · April 2026 · Sigma Components (V-1001) - TC004 Price High",
    [
        ['V-1001', 'INV-22440', '2026-04-09', 386656.50, 'INR', '4501220040', 58981.50, None, '27AAACS1210B1Z5', 'IRN-881275C22', 'Generated', 'EWB-202604092', '2B Matched']
    ]
)

# ==========================================
# TC005: Missing GR Reference (Vendor V-1001)
# ==========================================
create_ledger(
    "SAP_Ledger_Mock_TC005_Missing_GR.xlsx",
    [['V-1001', 'Sigma Components Pvt. Ltd.', '27AAACS1210B1Z5', 'NT45', 'INR', 'AAACS1210B', 'Maharashtra', '194Q', 'No']],
    [['4501220033', '10', 120, 210000, 'V-1001']],
    [['4501220033', '10', 0, 120, 0, '1000', 'V-1001']], # GR Qty is 0!
    []
)
create_statement(
    "Vendor_Statement_Mock_TC005_Missing_GR.xlsx",
    "Vendor Statement · April 2026 · Sigma Components (V-1001) - TC005 Missing GR",
    [
        ['V-1001', 'INV-22461', '2026-04-14', 247800, 'INR', '4501220033', 37800, None, '27AAACS1210B1Z5', 'IRN-449108E11', 'Generated', 'EWB-202604143', '2B Matched']
    ]
)

# ==========================================
# TC006: GST 2B Gap (Vendor V-1002)
# ==========================================
create_ledger(
    "SAP_Ledger_Mock_TC006_GST_2B_Gap.xlsx",
    [['V-1002', 'Delta Forge Industries', '24AADCD4521F1Z3', 'NT30', 'INR', 'AADCD4521F', 'Gujarat', '194Q', 'No']],
    [['4501220051', '10', 1000, 88500, 'V-1002']],
    [['4501220051', '10', 1000, 1000, 88500, '1000', 'V-1002']],
    [['V-1002', '1000', 'INV-22482', '2026-04-18', '2026-04-18', 9912, 'INR', None, 1062]]
)
create_statement(
    "Vendor_Statement_Mock_TC006_GST_2B_Gap.xlsx",
    "Vendor Statement · April 2026 · Delta Forge (V-1002) - TC006 GST 2B Gap",
    [
        ['V-1002', 'INV-22482', '2026-04-18', 9912, 'INR', '4501220051', 1062, None, '24AADCD4521F1Z3', '', 'NOT generated', '', '2B Gap']
    ]
)

# ==========================================
# TC007: TDS Section 194Q Deduction (Vendor V-1001)
# ==========================================
create_ledger(
    "SAP_Ledger_Mock_TC007_TDS_194Q.xlsx",
    [['V-1001', 'Sigma Components Pvt. Ltd.', '27AAACS1210B1Z5', 'NT45', 'INR', 'AAACS1210B', 'Maharashtra', '194Q', 'No']],
    [['4501220001', '10', 500, 1245000, 'V-1001']],
    [['4501220001', '10', 450, 500, 1120500, '1000', 'V-1001']],
    [
        ['V-1001', '1000', 'INV-22418', '2026-04-02', '2026-04-02', 1469100, 'INR', 'PAY001', 224100],
        ['V-1001', '1000', 'TDS-194Q', '2026-04-25', '2026-04-25', -1469, 'INR', 'PAY004', 0]
    ]
)
create_statement(
    "Vendor_Statement_Mock_TC007_TDS_194Q.xlsx",
    "Vendor Statement · April 2026 · Sigma Components (V-1001) - TC007 TDS 194Q",
    [
        ['V-1001', 'INV-22418', '2026-04-02', 1469100, 'INR', '4501220001', 224100, 'PAY001', '27AAACS1210B1Z5', 'IRN-998218A98', 'Generated', 'EWB-202604021', '2B Matched'],
        ['V-1001', 'TDS deducted', '2026-04-25', -1469, 'INR', None, 0, None, '27AAACS1210B1Z5', '', '', '', '']
    ]
)

# ==========================================
# TC008: Payment in Transit (Vendor V-1001)
# ==========================================
create_ledger(
    "SAP_Ledger_Mock_TC008_Payment_Transit.xlsx",
    [['V-1001', 'Sigma Components Pvt. Ltd.', '27AAACS1210B1Z5', 'NT45', 'INR', 'AAACS1210B', 'Maharashtra', '194Q', 'No']],
    [['4501220001', '10', 500, 1245000, 'V-1001']],
    [['4501220001', '10', 450, 500, 1120500, '1000', 'V-1001']],
    [['V-1001', '1000', 'PAY-UTR88214', '2026-04-28', '2026-04-28', -1000000, 'INR', 'PAY003', 0]]
)
create_statement(
    "Vendor_Statement_Mock_TC008_Payment_Transit.xlsx",
    "Vendor Statement · April 2026 · Sigma Components (V-1001) - TC008 Payment Transit",
    [
        ['V-1001', 'Payment UTR-88214', '2026-04-25', -1000000, 'INR', None, 0, 'UTR-88214', '27AAACS1210B1Z5', '', '', '', '']
    ]
)

# ==========================================
# TC009: Credit Note Missing (Vendor V-1001)
# ==========================================
create_ledger(
    "SAP_Ledger_Mock_TC009_Credit_Note_Missing.xlsx",
    [['V-1001', 'Sigma Components Pvt. Ltd.', '27AAACS1210B1Z5', 'NT45', 'INR', 'AAACS1210B', 'Maharashtra', '194Q', 'No']],
    [['4501220040', '10', 200, 321250, 'V-1001']],
    [['4501220040', '10', 200, 200, 321250, '1000', 'V-1001']],
    [['V-1001', '1000', 'INV-22440', '2026-04-09', '2026-04-09', 386656.50, 'INR', None, 58981.50]]
)
create_statement(
    "Vendor_Statement_Mock_TC009_Credit_Note_Missing.xlsx",
    "Vendor Statement · April 2026 · Sigma Components (V-1001) - TC009 Credit Note Missing",
    [
        ['V-1001', 'CN-0091', '2026-04-11', -14160, 'INR', '4501220040', -2160, None, '27AAACS1210B1Z5', 'IRN-CN77123A', 'Generated', '', '2B Matched']
    ]
)

# ==========================================
# TC010: FX Revaluation (Vendor V-1005)
# ==========================================
create_ledger(
    "SAP_Ledger_Mock_TC010_FX_Revaluation.xlsx",
    [['V-1005', 'Helix Precision GmbH', '—', 'NT30', 'USD', '—', 'Germany', '—', 'No']],
    [['4501220075', '10', 20, 17000, 'V-1005']],
    [['4501220075', '10', 20, 20, 17000, '1000', 'V-1005']],
    [['V-1005', '1000', 'HX-2026-07', '2026-04-12', '2026-04-12', 17000, 'USD', 'PAY007', 0]]
)
create_statement(
    "Vendor_Statement_Mock_TC010_FX_Revaluation.xlsx",
    "Vendor Statement · April 2026 · Helix Precision (V-1005) - TC010 FX Revaluation",
    [
        ['V-1005', 'HX-2026-07', '2026-04-12', 17000, 'USD', '4501220075', 0, 'PAY007', '—', '—', '—', '—', '']
    ]
)

print("\nAll 20 individual ledger and statement scenario workbooks generated successfully inside test-data/scenarios/")
