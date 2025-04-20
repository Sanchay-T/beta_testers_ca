const { DOMParser } = require("xmldom");

function buildTallyXmlPayment(row) {
  let {
    companyName,
    invoiceDate,
    effectiveDate,
    billRefernce,
    narration,
    DrLedger,
    CrLedger,
    amount,
    voucherName,
  } = row;

  const invoiceDateFormatted = invoiceDate;
  const effectiveDateFormatted = effectiveDate;

  companyName = companyName ? companyName.replace(/&/g, "&amp;") : companyName;
  narration = narration ? narration.replace(/&/g, "&amp;") : narration;
  DrLedger = DrLedger ? DrLedger.replace(/&/g, "&amp;") : DrLedger;
  CrLedger = CrLedger ? CrLedger.replace(/&/g, "&amp;") : CrLedger;

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
          <VOUCHER VCHTYPE="Payment" ACTION="Create" OBJVIEW="Accounting Voucher View">
            <DATE>${invoiceDateFormatted}</DATE>
            <EFFECTIVEDATE>${effectiveDateFormatted}</EFFECTIVEDATE>
            <NARRATION>${narration}</NARRATION>
            <VOUCHERTYPENAME>Payment</VOUCHERTYPENAME>
            <PARTYLEDGERNAME>${DrLedger}</PARTYLEDGERNAME>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${DrLedger}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${amount}</AMOUNT>
              <BILLALLOCATIONS.LIST>
                <NAME>${billRefernce}</NAME>
                <BILLTYPE>Agst Ref</BILLTYPE>
                <AMOUNT>-${amount}</AMOUNT>
              </BILLALLOCATIONS.LIST>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${CrLedger}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${amount}</AMOUNT>
              <BANKALLOCATIONS.LIST>
                <DATE>${invoiceDateFormatted}</DATE>
                <PAYMENTFAVOURING>${DrLedger}</PAYMENTFAVOURING>
                <PAYMENTMODE>Transacted</PAYMENTMODE>
                <BANKPARTYNAME>${DrLedger}</BANKPARTYNAME>
                <AMOUNT>${amount}</AMOUNT>
              </BANKALLOCATIONS.LIST>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>
    `.trim();

  return xml;
}

function buildTallyXmlReceipt(row) {
  let {
    companyName,
    invoiceDate,
    effectiveDate,
    billRefernce,
    narration,
    DrLedger,
    CrLedger,
    amount,
    voucherName,
  } = row;

  const invoiceDateFormatted = invoiceDate;
  const effectiveDateFormatted = effectiveDate;

  companyName = companyName ? companyName.replace(/&/g, "&amp;") : companyName;
  narration = narration ? narration.replace(/&/g, "&amp;") : narration;
  DrLedger = DrLedger ? DrLedger.replace(/&/g, "&amp;") : DrLedger;
  CrLedger = CrLedger ? CrLedger.replace(/&/g, "&amp;") : CrLedger;

  let xml = `
  <ENVELOPE>
    <HEADER>
      <TALLYREQUEST>Import Data</TALLYREQUEST>
    </HEADER>
    <BODY>
      <IMPORTDATA>
        <REQUESTDESC>
          <REPORTNAME>All Masters</REPORTNAME>
          <STATICVARIABLES>
            <SVCURRENTCOMPANY>${companyName}</SVCURRENTCOMPANY>
          </STATICVARIABLES>
        </REQUESTDESC>
        <REQUESTDATA>
          <TALLYMESSAGE xmlns:UDF="TallyUDF">
            <VOUCHER VCHTYPE="Receipt" ACTION="Create" OBJVIEW="Accounting Voucher View">
              <OLDAUDITENTRYIDS.LIST TYPE="Number">
                <OLDAUDITENTRYIDS>-1</OLDAUDITENTRYIDS>
              </OLDAUDITENTRYIDS.LIST>
              <DATE>${invoiceDateFormatted}</DATE>
              <NARRATION>${narration}</NARRATION>
              <VOUCHERTYPENAME>Receipt</VOUCHERTYPENAME>
              <VOUCHERNUMBER>1</VOUCHERNUMBER>
              <PARTYLEDGERNAME>${CrLedger}</PARTYLEDGERNAME>
              <CSTFORMISSUETYPE/>
              <CSTFORMRECVTYPE/>
              <PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>
              <VCHGSTCLASS/>
              <EFFECTIVEDATE>${effectiveDateFormatted}</EFFECTIVEDATE>
              <ALLLEDGERENTRIES.LIST>
                <OLDAUDITENTRYIDS.LIST TYPE="Number">
                  <OLDAUDITENTRYIDS>-1</OLDAUDITENTRYIDS>
                </OLDAUDITENTRYIDS.LIST>
                <LEDGERNAME>${CrLedger}</LEDGERNAME>
                <GSTCLASS/>
                <AMOUNT>${amount}</AMOUNT>
                <BANKALLOCATIONS.LIST>
                  <DATE>${invoiceDateFormatted}</DATE>
                  <INSTRUMENTDATE>${invoiceDateFormatted}</INSTRUMENTDATE>
                  <NAME>e216acbc-d76e-48a7-a6e7-30a843e73917</NAME>
                  <TRANSACTIONTYPE>Cheque</TRANSACTIONTYPE>
                  <CHEQUECROSSCOMMENT>A/c Payee</CHEQUECROSSCOMMENT>
                  <UNIQUEREFERENCENUMBER>5uXBl9T4CKj659i6</UNIQUEREFERENCENUMBER>
                  <STATUS>No</STATUS>
                  <PAYMENTMODE>Transacted</PAYMENTMODE>
                  <AMOUNT>${amount}</AMOUNT>
                </BANKALLOCATIONS.LIST>
              </ALLLEDGERENTRIES.LIST>
              <ALLLEDGERENTRIES.LIST>
                <OLDAUDITENTRYIDS.LIST TYPE="Number">
                  <OLDAUDITENTRYIDS>-1</OLDAUDITENTRYIDS>
                </OLDAUDITENTRYIDS.LIST>
                <LEDGERNAME>${DrLedger}</LEDGERNAME>
                <GSTCLASS/>
                <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
                <LEDGERFROMITEM>No</LEDGERFROMITEM>
                <REMOVEZEROENTRIES>No</REMOVEZEROENTRIES>
                <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
                <ISLASTDEEMEDPOSITIVE>Yes</ISLASTDEEMEDPOSITIVE>
                <AMOUNT>-${amount}</AMOUNT>
                <BANKALLOCATIONS.LIST>
                  <DATE>${invoiceDateFormatted}</DATE>
                  <INSTRUMENTDATE>${invoiceDateFormatted}</INSTRUMENTDATE>
                  <NAME>e216acbc-d76e-48a7-a6e7-30a843e73917</NAME>
                  <TRANSACTIONTYPE>Cheque</TRANSACTIONTYPE>
                  <BANKNAME>${CrLedger}</BANKNAME>
                  <CHEQUECROSSCOMMENT>A/c Payee</CHEQUECROSSCOMMENT>
                  <UNIQUEREFERENCENUMBER>5uXBl9T4CKj659i6</UNIQUEREFERENCENUMBER>
                  <PAYMENTMODE>Transacted</PAYMENTMODE>
                  <AMOUNT>-${amount}</AMOUNT>
                </BANKALLOCATIONS.LIST>
              </ALLLEDGERENTRIES.LIST>
            </VOUCHER>
          </TALLYMESSAGE>
          <TALLYMESSAGE xmlns:UDF="TallyUDF">
            <COMPANY>
              <REMOTECMPINFO.LIST MERGE="Yes">
                <NAME>899112ee-c1a5-4b29-9ed2-fc061b58f587</NAME>
                <REMOTECMPNAME>Demo</REMOTECMPNAME>
                <REMOTECMPSTATE>Maharashtra</REMOTECMPSTATE>
              </REMOTECMPINFO.LIST>
            </COMPANY>
          </TALLYMESSAGE>
        </REQUESTDATA>
      </IMPORTDATA>
    </BODY>
  </ENVELOPE>
      `.trim();

  return xml;
}

function buildTallyXmlContra(row) {
  let {
    companyName,
    invoiceDate,
    effectiveDate,
    narration,
    DrLedger,
    CrLedger,
    amount,
    voucherName,
  } = row;

  companyName = companyName ? companyName.replace(/&/g, "&amp;") : companyName;
  narration = narration ? narration.replace(/&/g, "&amp;") : narration;
  DrLedger = DrLedger ? DrLedger.replace(/&/g, "&amp;") : DrLedger;
  CrLedger = CrLedger ? CrLedger.replace(/&/g, "&amp;") : CrLedger;

  const xml = `
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>All Masters</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${companyName}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER REMOTEID="" VCHKEY="" VCHTYPE="Contra" ACTION="Create" OBJVIEW="Accounting Voucher View">
            <OLDAUDITENTRYIDS.LIST TYPE="Number">
              <OLDAUDITENTRYIDS>-1</OLDAUDITENTRYIDS>
            </OLDAUDITENTRYIDS.LIST>
            <DATE>${invoiceDate}</DATE>
            <NARRATION>${narration}</NARRATION>
            <VCHSTATUSDATE>${invoiceDate}</VCHSTATUSDATE>
            <VOUCHERTYPENAME>Contra</VOUCHERTYPENAME>
            <PARTYLEDGERNAME>${CrLedger}</PARTYLEDGERNAME>
            <VOUCHERNUMBER>1</VOUCHERNUMBER>
            <PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>
            <VCHSTATUSVOUCHERTYPE>Contra</VCHSTATUSVOUCHERTYPE>
            <EFFECTIVEDATE>${effectiveDate}</EFFECTIVEDATE>
            <ISELIGIBLEFORITC>Yes</ISELIGIBLEFORITC>
            <HASCASHFLOW>Yes</HASCASHFLOW>
            <ISPOSTDATED>No</ISPOSTDATED>
            <ALTERID> 1</ALTERID>
            <MASTERID> 1</MASTERID>
            <VOUCHERKEY>194914205827080</VOUCHERKEY>
            <VOUCHERRETAINKEY>1</VOUCHERRETAINKEY>
            <ALLLEDGERENTRIES.LIST>
              <OLDAUDITENTRYIDS.LIST TYPE="Number">
                <OLDAUDITENTRYIDS>-1</OLDAUDITENTRYIDS>
              </OLDAUDITENTRYIDS.LIST>
              <LEDGERNAME>${CrLedger}</LEDGERNAME>
              
              <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
              <AMOUNT>${amount}</AMOUNT>
              
              <BANKALLOCATIONS.LIST>
                <DATE>${invoiceDate}</DATE>
                <INSTRUMENTDATE>${invoiceDate}</INSTRUMENTDATE>
                <TRANSACTIONTYPE>Cheque</TRANSACTIONTYPE>
                <PAYMENTFAVOURING>Self</PAYMENTFAVOURING>
                <PAYMENTMODE>Transacted</PAYMENTMODE>
                <AMOUNT>${amount}</AMOUNT>
              </BANKALLOCATIONS.LIST>
            </ALLLEDGERENTRIES.LIST>
            
            <ALLLEDGERENTRIES.LIST>
              <OLDAUDITENTRYIDS.LIST TYPE="Number">
                <OLDAUDITENTRYIDS>-1</OLDAUDITENTRYIDS>
              </OLDAUDITENTRYIDS.LIST>
              <LEDGERNAME>${DrLedger}</LEDGERNAME>
              <NAME>e216acbc-d76e-48a7-a6e7-30a843e73917</NAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>

              <GSTOVERRIDDEN>No</GSTOVERRIDDEN>
              <ISLASTDEEMEDPOSITIVE>Yes</ISLASTDEEMEDPOSITIVE>
              <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
              <ISLASTDEEMEDPOSITIVE>Yes</ISLASTDEEMEDPOSITIVE>
              <AMOUNT>-${amount}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <TALLYMESSAGE xmlns:UDF="TallyUDF">
              <COMPANY>
                <REMOTECMPINFO.LIST MERGE="Yes">
                  <NAME>899112ee-c1a5-4b29-9ed2-fc061b58f587</NAME>
                  <REMOTECMPNAME>Demo</REMOTECMPNAME>
                  <REMOTECMPSTATE>Maharashtra</REMOTECMPSTATE>
                </REMOTECMPINFO.LIST>
              </COMPANY>
            </TALLYMESSAGE>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`.trim();

  return xml;
}

function buildTallyPrimeLedgerXml({
  ledgerName,
  ledgerGroup,
  GSTnum,
  Address,
  pincode,
  state,
  country,
  openingBalance,
  date,
  companyName,
}) {
  companyName = companyName ? companyName.replace(/&/g, "&amp;") : companyName;
  ledgerName = ledgerName ? ledgerName.replace(/&/g, "&amp;") : ledgerName;
  ledgerGroup = ledgerGroup ? ledgerGroup.replace(/&/g, "&amp;") : ledgerGroup;
  state = state ? state.replace(/&/g, "&amp;") : state;
  Address = Address ? Address.replace(/&/g, "&amp;") : Address;
  country = country ? country.replace(/&/g, "&amp;") : country;
  GSTnum = GSTnum ? GSTnum.replace(/&/g, "&amp;") : GSTnum;

  return `
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>All Masters</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${companyName}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <LEDGER NAME="${ledgerName}" RESERVEDNAME="">
            <OLDAUDITENTRYIDS.LIST TYPE="Number">
              <OLDAUDITENTRYIDS>-1</OLDAUDITENTRYIDS>
            </OLDAUDITENTRYIDS.LIST>
            <PRIORSTATENAME>${state}</PRIORSTATENAME>
            <VATDEALERTYPE>Regular</VATDEALERTYPE>
            <PARENT>${ledgerGroup}</PARENT>
            <COUNTRYOFRESIDENCE>${country}</COUNTRYOFRESIDENCE>
            <ASORIGINAL>Yes</ASORIGINAL>
            <AUDITED>No</AUDITED>
            <OPENINGBALANCE>-${openingBalance}</OPENINGBALANCE>
            <LANGUAGENAME.LIST>
              <NAME.LIST TYPE="String">
                <NAME>${ledgerName}</NAME>
              </NAME.LIST>
              <LANGUAGEID>1033</LANGUAGEID>
            </LANGUAGENAME.LIST>
            <LEDGSTREGDETAILS.LIST>
              <APPLICABLEFROM>${date}</APPLICABLEFROM>
              <GSTREGISTRATIONTYPE>Regular</GSTREGISTRATIONTYPE>
              <PLACEOFSUPPLY>${state}</PLACEOFSUPPLY>
              <GSTIN>${GSTnum}</GSTIN>
            </LEDGSTREGDETAILS.LIST>
            <LEDMAILINGDETAILS.LIST>
              <ADDRESS.LIST TYPE="String">
                <ADDRESS>${Address}</ADDRESS>
              </ADDRESS.LIST>
              <APPLICABLEFROM>${date}</APPLICABLEFROM>
              <PINCODE>${pincode}</PINCODE>
              <MAILINGNAME>${ledgerName}</MAILINGNAME>
              <STATE>${state}</STATE>
              <COUNTRY>${country}</COUNTRY>
            </LEDMAILINGDETAILS.LIST>
          </LEDGER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>
  `;
}

function buildTallyERPLedgerXml({
  ledgerName,
  ledgerGroup,
  GSTnum,
  Address,
  pincode,
  state,
  country,
  openingBalance,
  invoiceDate,
  companyName,
}) {
  companyName = companyName ? companyName.replace(/&/g, "&amp;") : companyName;
  ledgerName = ledgerName ? ledgerName.replace(/&/g, "&amp;") : ledgerName;
  ledgerGroup = ledgerGroup ? ledgerGroup.replace(/&/g, "&amp;") : ledgerGroup;
  state = state ? state.replace(/&/g, "&amp;") : state;
  Address = Address ? Address.replace(/&/g, "&amp;") : Address;
  country = country ? country.replace(/&/g, "&amp;") : country;
  GSTnum = GSTnum ? GSTnum.replace(/&/g, "&amp;") : GSTnum;

  return `

  <ENVELOPE>
  <HEADER>
   <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
   <IMPORTDATA>
    <REQUESTDESC>
     <REPORTNAME>All Masters</REPORTNAME>
     <STATICVARIABLES>
      <SVCURRENTCOMPANY>${companyName}</SVCURRENTCOMPANY>
     </STATICVARIABLES>
    </REQUESTDESC>
    <REQUESTDATA>
     <TALLYMESSAGE xmlns:UDF="TallyUDF">
      <LEDGER NAME="${ledgerName}" RESERVEDNAME="">
       <ADDRESS.LIST TYPE="String">
        <ADDRESS>${Address}</ADDRESS>
       </ADDRESS.LIST>
       <MAILINGNAME.LIST TYPE="String">
        <MAILINGNAME>${ledgerName}</MAILINGNAME>
       </MAILINGNAME.LIST>
       <OLDAUDITENTRYIDS.LIST TYPE="Number">
        <OLDAUDITENTRYIDS>-1</OLDAUDITENTRYIDS>
       </OLDAUDITENTRYIDS.LIST>
       <STARTINGFROM>${invoiceDate}</STARTINGFROM>
       <PRIORSTATENAME>${state}</PRIORSTATENAME>
       <PINCODE>${pincode}</PINCODE>
       <COUNTRYNAME>${country}</COUNTRYNAME>
       <VATDEALERTYPE>Regular</VATDEALERTYPE>
       <PARENT>${ledgerGroup}</PARENT>
       <TAXCLASSIFICATIONNAME/>
       <TAXTYPE>Others</TAXTYPE>
       <COUNTRYOFRESIDENCE>${country}</COUNTRYOFRESIDENCE>
       <GSTTYPE/>
       <APPROPRIATEFOR/>
       <PARTYGSTIN>${GSTnum}</PARTYGSTIN>
       <LEDSTATENAME>${state}</LEDSTATENAME>
       <EXCISELEDGERCLASSIFICATION/>
       <EXCISEDUTYTYPE/>
       <EXCISENATUREOFPURCHASE/>
       <LEDGERFBTCATEGORY/>
       <BANKACCHOLDERNAME>Ledger</BANKACCHOLDERNAME>
       <ISBILLWISEON>Yes</ISBILLWISEON>
       <ASORIGINAL>Yes</ASORIGINAL>
       <ISCHEQUEPRINTINGENABLED>Yes</ISCHEQUEPRINTINGENABLED>
       <SORTPOSITION>${-openingBalance}</SORTPOSITION>
       <OPENINGBALANCE>${-openingBalance}</OPENINGBALANCE>
       <LANGUAGENAME.LIST>
        <NAME.LIST TYPE="String">
         <NAME>${ledgerName}</NAME>
        </NAME.LIST>
       </LANGUAGENAME.LIST>
      </LEDGER>
     </TALLYMESSAGE>
    </REQUESTDATA>
   </IMPORTDATA>
  </BODY>
 </ENVELOPE>
  `;
}

function buildTallyXmlGetAllLedgers({ companyName }) {
  return `
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Export Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>List of Masters</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${companyName}</SVCURRENTCOMPANY>
          <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        </STATICVARIABLES>
        <FILTERS>
          <FILTER NAME="MasterType">
            <PARAMS>
              <PARAM NAME="MasterType">Ledger</PARAM>
            </PARAMS>
          </FILTER>
        </FILTERS>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>
  `.trim();
}

async function fetchLedgerData(companyName) {
  // Define the XML request payload
  const xmlInput = `
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Export Data</TALLYREQUEST>
     <STATICVARIABLES>
          <SVCURRENTCOMPANY>${companyName}</SVCURRENTCOMPANY>
          <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        </STATICVARIABLES>
  </HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>List of Accounts</REPORTNAME>
        <STATICVARIABLES>
          <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
          <SVFROMDATE>01-Apr-2023</SVFROMDATE>
          <SVTODATE>31-Mar-2024</SVTODATE>
        </STATICVARIABLES>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>
`;

  try {
    // Send the POST request to the Tally server
    const response = await fetch("http://localhost:9000", {
      method: "POST",
      headers: { "Content-Type": "text/xml" },
      body: xmlInput,
    });

    // Get the XML response as text
    const xmlOutput = await response.text();

    // Parse the XML response using DOMParser
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlOutput, "text/xml");

    // Array to hold the ledger data
    const ledgerData = [];

    // Get all TALLYMESSAGE elements
    const tallyMessages = xmlDoc.getElementsByTagName("TALLYMESSAGE");
    for (let i = 0; i < tallyMessages.length; i++) {
      const tallyMessage = tallyMessages[i];

      // Check if this TALLYMESSAGE contains a LEDGER node
      const ledgerNodes = tallyMessage.getElementsByTagName("LEDGER");
      if (ledgerNodes.length > 0) {
        const ledger = ledgerNodes[0];

        // Helper function to get text content from a given tag
        const getText = (tagName) => {
          const node = ledger.getElementsByTagName(tagName)[0];
          return node ? node.textContent : "";
        };

        // Extract ledger details and replace encoded ampersands if needed
        let ledgerName = getText("NAME").replace(/&amp;/g, "&");
        let ledgerGroup = getText("PARENT").replace(/&amp;/g, "&");
        let GSTNumber = getText("GSTIN");
        let state = getText("PLACEOFSUPPLY");
        let country = getText("COUNTRYOFRESIDENCE");
        let openingBalance = getText("OPENINGBALANCE");

        // Store the ledger details
        ledgerData.push({
          ledgerName,
          ledgerGroup,
          GSTNumber,
          state,
          country,
          openingBalance,
        });
      }
    }

    // Output the ledger data (you can process or write to a file as needed)
    return ledgerData;
  } catch (error) {
    console.error("Error fetching ledger data:", error);
  }
}

module.exports = {
  buildTallyXmlPayment,
  buildTallyXmlReceipt,
  buildTallyXmlContra,
  buildTallyPrimeLedgerXml,
  buildTallyERPLedgerXml,
  buildTallyXmlGetAllLedgers,
  fetchLedgerData,
};
