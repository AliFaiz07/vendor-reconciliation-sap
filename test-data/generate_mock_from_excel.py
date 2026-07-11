import os
import openpyxl
from openpyxl import Workbook

output_dir = r"C:\projects\vendor_reconcile\test-data"

# Create SAP_Ledger_Mock.xlsx
sap_wb = Workbook()

# 1. VendorMaster Sheet
ws_vm = sap_wb.active
ws_vm.title = "VendorMaster"
ws_vm.append(['BusinessPartner', 'BusinessPartnerName', 'TaxNumber1', 'PaymentTerms', 'Currency', 'Pan', 'State', 'TdsSection', 'IsMsme'])
ws_vm.append(['V-1001', 'Sigma Components Pvt. Ltd.', '27AAACS1210B1Z5', 'NT45', 'INR', 'AAACS1210B', 'Maharashtra', '194Q', 'No'])
ws_vm.append(['V-1002', 'Delta Forge Industries', '24AADCD4521F1Z3', 'NT30', 'INR', 'AADCD4521F', 'Gujarat', '194Q', 'No'])
ws_vm.append(['V-1003', 'Nova Tools & Abrasives', '29AAFCN7845K1Z6', 'NT60', 'INR', 'AAFCN7845K', 'Karnataka', '194Q', 'Yes'])
ws_vm.append(['V-1004', 'Orion Castings LLP', '27AAHFO2314M1Z2', 'NT45', 'INR', 'AAHFO2314M', 'Maharashtra', '194C', 'No'])
ws_vm.append(['V-1005', 'Helix Precision GmbH', '—', 'NT30', 'USD', '—', 'Germany', '—', 'No'])

# 2. PurchaseOrders Sheet
ws_po = sap_wb.create_sheet(title="PurchaseOrders")
ws_po.append(['PurchaseOrder', 'PurchaseOrderItem', 'PoQty', 'PoAmount', 'Supplier'])
ws_po.append(['4501220001', '10', 500, 1245000, 'V-1001'])
ws_po.append(['4501220033', '10', 120, 210000, 'V-1001'])
ws_po.append(['4501220040', '10', 200, 321250, 'V-1001'])
ws_po.append(['4501220051', '10', 1000, 88500, 'V-1002'])
ws_po.append(['4501220062', '10', 300, 287500, 'V-1004'])
ws_po.append(['4501220075', '10', 20, 17000, 'V-1005'])

# 3. GrirSnapshot Sheet
ws_gr = sap_wb.create_sheet(title="GrirSnapshot")
ws_gr.append(['PurchaseOrder', 'PurchaseOrderItem', 'GoodsReceiptQty', 'InvoicedQuantity', 'GrirAmount', 'Plant', 'Supplier'])
ws_gr.append(['4501220001', '10', 450, 500, 1120500, '1000', 'V-1001'])
ws_gr.append(['4501220033', '10', 0, 120, 0, '1000', 'V-1001'])
ws_gr.append(['4501220040', '10', 200, 200, 321250, '1000', 'V-1001'])
ws_gr.append(['4501220051', '10', 1000, 1000, 88500, '1000', 'V-1002'])
ws_gr.append(['4501220062', '10', 300, 300, 287500, '1000', 'V-1004'])
ws_gr.append(['4501220075', '10', 20, 20, 17000, '1000', 'V-1005'])

# 4. VendorLedgerItems Sheet
ws_vl = sap_wb.create_sheet(title="VendorLedgerItems")
ws_vl.append(['Supplier', 'CompanyCode', 'AccountingDocument', 'DocumentDate', 'PostingDate', 'AmountInTransCrcy', 'TransactionCurrency', 'ClearingDocument', 'TaxAmount'])
ws_vl.append(['V-1001', '1000', 'INV-22418', '2026-04-02', '2026-04-02', 1469100, 'INR', 'PAY001', 224100])
ws_vl.append(['V-1001', '1000', 'INV-22440', '2026-04-09', '2026-04-09', 386656.50, 'INR', None, 58981.50])
ws_vl.append(['V-1001', '1000', 'PAY-UTR88214', '2026-04-28', '2026-04-28', -1000000, 'INR', 'PAY003', 0])
ws_vl.append(['V-1001', '1000', 'TDS-194Q', '2026-04-25', '2026-04-25', -1469, 'INR', 'PAY004', 0])
ws_vl.append(['V-1002', '1000', 'INV-22475', '2026-04-16', '2026-04-16', 89208, 'INR', 'PAY005', 9558])
ws_vl.append(['V-1002', '1000', 'INV-22482', '2026-04-18', '2026-04-18', 9912, 'INR', None, 1062])
ws_vl.append(['V-1004', '1000', 'INV-22490', '2026-04-20', '2026-04-20', 339250, 'INR', 'PAY006', 51750])
ws_vl.append(['V-1005', '1000', 'HX-2026-07', '2026-04-12', '2026-04-12', 17000, 'USD', 'PAY007', 0])

