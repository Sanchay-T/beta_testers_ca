import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

// Main function to create multi-sheet Excel file

function mapDataForExcelGenerator(accountsData, summaryObject, individualId) {
  // Helper function to convert object keys to camelCase
  const toCamelCase = (str) =>
    str
      .replace(/\s(.)/g, (match) => match.toUpperCase()) // Convert space-letter to uppercase
      .replace(/\s/g, "") // Remove spaces
      .replace(/^(.)/, (match) => match.toLowerCase()); // Ensure first letter is lowercase

  // Convert summaryObject keys to camelCase if individualId exists
  let formattedSummaryObject = summaryObject;
  if (individualId) {
    formattedSummaryObject = Object.keys(summaryObject).reduce((acc, key) => {
      acc[toCamelCase(key)] = summaryObject[key];
      return acc;
    }, {});
  }

  console.log("Formatted summaryObject:", formattedSummaryObject);

  // Helper function to convert the format of each table
  const reformatTable = (tableData) => {
    if (!tableData || !Array.isArray(tableData)) return [];

    return tableData.map((item) => {
      const newItem = {
        Particulars:
          item[
            Object.keys(item).find(
              (key) =>
                key.includes("Payments") ||
                key.includes("Particulars") ||
                key.includes("Receipts") ||
                key.includes("Credit") ||
                key.includes("Debit")
            )
          ],
      };

      // Add all month data and "Total" column
      Object.keys(item).forEach((key) => {
        if (key.includes("-202") || key === "Total") {
          newItem[key] = item[key];
        }
      });

      return newItem;
    });
  };

  return {
    accountsData,
    summaryObject: {
      particulars: reformatTable(formattedSummaryObject.particulars || []),
      incomeReceipts: reformatTable(
        formattedSummaryObject.incomeReceipts || []
      ),
      importantExpenses: reformatTable(
        formattedSummaryObject.importantExpenses || []
      ),
      otherExpenses: reformatTable(formattedSummaryObject.otherExpenses || []),
      contraCredit: reformatTable(formattedSummaryObject.contraCredit || []),
      contraDebit: reformatTable(formattedSummaryObject.contraDebit || []),
    },
  };
}

const EodformatData = (data) => {
  try {
    // Parse JSON if it's a string
    if (typeof data === "string") {
      data = JSON.parse(data);
    }

    // Ensure data is an object and contains the expected array
    const extractedData = data;
    if (!Array.isArray(extractedData)) {
      console.error("Error: Data is not an array", extractedData);
      return [];
    }

    return extractedData.map((entry) => {
      let formattedEntry = { ...entry };

      // Format all numeric values except the "Day" column
      Object.keys(formattedEntry).forEach((key) => {
        if (key !== "Day" && typeof formattedEntry[key] === "string") {
          // Convert string numbers to actual numbers for Excel formatting
          formattedEntry[key] = parseFloat(formattedEntry[key]);
        }
      });

      return formattedEntry;
    });
  } catch (error) {
    console.error("Error parsing JSON:", error);
    return [];
  }
};
const processSuspenseData = (transactions) => {
  return transactions.map((transaction) => ({
    date: new Date(transaction.date).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
    description: transaction.description,
    credit:
      transaction.type.toLowerCase() === "credit" ? transaction.amount : 0,
    debit: transaction.type.toLowerCase() === "debit" ? transaction.amount : 0,
    balance: transaction.balance,
    category: transaction.category,
    id: transaction.id,
  }));
};

function formatVoucherTransaction(data) {
  try {
    // const data = await window.electron.getTallyVoucherTransactions(
    //   caseId,
    //   newVoucher || selectedVoucher
    // );
    // Sort, map, etc. as you did before
    const sortedData = data.sort((a, b) => a.imported - b.imported);

    const storedReasons = JSON.parse(
      localStorage.getItem("failedTransactions") || "{}"
    );

    const formattedData = sortedData
      .map((transaction) => {
        if (transaction.voucher_type === "unknown") return null;

        return {
          date: new Date(transaction.date).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          }),
          effective_date: "",
          // reference_number: "",
          bill_reference: "",
          dr_ledger:
            transaction.type === "debit"
              ? transaction.entity !== "unknown"
                ? transaction.entity
                : transaction.category
              : "",
          cr_ledger:
            transaction.type === "credit"
              ? transaction.entity !== "unknown"
                ? transaction.entity
                : transaction.category
              : "",
          amount: transaction.amount,
          voucher_type: transaction.voucher_type,
          narration: transaction.description,
          id: transaction.id,
          imported: transaction.imported === 1,
          failed_reason: storedReasons[transaction.id] || "",
        };
      })
      .filter((t) => t !== null);

    return formattedData;
    //   if (newVoucher === "Contra Voucher"){
    //   const contraFormatted = formattedData.map((transaction) => {
    //     return {
    //       date: transaction.date,
    //       dr_ledger: transaction.dr_ledger,
    //       cr_ledger: transaction.cr_ledger,
    //       amount: transaction.amount,
    //       narration: transaction.narration,
    //       voucher_type: transaction.voucher_type,
    //       id: transaction.id,
    //       imported: transaction.imported,
    //       failed_reason: transaction.failed_reason
    //     }
    //   });
    //   setTransactions(contraFormatted);

    //   }else{
    //   setTransactions(formattedData);
    //   setBackupTransactions(formattedData);
    // }
  } catch (err) {
    console.error("Error fetching transactions:", err);
  }
}

