const { chromium } = require('playwright');
const path = require('path');

(async () => {
  console.log("Launching Chromium browser in headed mode...");
  const browser = await chromium.launch({
    headless: false,
    slowMo: 800 // Moderate pace to trace actions visually
  });

  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });

  const delay = async (ms = 2000) => {
    console.log(`Waiting ${ms / 1000} seconds...`);
    await page.waitForTimeout(ms);
  };

  try {
    console.log("Navigating to Vendor Reconciliation Launchpad...");
    await page.goto('http://localhost:4004/vendordoclines/webapp/index.html');
    await delay();

    // ==========================================
    // STEP 1: PR Indenter
    // ==========================================
    console.log("\n--- STEP 1: Logging in as PR Indenter ---");
    await page.fill('input[id*="loginUsername-inner"]', 'pr_test');
    await page.fill('input[id*="loginPassword-inner"]', 'admin');
    await page.click('button:has-text("Login")');
    await delay();

    console.log("Navigating from Home to PR Workbench...");
    await page.click('text="Open workbench"');
    await delay();

    console.log("Creating Purchase Requisition...");
    await page.fill('input[id*="prMaterial-inner"]', 'Premium Steel Rods');
    await page.fill('input[id*="prQty"]', '150');
    await page.fill('input[id*="prAmount-inner"]', '225000');
    await page.click('button:has-text("Submit Purchase Requisition")');
    await delay(3000);

    console.log("Logging out PR Indenter...");
    await page.locator('button:has-text("Logout")').filter({ visible: true }).first().click();
    await page.click('button:has-text("Yes")');
    await delay();

    // ==========================================
    // STEP 2: PO Officer
    // ==========================================
    console.log("\n--- STEP 2: Logging in as PO Officer ---");
    await page.fill('input[id*="loginUsername-inner"]', 'po_test');
    await page.fill('input[id*="loginPassword-inner"]', 'admin');
    await page.click('button:has-text("Login")');
    await delay();

    console.log("Navigating from Home to PO Workbench...");
    await page.click('text="Open workbench"');
    await delay();

    console.log("Approving PR...");
    await page.locator('tr:has-text("Premium Steel Rods")').locator('button:has-text("Approve")').click();
    await delay(3000);

    console.log("Opening Conversion Dialog...");
    await page.locator('tr:has-text("Premium Steel Rods")').locator('button:has-text("Convert to PO")').click();
    await delay();

    console.log("Assigning supplier and generating PO...");
    await page.fill('input[id*="poSupplier-inner"]', 'V-1002');
    await page.fill('input[id*="poCustomNumber-inner"]', 'PO-4500010');
    await page.click('button:has-text("Generate Purchase Order")');
    await delay(3000);

    console.log("Sending PO to Vendor...");
    await page.locator('tr:has-text("PO-4500010")').locator('button:has-text("Send to Vendor")').click();
    await delay(3000);

    console.log("Logging out PO Officer...");
    await page.locator('button:has-text("Logout")').filter({ visible: true }).first().click();
    await page.click('button:has-text("Yes")');
    await delay();

    // ==========================================
    // STEP 3: Vendor Collaboration Portal
    // ==========================================
    console.log("\n--- STEP 3: Logging in as Vendor V-1002 ---");
    await page.fill('input[id*="loginUsername-inner"]', 'V-1002');
    await page.fill('input[id*="loginPassword-inner"]', 'admin');
    await page.click('button:has-text("Login")');
    await delay();

    console.log("Navigating from Home to Vendor Portal...");
    await page.click('text="Open workbench"');
    await delay();

    console.log("Dispatching Goods...");
    await page.locator('tr:has-text("PO-4500010")').locator('button:has-text("Dispatch Goods")').click();
    await delay(3000);

    console.log("Navigating to Submit Bills tab...");
    await page.click('text="Submit Bills & Statements"');
    await delay();

    console.log("Filling Invoice details...");
    await page.fill('input[id*="invNumber-inner"]', 'INV-Fiori-8809');
    await page.fill('input[id*="invDate-inner"]', '2026-07-15');
    await page.fill('input[id*="invAmount-inner"]', '225000');
    await page.fill('input[id*="invPoRef-inner"]', 'PO-4500010');
    await page.click('button:has-text("Submit Invoice")');
    await delay(3000);

    console.log("Logging out Vendor...");
    await page.locator('button:has-text("Logout")').filter({ visible: true }).first().click();
    await page.click('button:has-text("Yes")');
    await delay();

    // ==========================================
    // STEP 4: Goods Receipt Officer
    // ==========================================
    console.log("\n--- STEP 4: Logging in as GR Specialist ---");
    await page.fill('input[id*="loginUsername-inner"]', 'gr_user');
    await page.fill('input[id*="loginPassword-inner"]', 'admin');
    await page.click('button:has-text("Login")');
    await delay();

    console.log("Navigating from Home to GR Workbench...");
    await page.click('text="Open workbench"');
    await delay();

    console.log("Posting Goods Receipt (MIGO)...");
    await page.locator('tr:has-text("PO-4500010")').locator('button:has-text("Post GR")').click();
    await delay(3000);

    console.log("Logging out GR Specialist...");
    await page.locator('button:has-text("Logout")').filter({ visible: true }).first().click();
    await page.click('button:has-text("Yes")');
    await delay();

    // ==========================================
    // STEP 5: Finance & Accounts Payable Command Center
    // ==========================================
    console.log("\n--- STEP 5: Logging in as Finance Executive ---");
    await page.fill('input[id*="loginUsername-inner"]', 'finance_user');
    await page.fill('input[id*="loginPassword-inner"]', 'admin');
    await page.click('button:has-text("Login")');
    await delay();

    console.log("Navigating from Home to AP Dashboard...");
    await page.click('text="Open workbench"');
    await delay();

    console.log("Navigating to MIRO tab...");
    await page.click('text="Invoice Verification (MIRO)"');
    await delay();

    console.log("Posting invoice verification (MIRO)...");
    await page.locator('tr:has-text("INV-Fiori-8809")').locator('button:has-text("Verify")').click();
    await delay(3000);

    console.log("Running Matching Engine...");
    await page.click('button:has-text("Run Matching")');
    await delay(3000);

    console.log("Navigating to Workbench tab...");
    await page.click('text="Workbench"');
    await delay();

    console.log("Selecting matched row for INV-Fiori-8809...");
    await page.click('text=INV-Fiori-8809');
    await delay();

    console.log("Approving for AP Payment...");
    await page.click('button:has-text("Approve for AP Payment")');
    await delay(3000);

    console.log("Invoice approved for payment. Dialog closed automatically.");

    console.log("Navigating to Payment Cockpit (F110)...");
    await page.click('text="Payment Cockpit (F110)"');
    await delay();

    console.log("Selecting the invoice row checkbox in approved list...");
    await page.locator('tr:has-text("INV-Fiori-8809")').locator('.sapMCb').first().click();
    await delay();

    console.log("Creating Payment Proposal...");
    await page.click('button:has-text("Create Payment Proposal")');
    await delay(3000);

    console.log("Switching to Proposals tab...");
    await page.click('text="Payment Proposals"');
    await delay();

    console.log("Selecting the proposal checkbox...");
    await page.locator('tr:has-text("INV-Fiori-8809")').locator('.sapMCb').first().click();
    await delay();

    console.log("Executing F110 Payment Run Dialog...");
    await page.click('button:has-text("Execute Payment Run (F110)")');
    await delay();

    console.log("Entering Bank Payment / UTR reference...");
    await page.fill('input[id*="payRefInput-inner"]', 'UTR-F110-XYZ');
    await page.click('button:has-text("Execute F110 Run")');
    await delay(3000);

    console.log("\n=======================================================");
    console.log("E2E P2P Playwright Automation Complete!");
    console.log("Browser is kept open for manual review.");
    console.log("=======================================================");

    // Wait indefinitely to keep the chromium window open
    await new Promise(() => {});

  } catch (error) {
    console.error("\n❌ Test Suite Failed:", error.message);
    const screenshotPath = path.join(__dirname, '..', 'playwright_error.png');
    await page.screenshot({ path: screenshotPath });
    console.log(`📸 Screenshot saved for debug to: ${screenshotPath}`);
    browser.close();
    process.exit(1);
  }
})();
