function formatDateYyyymmdd(dateString) {
    const d = new Date(dateString);
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  }
  
  function buildTallyXml(row) {
    const {
      companyName,
      invoiceDate,
      effectiveDate,
      referenceNumber,
      narration,
      DrLedger,
      CrLedger,
      amount,
      voucherName
    } = row;
  
    const invoiceDateFormatted = invoiceDate;
    const effectiveDateFormatted = effectiveDate;


    let xml = `
  <ENVELOPE>
    <HEADER>
      <TALLYREQUEST>Import Data</TALLYREQUEST>
    </HEADER>
    <BODY>
      <IMPORTDATA>
        <REQUESTDESC>
          <REPORTNAME>Vouchers</REPORTNAME>
          <STATICVARIABLES>
            <SVCURRENTCOMPANY>${companyName}</SVCURRENTCOMPANY>
          </STATICVARIABLES>
        </REQUESTDESC>
        <REQUESTDATA>
          <TALLYMESSAGE xmlns:UDF="TallyUDF">
            <VOUCHER VCHTYPE="${voucherName}" ACTION="Create" OBJVIEW="Accounting Voucher View">
              <DATE>${invoiceDateFormatted}</DATE>
              <EFFECTIVEDATE>${effectiveDateFormatted}</EFFECTIVEDATE>
              <NARRATION>${narration}</NARRATION>
              <VOUCHERNUMBER>${referenceNumber}</VOUCHERNUMBER>
              <VOUCHERTYPENAME>${voucherName}</VOUCHERTYPENAME>
    `;
  
    if (voucherName === "Payment") {
      xml += `            <PARTYLEDGERNAME>${DrLedger}</PARTYLEDGERNAME>
  `;
    } else if (voucherName === "Receipt") {
      xml += `            <PARTYLEDGERNAME>${CrLedger}</PARTYLEDGERNAME>
  `;
    }
  
    xml += `
              <ALLLEDGERENTRIES.LIST>
                <LEDGERNAME>${DrLedger}</LEDGERNAME>
                <ISDEEMEDPOSITIVE>${voucherName === "Payment" ? "Yes" : "No"}</ISDEEMEDPOSITIVE>
                <AMOUNT>${voucherName === "Payment" ? "-" : ""}${amount.toFixed(2)}</AMOUNT>
                <BILLALLOCATIONS.LIST>
                  <NAME>${referenceNumber}</NAME>
                  <BILLTYPE>Agst Ref</BILLTYPE>
                  <AMOUNT>-${amount.toFixed(2)}</AMOUNT>
                </BILLALLOCATIONS.LIST>
              </ALLLEDGERENTRIES.LIST>
      `;
  
    xml += `
              <ALLLEDGERENTRIES.LIST>
                <LEDGERNAME>${CrLedger}</LEDGERNAME>
                <ISDEEMEDPOSITIVE>${voucherName === "Payment" ? "No" : "Yes"}</ISDEEMEDPOSITIVE>
                <AMOUNT>${voucherName === "Payment" ? "" : "-"}${amount.toFixed(2)}</AMOUNT>
                <BANKALLOCATIONS.LIST>
                  <DATE>${invoiceDateFormatted}</DATE>
                  <PAYMENTFAVOURING>${DrLedger}</PAYMENTFAVOURING>
                  <PAYMENTMODE>Transacted</PAYMENTMODE>
                  <BANKPARTYNAME>${DrLedger}</BANKPARTYNAME>
                  <AMOUNT>${amount.toFixed(2)}</AMOUNT>
                </BANKALLOCATIONS.LIST>
              </ALLLEDGERENTRIES.LIST>
      `;
  
    xml += `
            </VOUCHER>
          </TALLYMESSAGE>
        </REQUESTDATA>
      </IMPORTDATA>
    </BODY>
  </ENVELOPE>
  `.trim();
  
    return xml;
  }

export { buildTallyXml };