const generateFinancialReport = async (
  caseid,
  individualId,
  caseName,
  summaryOnly = false
) => {
  try {
    const workbook = new ExcelJS.Workbook();

    // Fetch all required data
    let summaryData;
    if (individualId) {
      summaryData = await window.electron.getSummary(caseid, individualId);
      console.log("summaryData idnividual", summaryData[0].data);
    } else {
      summaryData = await window.electron.getSummary(caseid);
      console.log("summaryData combined", summaryData[0].data);
    }
    const summaryObject = JSON.parse(summaryData[0].data);
    console.log("summaryObject", summaryObject);
    let getStatements;
    let accountsData;
    if (individualId) {
      getStatements = await window.electron.getSingleStatement(individualId);
      accountsData = getStatements.map((statement) => ({
        accountNumber: statement.accountNumber,
        customerName: statement.customerName,
        bankName: statement.bankName,
      }));
    } else {
      getStatements = await window.electron.getStatements(caseid);
      accountsData = getStatements.map((statement) => ({
        accountNumber: statement.accountNumber,
        customerName: statement.customerName,
        bankName: statement.bankName,
      }));
    }

    // Map the data to the required format
    let mappedData;
    if (individualId) {
      mappedData = mapDataForExcelGenerator(
        accountsData,
        summaryObject,
        individualId
      );
      console.log("mappedData idnividual", mappedData);
    } else {
      mappedData = mapDataForExcelGenerator(accountsData, summaryObject);
      console.log("mappedData combined", mappedData);
    }

    const opportunityToEarnData =
      await window.electron.getOpportunityToEarnForExcel(caseid);
    const EodData = await window.electron.getEodBalance(caseid);
    const formattedEodData = EodformatData(EodData[0].data);
    const transactionsData = await window.electron.getTransactions(caseid);
    const investmentData = await window.electron.getTransactionsByInvestment(
      caseid
    );
    const creditorsData = await window.electron.getTransactionsByCreditor(
      caseid
    );
    const debtorsData = await window.electron.getTransactionsByDebtor(caseid);
    const upiCrData = await window.electron.getTransactionsByUpiCr(caseid);
    const upiDrData = await window.electron.getTransactionsByUpiDr(caseid);
    const cashWithdrawalData =
      await window.electron.getTransactionsByCashWithdrawal(caseid);
    const cashDepositData = await window.electron.getTransactionsByCashDeposit(
      caseid
    );
    const ProbableEmiData = await window.electron.getTransactionsByEmi(caseid);
    const reversalData = await window.electron.getTransactionsByReversal(
      caseid
    );

    const suspensecredit =
      await window.electron.getTransactionsBySuspenseCredit(caseid);
    const transformCreditData = processSuspenseData(suspensecredit);

    const suspensedebit = await window.electron.getTransactionsBySuspenseDebit(
      caseid
    );
    const transformDebitData = processSuspenseData(suspensedebit);
    const redemptionData = await window.electron.getTransactionsByRedemption(
      caseid
    );
    const voucherTransaction = await window.electron.getTransactions(caseid);
    const formatVoucherData = formatVoucherTransaction(voucherTransaction);

    // Add each sheet with the same pattern but different data
    addSummarySheet(workbook, mappedData);
    if (!summaryOnly) {
      addOpportunityToEarnSheet(workbook, opportunityToEarnData.data);
      addEodSheet(workbook, formattedEodData);
      addTransactionsSheet(workbook, transactionsData);
      addInvestmentSheet(workbook, investmentData);
      addCreditorsSheet(workbook, creditorsData);
      addDebtorsSheet(workbook, debtorsData);
      addUpiCrSheet(workbook, upiCrData);
      addUpiDrSheet(workbook, upiDrData);
      addCashWithdrawalSheet(workbook, cashWithdrawalData);
      addCashDepositSheet(workbook, cashDepositData);
      addProbableEmiSheet(workbook, ProbableEmiData);
      addReversalSheet(workbook, reversalData);
      addSuspenseCreditSheet(workbook, transformCreditData);
      addSuspenseDebitSheet(workbook, transformDebitData);
      addRedemptionSheet(workbook, redemptionData);
      addVoucherTransactionSheet(workbook, formatVoucherData);
    }
    // Generate and save the file
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const fileName = summaryOnly
      ? `${caseName} Summary Report.xlsx`
      : `${caseName} Report.xlsx`;

    saveAs(blob, fileName);

    return true;
  } catch (error) {
    console.error(
      `Error generating ${summaryOnly ? "summary" : "Excel"} report:`,
      error
    );
    return false;
  }
};

// Function to add the Summary sheet
const addSummarySheet = (workbook, data) => {
  console.log("data", data);
  const worksheet = workbook.addWorksheet("Summary");

  // Set tab color
  worksheet.properties.tabColor = { argb: "D9E1F2" };

  // Extract data from input
  const { accountsData, summaryObject } = data;
  console.log("summaryObject", summaryObject);
  if (
    !summaryObject ||
    !summaryObject.particulars ||
    summaryObject.particulars.length === 0
  ) {
    worksheet.addRow(["No summary data available"]);
    return;
  }

  // Dynamically get all months from the data
  const months = Object.keys(summaryObject.particulars[0] || {}).filter(
    (key) => key !== "Particulars"
  );
  console.log("months", months);

  // Dynamically set columns: "Particulars" + months + "Total"
  worksheet.columns = [
    { width: 30 }, // "Particulars"
    ...months.map(() => ({ width: 12 })), // Dynamic months
    // { width: 12 }, // "Total"
  ];

  // Set row heights
  worksheet.getRow(1).height = 20;
  worksheet.getRow(2).height = 20;

  // Create gray background for first two rows
  for (let i = 1; i <= months.length + 2; i++) {
    worksheet.getRow(1).getCell(i).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFD3D3D3" },
    };
    worksheet.getRow(2).getCell(i).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFD3D3D3" },
    };
  }

  // Account Info Header
  let rowIndex = 1;
  accountsData.forEach((account) => {
    worksheet.getRow(rowIndex).getCell(1).value = account.accountNumber;
    worksheet.getRow(rowIndex).getCell(2).value = account.customerName;
    worksheet.getRow(rowIndex).getCell(3).value = account.bankName;
    worksheet.getRow(rowIndex).eachCell((cell) => {
      cell.font = { bold: true };
    });
    rowIndex++;
  });

  // Leave an empty row before tables
  rowIndex++;

  // Define styles
  const headerStyle = {
    font: { bold: true, color: { argb: "FFFFFFFF" } },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "00004D" } },
    alignment: { horizontal: "center", vertical: "middle" },
  };

  const alternatingRowStyle = {
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "D9E1F2" } },
  };

  // Helper function to add a table
  const addTable = (title, data, startRow) => {
    if (!data || data.length === 0) return startRow;

    let row = startRow + 1;
    const subHeaderRow = worksheet.getRow(row);

    // Apply header style to all cells
    for (let i = 1; i <= months.length + 1; i++) {
      const cell = subHeaderRow.getCell(i);
      cell.fill = headerStyle.fill;
      cell.font = headerStyle.font;
      cell.alignment = headerStyle.alignment;
    }

    // Add table title
    subHeaderRow.getCell(1).value = title;

    // Add month headers dynamically
    months.forEach((month, index) => {
      subHeaderRow.getCell(index + 2).value = month;
    });

    // Add "Total" header
    // subHeaderRow.getCell(months.length + 2).value = "Total";

    // Add data rows
    data.forEach((item, index) => {
      row++;
      const dataRow = worksheet.getRow(row);
      dataRow.getCell(1).value = item.Particulars;

      // Apply alternating row color
      if (index % 2 === 0) {
        for (let i = 1; i <= months.length + 1; i++) {
          dataRow.getCell(i).fill = alternatingRowStyle.fill;
        }
      }

      // Add month values dynamically
      months.forEach((month, monthIndex) => {
        const cell = dataRow.getCell(monthIndex + 2);
        const value = parseFloat(item[month] || 0);
        cell.value = value;
        cell.numFmt = "0.00";
        cell.alignment = { horizontal: "right" };
      });

      // Calculate total dynamically
      const totalCell = dataRow.getCell(months.length + 2);
      totalCell.value = {
        formula: `SUM(B${row}:${String.fromCharCode(
          65 + months.length
        )}${row})`,
      };
      totalCell.numFmt = "0.00";
      totalCell.alignment = { horizontal: "right" };
    });

    return row;
  };

  // Add tables dynamically
  let currentRow = rowIndex;

  currentRow =
    addTable("Particulars", summaryObject.particulars, currentRow) + 1;
  currentRow =
    addTable("Income / Receipts", summaryObject.incomeReceipts, currentRow) + 1;
  currentRow =
    addTable(
      "Important Expenses / Payments",
      summaryObject.importantExpenses,
      currentRow
    ) + 1;
  currentRow =
    addTable(
      "Other Expenses / Payments",
      summaryObject.otherExpenses,
      currentRow
    ) + 1;
  currentRow =
    addTable("Contra Credit", summaryObject.contraCredit, currentRow) + 1;
  currentRow =
    addTable("Contra Debit", summaryObject.contraDebit, currentRow) + 1;

  // Disclaimer text
  const descriptionText =
    "Disclaimer: The entries throughout this file are based on best guess analysis. Variations may occur " +
    "based on customer transactions. Please verify with actual records.";

  const lastRow = worksheet.lastRow.number + 2;
  worksheet.getRow(lastRow).getCell(1).value = descriptionText;
  worksheet.getRow(lastRow).getCell(1).alignment = { wrapText: true };

  // Merge disclaimer cells
  worksheet.mergeCells(lastRow, 1, lastRow, months.length + 2);

  // Set worksheet as active
  worksheet.state = "visible";
  worksheet.views = [{ state: "normal", firstSheet: 0, activeTab: 0 }];
};

