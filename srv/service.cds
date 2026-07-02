service VendorService {
  entity Vendors {
    key vendor_id : String(20);
        name      : String(100);
        contact   : String(100);
        email     : String(100);
  }

  entity Invoices {
    key invoice_id : String(20);
        vendor_id  : String(20);
        amount     : Decimal(10,2);
        date       : Date;
        status     : String(20);
  }

  entity Payments {
    key payment_id : String(20);
        invoice_id : String(20);
        amount     : Decimal(10,2);
        date       : Date;
        method     : String(20);
  }
}
