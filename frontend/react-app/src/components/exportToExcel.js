import * as ExcelJS from "exceljs";
import { saveAs } from "file-saver";

// Convert index to Excel column letter (A, B, C...)
const getExcelColumnLetter = (colIndex) => {
  let letter = "";
  while (colIndex >= 0) {
    letter = String.fromCharCode((colIndex % 26) + 65) + letter;
    colIndex = Math.floor(colIndex / 26) - 1;
  }
  return letter;
};

const exportToExcel = async (transactions, fileName = "transactions.xlsx", forShare = false, categoryOptions = null) => {
  const columnsToIgnore = ["monthKey"];
  const colsToHide = ["id"];

  if (!transactions.length) return null;

  // Filter out ignored columns
  const filteredTransactions = transactions.map((row) => {
    const newRow = { ...row };
    columnsToIgnore.forEach((col) => delete newRow[col]);
    return newRow;
  });

  // Ensure ID column is first
  const finalTransactions = filteredTransactions.map((row) => ({
    id: row.id,
    ...row,
  }));

  console.log({
    transactionsLength: transactions.length,
    fileName,
    forShare,
    categoryOptions,
    exampleTransaction: transactions[0],
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Transactions");

  // Define headers
  const headers = Object.keys(finalTransactions[0]);
  sheet.columns = headers.map((header) => {
    const column = {
      header: header.charAt(0).toUpperCase() + header.slice(1),
      key: header,
      width: 12, // default width for columns
    };

    // Set specific widths for certain columns
    if (header === "description") {
      column.width = 70; // wider width for description column
    } else if (header === "entity") {
      column.width = 20;
    } else if (header === "category") {
      column.width = 20;
    } else if (header === "debit" || header === "credit" || header === "balance") {
      column.width = 15;
    }else if(header === "Statement Name" || header==="Report Name"||header==="Home Loan Amount (₹)"||header==="LAP Amount (₹)"||header==="Business Loan Amount (₹)"||header==="Term Plan Amount (₹)"||header==="General Insurance Amount (₹)"||header==="Home Loan Commission (₹)"||header==="LAP Commission (₹)"||header==="Business Loan Commission (₹)"||header==="Term Plan Commission (₹)"||header==="General Insurance Commission (₹)" ){
      column.width = 20;
    }


    return column;
  });

  // Add data rows
  finalTransactions.forEach((row) => sheet.addRow(row));

  // ✅ Hide specific columns
  headers.forEach((header, index) => {
    if (colsToHide.includes(header)) {
      sheet.getColumn(index + 1).hidden = true;
    }


    const cell = sheet.getRow(1).getCell(index + 1);

    // Center align all cells in the header row
    cell.alignment = { vertical: "middle", horizontal: "center" };

    // Apply background color to header row
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF000058" }
    };

    // Apply font style to header row
    cell.font = {
      name: 'Calibri',
      size: 11,
      color: { argb: "FFFFFFFF" },
      bold: true
    };

    // Apply color to alternate rows except header row
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1 && rowNumber % 2 !== 0) {  // Skip header row (1) and apply to odd rows
      row.eachCell((cell) => {
        cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFB5CBE0" }
        };
      });
      }
    });

  });

  // ✅ Apply category dropdown if `categoryOptions` is provided
  if (categoryOptions && headers.includes("category")) {
    const categoryColIndex = headers.indexOf("category");
    const categoryColLetter = getExcelColumnLetter(categoryColIndex);
    const numRows = finalTransactions.length;

    // Add a "Categories" sheet with category options
    const categorySheet = workbook.addWorksheet("Categories",{state:'hidden'});
    categoryOptions.forEach((cat, i) => {
      categorySheet.getCell(`A${i + 1}`).value = cat;
    });

    // Apply dropdown validation to the "Category" column
    for (let i = 2; i <= numRows + 1; i++) {
      sheet.getCell(`${categoryColLetter}${i}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [`'Categories'!$A$1:$A$${categoryOptions.length}`], // Reference to category sheet
      };
    }
  }

  // Save the file
  const buffer = await workbook.xlsx.writeBuffer();
  const data = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  if (!forShare) {
    saveAs(data, fileName);
    return null;
  } else {
    // Modern file picker for saving
    if ("showSaveFilePicker" in window) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: fileName,
          types: [
            {
              description: "Excel File",
              accept: {
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
              },
            },
          ],
        });

        const writable = await handle.createWritable();
        await writable.write(data);
        await writable.close();

        return handle.name;
      } catch (error) {
        console.error("File save was canceled", error);
        return null;
      }
    } else {
      // Fallback for older browsers
      return new Promise((resolve) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(data);
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        setTimeout(() => {
          const confirmSave = window.confirm("Did you finish saving the file?");
          resolve(confirmSave ? fileName : null);
        }, 500);
      });
    }
  }
};

export { exportToExcel };