// Function to add the Opportunity to Earn sheet
const addOpportunityToEarnSheet = (workbook, transformData) => {
  const worksheet = workbook.addWorksheet("Opportunity to Earn");

  // Set tab color
  worksheet.properties.tabColor = { argb: "fef08a" };

  // Define headers
  const headers = [
    { label: "Product", key: "product", width: 40 },
    { label: "Amount", key: "amount", width: 15 },
    { label: "Commission %", key: "commissionPercentage", width: 15 },
    { label: "Commission (in Rs)", key: "commissionRs", width: 20 },
  ];

  worksheet.columns = headers.map((header) => ({
    header: header.label,
    key: header.key,
    width: header.width,
  }));

  const commissionRates = {
    homeLoanValue: 0.0045,
    loanAgainstProperty: 0.0065,
    businessLoan: 0.01,
    termPlan: "1%-30%",
    generalInsurance: "upto 10%",
  };
  const firstData = transformData[0] || {};

  const tableData = [
    {
      product: "Home Loan / Balance Transfer",
      amount: firstData.homeLoanValue
        ? firstData.homeLoanValue.toLocaleString()
        : "",
      commissionPercentage: "0.45%",
      commissionRs: firstData.homeLoanValue
        ? (firstData.homeLoanValue * commissionRates.homeLoanValue)
            .toFixed(2)
            .toLocaleString()
        : "",
    },
    {
      product: "Loan Against Property / Balance Transfer",
      amount: firstData.loanAgainstProperty
        ? firstData.loanAgainstProperty.toLocaleString()
        : "",
      commissionPercentage: "0.65%",
      commissionRs: firstData.loanAgainstProperty
        ? (firstData.loanAgainstProperty * commissionRates.loanAgainstProperty)
            .toFixed(2)
            .toLocaleString()
        : "",
    },
    {
      product: "Business Loan",
      amount: firstData.businessLoan
        ? firstData.businessLoan.toLocaleString()
        : "",
      commissionPercentage: "1.00%",
      commissionRs: firstData.businessLoan
        ? (firstData.businessLoan * commissionRates.businessLoan)
            .toFixed(2)
            .toLocaleString()
        : "",
    },
    {
      product: "Term Plan",
      amount: "",
      commissionPercentage: commissionRates.termPlan,
      commissionRs: "",
    },
    {
      product: "General Insurance",
      amount: "",
      commissionPercentage: commissionRates.generalInsurance,
      commissionRs: "",
    },
  ];

  // Add rows and apply formatting
  tableData.forEach((row, index) => {
    const newRow = worksheet.addRow(row);

    // Apply background color to cells for alternating rows
    if (index % 2 !== 0) {
      // Only apply the fill to the specific cells that contain data
      for (let i = 1; i <= headers.length; i++) {
        const cell = newRow.getCell(i);
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "D9E1F2" },
        };
      }
    }
  });

  // Format header row
  worksheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "00004D" },
    };
    cell.alignment = { horizontal: "center" };
  });
};

