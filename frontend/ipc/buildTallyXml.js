  function buildTallyXmlPaymentReceipt(row) {
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

  function buildTallyXmlContra({ invoiceDate, narration, CrLedger, voucherName, amount, DrLedger, companyName }) {
    const formattedDate = formatDateYyyymmdd(invoiceDate);

    return `
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
     <VOUCHER VCHTYPE="Contra" ACTION="Create" OBJVIEW="Accounting Voucher View">
      <DATE>${formattedDate}</DATE>
      <VCHSTATUSDATE>${formattedDate}</VCHSTATUSDATE>
      <NARRATION>${narration}</NARRATION>
      <VOUCHERTYPENAME>Contra</VOUCHERTYPENAME>
      <PARTYLEDGERNAME>${DrLedger}</PARTYLEDGERNAME>
      <VOUCHERNUMBER>${voucherName}</VOUCHERNUMBER>
      <NUMBERINGSTYLE>Auto Retain</NUMBERINGSTYLE>
      <FBTPAYMENTTYPE>Default</FBTPAYMENTTYPE>
      <PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>
      <VCHSTATUSTAXADJUSTMENT>Default</VCHSTATUSTAXADJUSTMENT>
      <VCHSTATUSVOUCHERTYPE>Contra</VCHSTATUSVOUCHERTYPE>
      <EFFECTIVEDATE>${formattedDate}</EFFECTIVEDATE>
      <ISELIGIBLEFORITC>Yes</ISELIGIBLEFORITC>
      <HASCASHFLOW>Yes</HASCASHFLOW>
      <ISVATDUTYPAID>Yes</ISVATDUTYPAID>
      <VOUCHERNUMBERSERIES>Default</VOUCHERNUMBERSERIES>
      <ALLLEDGERENTRIES.LIST>
       <LEDGERNAME>${DrLedger}</LEDGERNAME>
       <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
       <AMOUNT>${amount.toFixed(2)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>
      <ALLLEDGERENTRIES.LIST>
       <LEDGERNAME>${CrLedger}</LEDGERNAME>
       <GSTCLASS>&#4; Not Applicable</GSTCLASS>
       <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
       <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
       <ISLASTDEEMEDPOSITIVE>Yes</ISLASTDEEMEDPOSITIVE>
       <AMOUNT>-${amount.toFixed(2)}</AMOUNT >
    <BANKALLOCATIONS.LIST>
        <DATE>${formattedDate}</DATE>
        <INSTRUMENTDATE>${formattedDate}</INSTRUMENTDATE>
        <CASHDENOMINATION>1-0-0-0-0-0-0-0-0-0-0-0</CASHDENOMINATION>
        <PAYMENTMODE>Transacted</PAYMENTMODE>
        <AMOUNT>-${amount.toFixed(2)}</AMOUNT>
    </BANKALLOCATIONS.LIST>
      </ALLLEDGERENTRIES.LIST >
     </VOUCHER >
    </TALLYMESSAGE >
   </REQUESTDATA >
  </IMPORTDATA >
 </BODY >
</ENVELOPE >

    `;
}

module.exports = { buildTallyXmlPaymentReceipt,buildTallyXmlContra };
