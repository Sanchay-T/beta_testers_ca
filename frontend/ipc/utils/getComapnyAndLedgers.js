const { DOMParser } = require("xmldom");
// Function to escape special characters for XML
function escapeXML(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Fetch list of companies using the working XML from Postman
async function fetchCompanyList(port) {
  const xmlInput = `
<ENVELOPE>
	<HEADER>
		<VERSION>1</VERSION>
		<TALLYREQUEST>Export</TALLYREQUEST>
		<TYPE>Collection</TYPE>
		<ID>List of Companies</ID>
	</HEADER>
	<BODY>
		<DESC>
			<STATICVARIABLES>
				<SVIsSimpleCompany>No</SVIsSimpleCompany>
			</STATICVARIABLES>
			<TDL>
				<TDLMESSAGE>
					<COLLECTION ISMODIFY="No" ISFIXED="No" ISINITIALIZE="Yes" ISOPTION="No" ISINTERNAL="No" NAME="List of Companies">
						<TYPE>Company</TYPE>
						<NATIVEMETHOD>Name</NATIVEMETHOD>
					</COLLECTION>
					<ExportHeader>EmpId:5989</ExportHeader>
				</TDLMESSAGE>
			</TDL>
		</DESC>
	</BODY>
</ENVELOPE>
`;

  try {
    console.log("Fetching list of companies...");
    const response = await fetch(`http://localhost:${port}`, {
      method: "POST",
      headers: { "Content-Type": "text/xml" },
      body: xmlInput,
    });

    const xmlOutput = await response.text();
    console.log("Raw Company XML:\n", xmlOutput);
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlOutput, "text/xml");

    // In the working XML, companies are within <DATA><COLLECTION>
    const companies = [];
    const dataNode = xmlDoc.getElementsByTagName("DATA")[0];
    if (dataNode) {
      const collectionNode = dataNode.getElementsByTagName("COLLECTION")[0];
      if (collectionNode) {
        const companyNodes = collectionNode.getElementsByTagName("COMPANY");
        for (let i = 0; i < companyNodes.length; i++) {
          const companyNode = companyNodes[i];
          // Use the NAME attribute (as seen in the XML sample)
          const nameAttr = companyNode.getAttribute("NAME");
          if (nameAttr) {
            companies.push(nameAttr.trim());
          } else {
            // Fallback: check for an inner <NAME> tag if needed
            const nameTags = companyNode.getElementsByTagName("NAME");
            if (nameTags.length > 0) {
              companies.push(nameTags[0].textContent.trim());
            }
          }
        }
      }
    }
    console.log("Active Companies:", companies);
    return companies;
  } catch (error) {
    console.error("Error fetching company list:", error);
    return [];
  }
}

// Fetch ledger data for a specific company
async function fetchLedgerDataForCompany(companyName, port) {
  const escapedCompanyName = escapeXML(companyName);

  const xmlInput = `
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Export Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>List of Accounts</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${escapedCompanyName}</SVCURRENTCOMPANY>
          <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
          <SVFROMDATE></SVFROMDATE>
          <SVTODATE></SVTODATE>
        </STATICVARIABLES>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>
`;

  try {
    console.log(`Fetching ledger data for company: ${companyName}...`);
    const response = await fetch(`http://localhost:${port}`, {
      method: "POST",
      headers: { "Content-Type": "text/xml" },
      body: xmlInput,
    });

    const xmlOutput = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlOutput, "text/xml");
    const ledgerData = [];

    const tallyMessages = xmlDoc.getElementsByTagName("TALLYMESSAGE");
    for (let i = 0; i < tallyMessages.length; i++) {
      const tallyMessage = tallyMessages[i];
      const ledgerNodes = tallyMessage.getElementsByTagName("LEDGER");
      if (ledgerNodes.length > 0) {
        const ledger = ledgerNodes[0];

        const getText = (tagName) => {
          const node = ledger.getElementsByTagName(tagName)[0];
          return node ? node.textContent.trim() : "";
        };

        let ledgerName = getText("NAME").replace(/&amp;/g, "&");
        let ledgerGroup = getText("PARENT").replace(/&amp;/g, "&");

        let GSTNumber = getText("GSTIN").trim(); // Prime
        if (GSTNumber === "") {
          GSTNumber = getText("PARTYGSTIN").trim(); // ERP
        }

        let state = getText("PLACEOFSUPPLY").trim(); // Prime
        if (state === "") {
          state = getText("LEDSTATENAME").trim(); // ERP
        }

        let country = getText("COUNTRYOFRESIDENCE");
        let openingBalance = getText("OPENINGBALANCE");

        ledgerData.push({
          ledgerName: ledgerName,
          ledgerGroup: ledgerGroup,
          GSTNumber: GSTNumber,
          state: state,
          country: country,
          openingBalance: openingBalance,
        });
      }
    }
    // console.log(`Ledger Data for ${companyName}:`, ledgerData);
    return ledgerData;
  } catch (error) {
    console.error(`Error fetching ledger data for ${companyName}:`, error);
    return [];
  }
}

// Main function: fetch company list and then fetch ledger data for each company
async function fetchLedgersForAllCompanies(port) {
  const companies = await fetchCompanyList(port);
  const allLedgerData = [];

  for (const companyName of companies) {
    console.log(`Fetching ledger data for company: ${companyName}`);
    const ledgerData = await fetchLedgerDataForCompany(companyName, port);
    allLedgerData.push({ companyName, ledgerData });
  }

  //   console.log("All Ledger Data:", JSON.stringify(allLedgerData, null, 2));
  return allLedgerData;
}

module.exports = {
  fetchLedgersForAllCompanies,
};