// Function to add the Transactions sheet
const addTransactionsSheet = (workbook, transactionData) => {
  const worksheet = workbook.addWorksheet("Transactions");

  // Set tab color
  worksheet.properties.tabColor = { argb: "0ea5e9" };

  // Define headers
  const headers = [
    { label: "Value Date", key: "date", width: 15 },
    { label: "Description", key: "description", width: 40 },
    { label: "Debit", key: "debit", width: 15 },
    { label: "Credit", key: "credit", width: 15 },
    { label: "Balance", key: "balance", width: 15 },
    { label: "Category", key: "category", width: 20 },
    { label: "Entity", key: "entity", width: 20 },
    { label: "Bank", key: "bank", width: 15 },
    { label: "Voucher type", key: "voucher_type", width: 15 },
  ];

  worksheet.columns = headers.map((header) => ({
    header: header.label,
    key: header.key,
    width: header.width,
  }));

  // Ensure transactionData is an array
  if (!Array.isArray(transactionData) || transactionData.length === 0) {
    console.warn("No transaction data available, adding placeholder row.");

    // Add a placeholder row if no transactions exist
    worksheet.addRow({
      date: "N/A",
      description: "No transactions available",
      debit: "",
      credit: "",
      balance: "",
      category: "",
      entity: "",
      bank: "",
      voucher_type: "",
    });
  } else {
    // Add data rows
    transactionData.forEach((row, index) => {
      let debitValue = row.type === "debit" ? row.amount || 0 : "";
      let creditValue = row.type === "credit" ? row.amount || 0 : "";

      const newRow = worksheet.addRow({
        date: row.date
          ? new Date(row.date).toLocaleDateString("en-GB").replace(/\//g, "-")
          : "",
        description: row.description || "",
        debit: debitValue,
        credit: creditValue,
        balance: row.balance || 0,
        category: row.category || "",
        entity: row.entity || "",
        bank: row.bank || "hdfc bank",
        voucher_type: row.voucher_type || "",
      });

      applyRowStyling(newRow, index);
    });
  }

  applyHeaderStyling(worksheet);
};

const addEodSheet = (workbook, data) => {
  const worksheet = workbook.addWorksheet("EOD");

  // Set tab color
  worksheet.properties.tabColor = { argb: "a3e635" };

  // Check if data is valid
  if (!Array.isArray(data) || data.length === 0) {
    console.warn("No EOD data available, adding placeholder message.");

    // Define a placeholder row
    worksheet.addRow(["No data available for EOD report"]).font = {
      bold: true,
      italic: true,
      color: { argb: "FF0000" }, // Red text to indicate no data
    };

    return;
  }

  // Extract column headers from the first data item
  const firstItem = data[0];
  const headers = Object.keys(firstItem);

  // Define columns dynamically based on data keys
  worksheet.columns = headers.map((header) => ({
    header: header,
    key: header,
    width: header === "Day" ? 10 : 15,
  }));

  // Add data rows
  data.forEach((row, index) => {
    const newRow = worksheet.addRow(row);

    // Apply alternating row colors
    if (index % 2 !== 0) {
      newRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "D9E1F2" },
      };
    }
  });

  // Format header row
  worksheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "00004D" },
    };
    cell.alignment = { horizontal: "center" };
  });
};

// Function to add the Investment sheet
const addInvestmentSheet = (workbook, transactionData) => {
  const worksheet = workbook.addWorksheet("Investment");

  // Set tab color
  worksheet.properties.tabColor = { argb: "ddd6fe" }; // Purple

  // Define headers
  const headers = [
    { label: "Value Date", key: "valueDate", width: 15 },
    { label: "Description", key: "description", width: 40 },
    // { label: "Entity", key: "entity", width: 15 },
    // { label: "Voucher type", key: "voucher_type", width: 15 },
    { label: "Debit", key: "debit", width: 15 },
    { label: "Credit", key: "credit", width: 15 },
    { label: "Balance", key: "balance", width: 15 },
    { label: "Category", key: "category", width: 15 },
    { label: "Bank", key: "bank", width: 15 },
    // { label: "Month", key: "month", width: 15 },
    // { label: "Date", key: "date", width: 10 }
  ];

  worksheet.columns = headers.map((header) => ({
    header: header.label,
    key: header.key,
    width: header.width,
  }));

  // Add data rows
  addStandardRowsWithMonthDay(worksheet, transactionData, "Investment");
  const descriptionText =
    "*This table reflects probable transactions in securities made during the year.\n\n" +
    "Kindly confirm the same from Annual Information Statement (AIS) reflected on the Income Tax Portal " +
    "and the capital gain reports sent by the respective authorities.";

  const lastRow = worksheet.lastRow.number + 2; // Leave some space after the table

  // First merge the cells
  worksheet.mergeCells(lastRow, 1, lastRow, worksheet.columnCount);

  // Then set the value and formatting for the merged cell
  const mergedCell = worksheet.getCell(`A${lastRow}`);
  mergedCell.value = descriptionText;
  mergedCell.alignment = {
    wrapText: true,
    vertical: "top",
    horizontal: "left",
  };

  // Set row height to accommodate the text
  worksheet.getRow(lastRow).height = 90;
  applyHeaderStyling(worksheet);
};

// Function to add the Creditors sheet
const addCreditorsSheet = (workbook, transactionData) => {
  const worksheet = workbook.addWorksheet("Creditors");

  // Set tab color
  worksheet.properties.tabColor = { argb: "fda4af" }; // Red

  // Define headers
  const headers = [
    { label: "Value Date", key: "valueDate", width: 15 },
    { label: "Description", key: "description", width: 40 },
    // { label: "Entity", key: "entity", width: 18 },
    // { label: "Voucher type", key: "voucher_type", width: 15 },
    { label: "Debit", key: "debit", width: 15 },
    { label: "Credit", key: "credit", width: 15 },
    { label: "Balance", key: "balance", width: 15 },
    { label: "Category", key: "category", width: 15 },
    { label: "Bank", key: "bank", width: 15 },
    // { label: "Month", key: "month", width: 15 },
    // { label: "Date", key: "date", width: 10 }
  ];

  worksheet.columns = headers.map((header) => ({
    header: header.label,
    key: header.key,
    width: header.width,
  }));

  // Add data rows
  addStandardRowsWithMonthDay(worksheet, transactionData, "Creditor");
  const descriptionText =
    "*The entries in this table likely pertain to payments from the parties during the period mentioned." +
    "In case of payments through online portals, we have mentioned the portal names as reflected in the narration of the bank statement. We would like to highlight that in case of contra entries, the name of the client ";

  const lastRow = worksheet.lastRow.number + 2; // Leave some space after the table

  // First merge the cells
  worksheet.mergeCells(lastRow, 1, lastRow, worksheet.columnCount);

  // Then set the value and formatting for the merged cell
  const mergedCell = worksheet.getCell(`A${lastRow}`);
  mergedCell.value = descriptionText;
  mergedCell.alignment = {
    wrapText: true,
    vertical: "top",
    horizontal: "left",
  };

  // Set row height to accommodate the text
  worksheet.getRow(lastRow).height = 90;
  applyHeaderStyling(worksheet);
};