sap_wb.save(os.path.join(output_dir, "SAP_Ledger_Mock.xlsx"))
print("Saved SAP_Ledger_Mock.xlsx")


# Create Vendor_Statement_Mock.xlsx
stmt_wb = Workbook()
ws_st = stmt_wb.active
ws_st.title = "Statement"
ws_st.append(['Vendor Statement · April 2026 · Sigma Components (V-1001)'])
ws_st.append([]) # Blank row
ws_st.append(['VendorCode', 'VendorInvoiceNo', 'InvoiceDate', 'InvoiceAmount', 'Currency', 'PoReference', 'GstTdsAmount', 'PaymentReference', 'Gstin', 'Irn', 'IrnStatus', 'EwayBill', 'Gstr2bStatus'])
ws_st.append(['V-1001', 'Opening balance', '2026-04-01', 1840650, 'INR', None, 0, None, '27AAACS1210B1Z5', '', '', '', ''])
ws_st.append(['V-1001', 'INV-22418', '2026-04-02', 1469100, 'INR', '4501220001', 224100, 'PAY001', '27AAACS1210B1Z5', 'IRN-998218A98', 'Generated', 'EWB-202604021', '2B Matched'])
ws_st.append(['V-1001', 'INV-22440', '2026-04-09', 386656.50, 'INR', '4501220040', 58981.50, None, '27AAACS1210B1Z5', 'IRN-881275C22', 'Generated', 'EWB-202604092', '2B Matched'])
ws_st.append(['V-1001', 'CN-0091', '2026-04-11', -14160, 'INR', '4501220040', -2160, None, '27AAACS1210B1Z5', 'IRN-CN77123A', 'Generated', '', '2B Matched'])
ws_st.append(['V-1001', 'INV-22461', '2026-04-14', 247800, 'INR', '4501220033', 37800, None, '27AAACS1210B1Z5', 'IRN-449108E11', 'Generated', 'EWB-202604143', '2B Matched'])
ws_st.append(['V-1001', 'Payment UTR-88214', '2026-04-25', -1000000, 'INR', None, 0, 'UTR-88214', '27AAACS1210B1Z5', '', '', '', ''])
ws_st.append(['V-1001', 'TDS deducted', '2026-04-25', -1469, 'INR', None, 0, None, '27AAACS1210B1Z5', '', '', '', ''])

# Add import, MSME and GST gap vendor lines into a second mock statement for verification
# V-1002 statement:
ws_st_v2 = stmt_wb.create_sheet(title="Statement_V1002")
ws_st_v2.append(['Vendor Statement · April 2026 · Delta Forge (V-1002)'])
ws_st_v2.append([])
ws_st_v2.append(['VendorCode', 'VendorInvoiceNo', 'InvoiceDate', 'InvoiceAmount', 'Currency', 'PoReference', 'GstTdsAmount', 'PaymentReference', 'Gstin', 'Irn', 'IrnStatus', 'EwayBill', 'Gstr2bStatus'])
ws_st_v2.append(['V-1002', 'INV-22475', '2026-04-16', 89208, 'INR', '4501220051', 9558, 'PAY005', '24AADCD4521F1Z3', 'IRN-773121X88', 'Generated', 'EWB-202604169', '2B Matched'])
ws_st_v2.append(['V-1002', 'INV-22482', '2026-04-18', 9912, 'INR', '4501220051', 1062, None, '24AADCD4521F1Z3', '', 'NOT generated', '', '2B Gap'])

stmt_wb.save(os.path.join(output_dir, "Vendor_Statement_Mock.xlsx"))
print("Saved Vendor_Statement_Mock.xlsx")
