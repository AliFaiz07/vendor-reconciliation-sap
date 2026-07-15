const cds = require('@sap/cds');
const log = cds.log('p2p-handler');

module.exports = (srv) => {
  const { PurchaseRequisitions, PurchaseOrders, GrirSnapshot, VendorLedgerItems, VendorDocLines, WorkflowHistory, Exceptions } = cds.entities;

  // 1. Create Purchase Requisition (PR)
  srv.on('createPR', async (req) => {
    try {
      const { material, qty, amount } = req.data;
      if (!material || !qty || !amount) {
        return req.error(400, 'Material, quantity, and amount are required.');
      }
      const prNumber = 'PR-' + Math.floor(100000 + Math.random() * 900000);
      const prId = cds.utils.uuid();
      
      const actor = req.user?.id || req.http?.req?.headers['x-user-role'] || 'indenter';
      
      await INSERT.into(PurchaseRequisitions).entries({
        ID: prId,
        prNumber,
        material,
        qty,
        amount,
        status: 'PENDING',
        indentor: actor
      });
      
      log.info(`PR ${prNumber} created by ${actor}`);
      return JSON.stringify({ prId, prNumber });
    } catch (err) {
      log.error('Failed to create PR:', err);
      return req.error(500, err.message);
    }
  });

  // 2. Approve PR
  srv.on('approvePR', async (req) => {
    try {
      const { prId } = req.data;
      if (!prId) return req.error(400, 'PR ID is required.');
      await UPDATE(PurchaseRequisitions, prId).with({ status: 'APPROVED' });
      return 'PR Approved';
    } catch (err) {
      return req.error(500, err.message);
    }
  });

  // 3. Create PO from PR
  srv.on('createPO', async (req) => {
    try {
      const { prId, purchaseOrder, supplier } = req.data;
      if (!prId || !supplier) return req.error(400, 'PR ID and Supplier are required.');
      
      const pr = await SELECT.one.from(PurchaseRequisitions).where({ ID: prId });
      if (!pr) return req.error(404, 'PR not found');
      
      const poNum = purchaseOrder || 'PO-4500' + Math.floor(100000 + Math.random() * 900000);
      const poId = cds.utils.uuid();
      
      await INSERT.into(PurchaseOrders).entries({
        ID: poId,
        purchaseOrder: poNum,
        poItem: '00010',
        poQty: pr.qty,
        poAmount: pr.amount,
        supplier,
        material: pr.material,
        status: 'CREATED',
        receivedQty: 0
      });
      
      await UPDATE(PurchaseRequisitions, prId).with({
        status: 'PO_CREATED',
        poReference: poNum
      });
      
      log.info(`PO ${poNum} generated from PR ${pr.prNumber}`);
      return JSON.stringify({ poId, purchaseOrder: poNum });
    } catch (err) {
      return req.error(500, err.message);
    }
  });

  // 4. Send PO to Vendor
  srv.on('sendPOToVendor', async (req) => {
    try {
      const { poId } = req.data;
      await UPDATE(PurchaseOrders, poId).with({ status: 'SENT' });
      return 'PO Sent to Vendor';
    } catch (err) {
      return req.error(500, err.message);
    }
  });

  // 5. Dispatch Goods (Vendor side)
  srv.on('dispatchGoods', async (req) => {
    try {
      const { poId } = req.data;
      await UPDATE(PurchaseOrders, poId).with({ status: 'DISPATCHED' });
      return 'Goods Dispatched';
    } catch (err) {
      return req.error(500, err.message);
    }
  });

  // 6. Post Goods Receipt (MIGO)
  srv.on('postGR', async (req) => {
    try {
      const { poId, grQty, plant } = req.data;
      const po = await SELECT.one.from(PurchaseOrders).where({ ID: poId });
      if (!po) return req.error(404, 'PO not found');
      
      const newReceivedQty = Number(po.receivedQty || 0) + Number(grQty);
      await UPDATE(PurchaseOrders, poId).with({
        status: 'GR_POSTED',
        receivedQty: newReceivedQty
      });
      
      // Update or create GrirSnapshot
      const existingGrir = await SELECT.one.from(GrirSnapshot).where({ purchaseOrder: po.purchaseOrder });
      if (existingGrir) {
        await UPDATE(GrirSnapshot, existingGrir.ID).with({
          goodsReceiptQty: Number(existingGrir.goodsReceiptQty || 0) + Number(grQty),
          grirAmount: Number(existingGrir.grirAmount || 0) + (Number(po.poAmount) / Number(po.poQty)) * Number(grQty)
        });
      } else {
        await INSERT.into(GrirSnapshot).entries({
          ID: cds.utils.uuid(),
          purchaseOrder: po.purchaseOrder,
          purchaseOrderItem: po.poItem,
          goodsReceiptQty: grQty,
          invoicedQuantity: 0,
          grirAmount: (Number(po.poAmount) / Number(po.poQty)) * Number(grQty),
          plant: plant || '1000',
          supplier: po.supplier
        });
      }
      
      log.info(`GR posted for PO ${po.purchaseOrder}. Received Qty: ${newReceivedQty}`);
      return 'GR Posted successfully';
    } catch (err) {
      return req.error(500, err.message);
    }
  });

  // 7. Approve Invoice for AP payment (Finance Executive action)
  srv.on('approveForPayment', async (req) => {
    try {
      const { docLineId } = req.data;
      if (!docLineId) return req.error(400, 'Invoice Line ID is required.');
      
      await UPDATE(VendorDocLines, docLineId).with({ approvedForPayment: true });
      
      // Also update any linked exceptions to RESOLVED if they exist
      const linkedMatchResult = await SELECT.one.from('vendorrecon.db.MatchResults').where({ vendorDocLine_ID: docLineId });
      const linkedException = linkedMatchResult
        ? await SELECT.one.from(Exceptions).where({ matchResult_ID: linkedMatchResult.ID })
        : null;

      if (linkedException) {
        await UPDATE(Exceptions, linkedException.ID).with({ status: 'RESOLVED' });
        await INSERT.into(WorkflowHistory).entries({
          ID: cds.utils.uuid(),
          exceptionID: linkedException.ID,
          stepName: 'Approval',
          actor: req.user?.id || req.http?.req?.headers['x-user-role'] || 'finance_exec',
          action: 'RESOLVE',
          comment: 'Approved and sent to AP cockpit',
          timestamp: new Date().toISOString()
        });
      }
      
      log.info(`Invoice line ${docLineId} approved and sent to AP.`);
      return 'Approved for Payment';
    } catch (err) {
      return req.error(500, err.message);
    }
  });

  // 8. Create Payment Proposal (AP action)
  srv.on('createPaymentProposal', async (req) => {
    try {
      const { docLineIds } = req.data;
      if (!docLineIds) return req.error(400, 'Invoice Line IDs are required.');
      const ids = JSON.parse(docLineIds);
      
      if (ids.length > 0) {
        await UPDATE(VendorDocLines).where({ ID: { in: ids } }).with({ paymentStatus: 'PROPOSED' });
      }
      return 'Payment Proposal Created';
    } catch (err) {
      return req.error(500, err.message);
    }
  });

  // 9. Execute Payment Run F110 (AP action)
  srv.on('executePaymentRun', async (req) => {
    try {
      const { paymentRef, docLineIds } = req.data;
      if (!paymentRef || !docLineIds) return req.error(400, 'Payment Reference and Invoice Line IDs are required.');
      const ids = JSON.parse(docLineIds);
      
      if (ids.length > 0) {
        const lines = await SELECT.from(VendorDocLines).where({ ID: { in: ids } });
        
        await cds.tx(req).run(async (tx) => {
          await tx.run(UPDATE(VendorDocLines).where({ ID: { in: ids } }).with({ 
            paymentStatus: 'PAID',
            paymentReference: paymentRef
          }));
          
          for (const line of lines) {
            const existingLedger = await tx.run(SELECT.one.from(VendorLedgerItems).where({ 
              supplier: line.sourceVendorCode,
              accountingDocument: line.vendorInvoiceNo
            }));
            
            if (existingLedger) {
              await tx.run(UPDATE(VendorLedgerItems, existingLedger.ID).with({
                isCleared: true,
                clearingDocument: paymentRef
              }));
            } else {
              await tx.run(INSERT.into(VendorLedgerItems).entries({
                ID: cds.utils.uuid(),
                supplier: line.sourceVendorCode,
                companyCode: '1000',
                accountingDocument: line.vendorInvoiceNo,
                documentDate: line.invoiceDate,
                postingDate: new Date().toISOString().split('T')[0],
                amountInTransCrcy: line.invoiceAmount,
                transactionCurrency: line.currency,
                clearingDocument: paymentRef,
                isCleared: true,
                taxAmount: line.gstTdsAmount || 0
              }));
            }
          }
        });
      }
      
      log.info(`Payment run executed with ref ${paymentRef} for ${ids.length} invoices`);
      return 'Payment run completed successfully';
    } catch (err) {
      return req.error(500, err.message);
    }
  });
};