// Function to add the Debtors sheet
const addDebtorsSheet = (workbook, transactionData) => {
  const worksheet = workbook.addWorksheet("Debtors");

  // Set tab color
  worksheet.properties.tabColor = { argb: "fecdd3" }; // Purple/Indigo

  // Define headers
  const headers = [
    { label: "Value Date", key: "valueDate", width: 15 },
    { label: "Description", key: "description", width: 40 },
    { label: "Debit", key: "debit", width: 15 },
    { label: "Credit", key: "credit", width: 15 },
    { label: "Balance", key: "balance", width: 15 },
    { label: "Category", key: "category", width: 15 },
    // { label: "Entity", key: "entity", width: 18 },
    { label: "Bank", key: "bank", width: 15 },
    // { label: "Voucher type", key: "voucher_type", width: 15 }
  ];

  worksheet.columns = headers.map((header) => ({
    header: header.label,
    key: header.key,
    width: header.width,
  }));

  // Add data rows
  if (Array.isArray(transactionData)) {
    transactionData.forEach((row, index) => {
      let debitValue = 0;
      let creditValue = 0;

      if (row.type === "debit") {
        debitValue = row.amount || 0;
      } else if (row.type === "credit") {
        creditValue = row.amount || 0;
      }

      const newRow = worksheet.addRow({
        valueDate: row.date
          ? new Date(row.date).toLocaleDateString("en-GB").replace(/\//g, "-")
          : "",
        description: row.description || "",
        debit: debitValue,
        credit: creditValue,
        balance: row.balance || 0,
        category: row.category || "Debtor",
        entity: row.entity || "Debtor List",
        bank: row.bank || "hdfc bank",
        voucherType: row.voucher_type || "Receipt",
      });

      applyRowStyling(newRow, index);
    });
  }

  const descriptionText =
    "*The entries in this table likely pertains to receipts from the respective parties." +
    "In case of receipts through online portals, we have mentioned the portal names as reflected in the narration of the bank statement.We would like to highlight that in case of contra entries, the name of the client will be reflected as a debtor.";

  const lastRow = worksheet.lastRow.number + 2; // Leave some space after the table

  // First merge the cells
  worksheet.mergeCells(lastRow, 1, lastRow, worksheet.columnCount);

  // Then set the value and formatting for the merged cell
  const mergedCell = worksheet.getCell(`A${lastRow}`);
  mergedCell.value = descriptionText;
  mergedCell.alignment = {
    wrapText: true,
    vertical: "top",
    horizontal: "left",
  };

  // Set row height to accommodate the text
  worksheet.getRow(lastRow).height = 90;

  applyHeaderStyling(worksheet);
};

// Function to add the UPI-CR sheet
const addUpiCrSheet = (workbook, transactionData) => {
  const worksheet = workbook.addWorksheet("UPI-CR");

  // Set tab color
  worksheet.properties.tabColor = { argb: "fed7aa" }; // Orange

  // Define headers
  const headers = [
    { label: "Value Date", key: "valueDate", width: 15 },
    { label: "Description", key: "description", width: 40 },
    // { label: "Entity", key: "entity", width: 18 },
    // { label: "Voucher type", key: "voucher_type", width: 15 },
    { label: "Debit", key: "debit", width: 15 },
    { label: "Credit", key: "credit", width: 15 },
    { label: "Balance", key: "balance", width: 15 },
    { label: "Category", key: "category", width: 15 },
    { label: "Bank", key: "bank", width: 15 },
    // { label: "Month", key: "month", width: 15 },
    // { label: "Date", key: "date", width: 10 }
  ];

  worksheet.columns = headers.map((header) => ({
    header: header.label,
    key: header.key,
    width: header.width,
  }));

  // Add data rows
  addStandardRowsWithMonthDay(worksheet, transactionData, "UPI-Cr", "Receipt");
  applyHeaderStyling(worksheet);
};

// Function to add the UPI-DR sheet
const addUpiDrSheet = (workbook, transactionData) => {
  const worksheet = workbook.addWorksheet("UPI-DR");

  // Set tab color
  worksheet.properties.tabColor = { argb: "bef264" }; // Green

  // Define headers
  const headers = [
    { label: "Value Date", key: "valueDate", width: 15 },
    { label: "Description", key: "description", width: 40 },
    // { label: "Entity", key: "entity", width: 18 },
    // { label: "Voucher type", key: "voucher_type", width: 15 },
    { label: "Debit", key: "debit", width: 15 },
    { label: "Credit", key: "credit", width: 15 },
    { label: "Balance", key: "balance", width: 15 },
    { label: "Category", key: "category", width: 15 },
    { label: "Bank", key: "bank", width: 15 },
    // { label: "Month", key: "month", width: 15 },
    // { label: "Date", key: "date", width: 10 }
  ];

  worksheet.columns = headers.map((header) => ({
    header: header.label,
    key: header.key,
    width: header.width,
  }));

  // Add data rows
  addStandardRowsWithMonthDay(worksheet, transactionData, "UPI-Dr");
  applyHeaderStyling(worksheet);
};

// Function to add the Cash Withdrawal sheet
const addCashWithdrawalSheet = (workbook, transactionData) => {
  const worksheet = workbook.addWorksheet("Cash Withdrawal");

  // Set tab color
  worksheet.properties.tabColor = { argb: "fed7aa" }; // Orange-Yellow

  // Define headers
  const headers = [
    { label: "Value Date", key: "valueDate", width: 15 },
    { label: "Description", key: "description", width: 40 },
    // { label: "Entity", key: "entity", width: 18 },
    // { label: "Voucher type", key: "voucher_type", width: 15 },
    { label: "Debit", key: "debit", width: 15 },
    { label: "Credit", key: "credit", width: 15 },
    { label: "Balance", key: "balance", width: 15 },
    { label: "Category", key: "category", width: 15 },
    { label: "Bank", key: "bank", width: 15 },
    // { label: "Month", key: "month", width: 15 },
    // { label: "Date", key: "date", width: 10 }
  ];

  worksheet.columns = headers.map((header) => ({
    header: header.label,
    key: header.key,
    width: header.width,
  }));

  const descriptionText =
    "*The above table reflects the cash withdrawals made during the year on the basis of widely used acronyms of the finance industry.";

  const lastRow = worksheet.lastRow.number + 2; // Leave some space after the table
  const descriptionRow = worksheet.getRow(lastRow);
  descriptionRow.getCell(1).value = descriptionText;
  descriptionRow.getCell(1).alignment = { wrapText: true };
  worksheet.mergeCells(lastRow, 1, lastRow, worksheet.columnCount);

  // Add data rows
  addStandardRowsWithMonthDay(worksheet, transactionData, "Cash-Withdrawal");
  applyHeaderStyling(worksheet);
};

const addCashDepositSheet = (workbook, data) => {
  const worksheet = workbook.addWorksheet("Cash Deposit");

  // Set tab color
  worksheet.properties.tabColor = { argb: "d1d5db" };

  // Define headers based on the image
  const headers = [
    { label: "Value Date", key: "valueDate", width: 15 },
    { label: "Description", key: "description", width: 40 },
    { label: "Debit", key: "debit", width: 15 },
    { label: "Credit", key: "credit", width: 15 },
    { label: "Balance", key: "balance", width: 15 },
    { label: "Category", key: "category", width: 15 },
    { label: "Entity", key: "entity", width: 18 },
    { label: "Bank", key: "bank", width: 15 },
    { label: "Voucher type", key: "voucherType", width: 15 },
  ];

  worksheet.columns = headers.map((header) => ({
    header: header.label,
    key: header.key,
    width: header.width,
  }));

  // Add data rows
  if (Array.isArray(data)) {
    data.forEach((row, index) => {
      // Determine debit and credit values based on type
      let debitValue = 0;
      let creditValue = 0;

      if (row.type === "debit") {
        debitValue = row.amount || 0;
      } else if (row.type === "credit") {
        creditValue = row.amount || 0;
      }

      const newRow = worksheet.addRow({
        valueDate: row.date
          ? new Date(row.date).toLocaleDateString("en-GB").replace(/\//g, "-")
          : "",
        description: row.description || "",
        debit: debitValue,
        credit: creditValue,
        balance: row.balance || 0,
        category: row.category || "Debtor", // Default to Debtor as shown in image
        entity: row.entity || "Debtor List",
        bank: row.bank || "hdfc bank",
        voucherType: row.voucher_type || "Receipt",
      });

      // Apply alternating row colors
      if (index % 2 !== 0) {
        newRow.eachCell((cell) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "D9E1F2" },
          };
        });
      }

      // Format number cells
      ["debit", "credit", "balance"].forEach((key) => {
        if (
          newRow.getCell(key).value !== null &&
          newRow.getCell(key).value !== undefined
        ) {
          newRow.getCell(key).numFmt = "#,##0.00";
        }
      });
    });
  }

  // Style header row
  worksheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "00004D" },
    };
    cell.alignment = { horizontal: "center" };
  });

  // const descriptionText =
  //     "*The above table reflects the cash deposits made during the year on the basis of widely used acronyms of the finance industry.";
  // const lastRow = worksheet.lastRow.number + 2; // Leave some space after the table
  // const descriptionRow = worksheet.getRow(lastRow);
  // descriptionRow.getCell(1).value = descriptionText;
  // descriptionRow.getCell(1).alignment = { wrapText: true };
  // worksheet.mergeCells(lastRow, 1, lastRow, worksheet.columnCount);
};

const addProbableEmiSheet = (workbook, data) => {
  const worksheet = workbook.addWorksheet("ProbableEmi");

  // Set tab color
  worksheet.properties.tabColor = { argb: "c4b5fd" };

  // Define headers based on the image
  const headers = [
    { label: "Value Date", key: "valueDate", width: 15 },
    { label: "Description", key: "description", width: 40 },
    { label: "Debit", key: "debit", width: 15 },
    { label: "Credit", key: "credit", width: 15 },
    { label: "Balance", key: "balance", width: 15 },
    { label: "Category", key: "category", width: 15 },
    { label: "Entity", key: "entity", width: 18 },
    { label: "Bank", key: "bank", width: 15 },
    { label: "Voucher type", key: "voucherType", width: 15 },
  ];

  worksheet.columns = headers.map((header) => ({
    header: header.label,
    key: header.key,
    width: header.width,
  }));

  // Add data rows
  if (Array.isArray(data)) {
    data.forEach((row, index) => {
      // Determine debit and credit values based on type
      let debitValue = 0;
      let creditValue = 0;

      if (row.type === "debit") {
        debitValue = row.amount || 0;
      } else if (row.type === "credit") {
        creditValue = row.amount || 0;
      }

      const newRow = worksheet.addRow({
        valueDate: row.date
          ? new Date(row.date).toLocaleDateString("en-GB").replace(/\//g, "-")
          : "",
        description: row.description || "",
        debit: debitValue,
        credit: creditValue,
        balance: row.balance || 0,
        category: row.category || "Debtor", // Default to Debtor as shown in image
        entity: row.entity || "Debtor List",
        bank: row.bank || "hdfc bank",
        voucherType: row.voucher_type || "Receipt",
      });

      // Apply alternating row colors
      if (index % 2 !== 0) {
        newRow.eachCell((cell) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "D9E1F2" },
          };
        });
      }

      // Format number cells
      ["debit", "credit", "balance"].forEach((key) => {
        if (
          newRow.getCell(key).value !== null &&
          newRow.getCell(key).value !== undefined
        ) {
          newRow.getCell(key).numFmt = "#,##0.00";
        }
      });
    });
  }

  // Style header row
  worksheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "00004D" },
    };
    cell.alignment = { horizontal: "center" };
  });

  const descriptionText =
    "* Transactions in the above table are based on the widely used acronyms of the finance industry and likely reflect EMI payment." +
    "Kindly confirm the same from the loan statement or the interest certificate.";

  const lastRow = worksheet.lastRow.number + 2; // Leave some space after the table

  // First merge the cells
  worksheet.mergeCells(lastRow, 1, lastRow, worksheet.columnCount);

  // Then set the value and formatting for the merged cell
  const mergedCell = worksheet.getCell(`A${lastRow}`);
  mergedCell.value = descriptionText;
  mergedCell.alignment = {
    wrapText: true,
    vertical: "top",
    horizontal: "left",
  };

  // Set row height to accommodate the text
  worksheet.getRow(lastRow).height = 90;
};

const addReversalSheet = (workbook, data) => {
  const worksheet = workbook.addWorksheet("Refund-Reversal");

  // Set tab color
  worksheet.properties.tabColor = { argb: "fef08a" };

  // Define headers based on the image
  const headers = [
    { label: "Value Date", key: "valueDate", width: 15 },
    { label: "Description", key: "description", width: 40 },
    { label: "Debit", key: "debit", width: 15 },
    { label: "Credit", key: "credit", width: 15 },
    { label: "Balance", key: "balance", width: 15 },
    { label: "Category", key: "category", width: 15 },
    { label: "Entity", key: "entity", width: 18 },
    { label: "Bank", key: "bank", width: 15 },
    { label: "Voucher type", key: "voucherType", width: 15 },
  ];

  worksheet.columns = headers.map((header) => ({
    header: header.label,
    key: header.key,
    width: header.width,
  }));

  // Add data rows
  if (Array.isArray(data)) {
    data.forEach((row, index) => {
      // Determine debit and credit values based on type
      let debitValue = 0;
      let creditValue = 0;

      if (row.type === "debit") {
        debitValue = row.amount || 0;
      } else if (row.type === "credit") {
        creditValue = row.amount || 0;
      }

      const newRow = worksheet.addRow({
        valueDate: row.date
          ? new Date(row.date).toLocaleDateString("en-GB").replace(/\//g, "-")
          : "",
        description: row.description || "",
        debit: debitValue,
        credit: creditValue,
        balance: row.balance || 0,
        category: row.category || "Debtor", // Default to Debtor as shown in image
        entity: row.entity || "Debtor List",
        bank: row.bank || "hdfc bank",
        voucherType: row.voucher_type || "Receipt",
      });

      // Apply alternating row colors
      if (index % 2 !== 0) {
        newRow.eachCell((cell) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "D9E1F2" },
          };
        });
      }

      // Format number cells
      ["debit", "credit", "balance"].forEach((key) => {
        if (
          newRow.getCell(key).value !== null &&
          newRow.getCell(key).value !== undefined
        ) {
          newRow.getCell(key).numFmt = "#,##0.00";
        }
      });
    });
  }

  // Style header row
  worksheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "00004D" },
    };
    cell.alignment = { horizontal: "center" };
  });
  const descriptionText =
    "*This table likely pertains to refunds/reversals/cashbacks received from card payments/online transactions.";

  const lastRow = worksheet.lastRow.number + 2; // Leave some space after the table
  const descriptionRow = worksheet.getRow(lastRow);
  descriptionRow.getCell(1).value = descriptionText;
  descriptionRow.getCell(1).alignment = { wrapText: true };
  worksheet.mergeCells(lastRow, 1, lastRow, worksheet.columnCount);
};

const addSuspenseCreditSheet = (workbook, data) => {
  const worksheet = workbook.addWorksheet("Suspense Credit");

  // Set tab color
  worksheet.properties.tabColor = { argb: "38bdf8" };

  // Define headers based on the image
  const headers = [
    { label: "Value Date", key: "valueDate", width: 15 },
    { label: "Description", key: "description", width: 40 },
    { label: "Credit", key: "credit", width: 15 },
  ];

  worksheet.columns = headers.map((header) => ({
    header: header.label,
    key: header.key,
    width: header.width,
  }));

  // Add data rows
  if (Array.isArray(data)) {
    data.forEach((row, index) => {
      // Determine debit and credit values based on type

      const newRow = worksheet.addRow({
        valueDate: row.date
          ? new Date(row.date).toLocaleDateString("en-GB").replace(/\//g, "-")
          : "",
        description: row.description || "",
        credit: row.credit || 0,
      });

      // Apply alternating row colors
      if (index % 2 !== 0) {
        newRow.eachCell((cell) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "D9E1F2" },
          };
        });
      }

      // Format number cells
      ["credit"].forEach((key) => {
        if (
          newRow.getCell(key).value !== null &&
          newRow.getCell(key).value !== undefined
        ) {
          newRow.getCell(key).numFmt = "#,##0.00";
        }
      });
    });

    const descriptionText =
      "*This table pertains to transactions unidentified as per the current ledger bifurcation of the software.\n\n" +
      "In case of any technical errors, inconvience is highly regretted and feedback is appreciated.";

    const lastRow = worksheet.lastRow.number + 2; // Leave some space after the table

    // First merge the cells
    worksheet.mergeCells(lastRow, 1, lastRow, worksheet.columnCount);

    // Then set the value and formatting for the merged cell
    const mergedCell = worksheet.getCell(`A${lastRow}`);
    mergedCell.value = descriptionText;
    mergedCell.alignment = {
      wrapText: true,
      vertical: "top",
      horizontal: "left",
    };

    // Set row height to accommodate the text
    worksheet.getRow(lastRow).height = 90;
  }

  // Style header row
  worksheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "00004D" },
    };
    cell.alignment = { horizontal: "center" };
  });
};

const addSuspenseDebitSheet = (workbook, data) => {
  const worksheet = workbook.addWorksheet("Suspense Debit");

  // Set tab color
  worksheet.properties.tabColor = { argb: "fed7aa" };

  // Define headers
  const headers = [
    { label: "Value Date", key: "valueDate", width: 15 },
    { label: "Description", key: "description", width: 40 },
    { label: "Debit", key: "debit", width: 15 },
  ];

  worksheet.columns = headers.map((header) => ({
    header: header.label,
    key: header.key,
    width: header.width,
  }));

  // Convert single object to array if needed
  const dataArray = Array.isArray(data) ? data : [data];

  // Add data rows
  dataArray.forEach((row, index) => {
    // Parse the date correctly
    let dateValue;
    if (row.date) {
      // Split the date string and create a proper Date object
      const dateParts = row.date.split("/");
      if (dateParts.length === 3) {
        // Create date in MM/DD/YYYY format for Excel
        dateValue = new Date(`${dateParts[1]}/${dateParts[0]}/${dateParts[2]}`);
      }
    }

    const newRow = worksheet.addRow({
      valueDate: dateValue || row.date, // Use parsed date if available
      description: row.description || "",
      debit: row.debit || 0,
    });

    // Set the actual date format for the cell
    if (dateValue && !isNaN(dateValue)) {
      newRow.getCell("valueDate").value = dateValue;
      newRow.getCell("valueDate").numFmt = "dd/mm/yyyy";
    }

    // Apply alternating row colors
    if (index % 2 !== 0) {
      newRow.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "D9E1F2" },
        };
      });
    }

    // Format number cells
    ["debit"].forEach((key) => {
      if (
        newRow.getCell(key).value !== null &&
        newRow.getCell(key).value !== undefined
      ) {
        newRow.getCell(key).numFmt = "#,##0.00";
      }
    });
  });

  // Style header row
  worksheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "00004D" },
    };
    cell.alignment = { horizontal: "center" };
  });

  const descriptionText =
    " *This table likely pertains to transactions unidentified as per the current ledger bifurcation of the software.";

  const lastRow = worksheet.lastRow.number + 2; // Leave some space after the table

  // First merge the cells
  worksheet.mergeCells(lastRow, 1, lastRow, worksheet.columnCount);

  // Then set the value and formatting for the merged cell
  const mergedCell = worksheet.getCell(`A${lastRow}`);
  mergedCell.value = descriptionText;
  mergedCell.alignment = {
    wrapText: true,
    vertical: "top",
    horizontal: "left",
  };

  // Set row height to accommodate the text
  worksheet.getRow(lastRow).height = 90;
};

const addRedemptionSheet = (workbook, transactionData) => {
  const worksheet = workbook.addWorksheet("Redemption, Dividend & Interest");

  // Set tab color
  worksheet.properties.tabColor = { argb: "a3e635" }; // Orange-Yellow

  // Define headers
  const headers = [
    { label: "Value Date", key: "valueDate", width: 15 },
    { label: "Description", key: "description", width: 40 },
    { label: "Balance", key: "balance", width: 15 },
    { label: "Category", key: "category", width: 15 },
    { label: "Entity", key: "entity", width: 18 },
    { label: "Bank", key: "bank", width: 15 },
    { label: "Voucher type", key: "voucher_type", width: 15 },
    { label: "Debit", key: "debit", width: 15 },
    { label: "Credit", key: "credit", width: 15 },
    { label: "Month", key: "month", width: 15 },
    { label: "Date", key: "date", width: 10 },
  ];

  worksheet.columns = headers.map((header) => ({
    header: header.label,
    key: header.key,
    width: header.width,
  }));

  // Add data rows
  addStandardRowsWithMonthDay(
    worksheet,
    transactionData,
    "Redemption, Dividend & Interest"
  );
  applyHeaderStyling(worksheet);
};

const addVoucherTransactionSheet = (workbook, transactionData) => {
  const worksheet = workbook.addWorksheet(
    "Tally Payment Receipt Contra Voucher Transactions"
  );

  // Set tab color
  worksheet.properties.tabColor = { argb: "#62e65a" }; // Orange-Yellow

  // Define headers
  const headers = [
    { label: "Date", key: "date", width: 15 },
    { label: "effective_date", key: "effective_date", width: 40 },
    { label: "bill_reference", key: "bill_reference", width: 15 },
    { label: "dr_ledger", key: "dr_ledger", width: 15 },
    { label: "cr_ledger", key: "cr_ledger", width: 18 },
    { label: "amount", key: "amount", width: 15 },
    { label: "Voucher type", key: "voucher_type", width: 15 },
    { label: "narration", key: "narration", width: 15 },
    { label: "imported", key: "imported", width: 15 },
    { label: "failed_reason", key: "failed_reason", width: 15 },
  ];

  worksheet.columns = headers.map((header) => ({
    header: header.label,
    key: header.key,
    width: header.width,
  }));

  // Add data rows
  if (Array.isArray(transactionData)) {
    transactionData.forEach((row) => {
      worksheet.addRow({
        date: row.date ? row.date.replace(/\//g, "-") : "",
        effective_date: row.effective_date || "",
        bill_reference: row.bill_reference || "",
        dr_ledger: row.dr_ledger || "",
        cr_ledger: row.cr_ledger || "",
        amount: row.amount || 0,
        voucher_type: row.voucher_type || "Payment",
        narration: row.narration || "",
        imported: row.imported || "Not Uploaded yet",
        failed_reason: row.failed_reason || "",
      });
    });
  }

  applyHeaderStyling(worksheet);
};

// Helper function to apply row styling
const applyRowStyling = (row, index) => {
  // Apply alternating row colors
  if (index % 2 !== 0) {
    row.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "D9E1F2" },
      };
    });
  }

  // Format number cells
  ["debit", "credit", "balance"].forEach((key) => {
    if (
      row.getCell(key).value !== null &&
      row.getCell(key).value !== undefined
    ) {
      row.getCell(key).numFmt = "#,##0.00";
    }
  });
};

// Helper function to apply header styling
const applyHeaderStyling = (worksheet) => {
  worksheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "00004D" },
    };
    cell.alignment = { horizontal: "center" };
  });
};

// Helper function to add standard rows with month and day
const addStandardRowsWithMonthDay = (
  worksheet,
  transactionData,
  defaultCategory,
  defaultVoucherType = "Payment"
) => {
  if (Array.isArray(transactionData)) {
    transactionData.forEach((row, index) => {
      // Extract month and date from date string if available
      let month = "";
      let day = "";

      if (row.date) {
        const dateObj = new Date(row.date);
        // Get month name (e.g., "Apr-2022")
        month =
          dateObj.toLocaleString("en-US", { month: "short" }) +
          "-" +
          dateObj.getFullYear();
        // Get day of month (e.g., "22")
        day = dateObj.getDate();
      }

      // Determine debit and credit values based on type
      let debitValue = 0;
      let creditValue = 0;

      if (row.type === "debit") {
        debitValue = row.amount || 0;
      } else if (row.type === "credit") {
        creditValue = row.amount || 0;
      }

      const newRow = worksheet.addRow({
        valueDate: row.date
          ? new Date(row.date).toLocaleDateString("en-GB").replace(/\//g, "-")
          : "",
        description: row.description || "",
        balance: row.balance || 0,
        category: row.category || defaultCategory,
        entity: row.entity || "",
        bank: row.bank || "hdfc bank",
        voucher_type: row.voucher_type || defaultVoucherType,
        debit: debitValue,
        credit: creditValue,
        month: month,
        date: day,
      });

      applyRowStyling(newRow, index);
    });
  }
};

export { generateFinancialReport };
