import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const capitalizeFirstLetter = (str) => str.charAt(0).toUpperCase() + str.slice(1);

const exportToExcel = async (transactions, fileName = "transactions.xlsx", forShare = false) => {
  if (!transactions.length) return null;
  // Convert JSON data to worksheet
  const worksheet = XLSX.utils.json_to_sheet(transactions);
  const headers = Object.keys(transactions[0]);

  // Capitalize headers and update worksheet
  const capitalizedHeaders = headers.map(capitalizeFirstLetter);
  const range = XLSX.utils.decode_range(worksheet["!ref"]);
  headers.forEach((header, index) => {
    const cellAddress = XLSX.utils.encode_cell({ r: range.s.r, c: index });
    if (worksheet[cellAddress]) {
      worksheet[cellAddress].v = capitalizedHeaders[index];
    }
  });

  // Create workbook and convert to binary
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Transactions");
  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const data = new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  // If not for sharing, trigger direct download
  if (!forShare) {
    saveAs(data, fileName);
    return null;
  } else {
    // If `showSaveFilePicker` is available, use it (modern browsers)
    if ("showSaveFilePicker" in window) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: fileName,
          types: [{
            description: "Excel File",
            accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] },
          }],
        });

        const writable = await handle.createWritable();
        await writable.write(data);
        await writable.close();

        return handle.name; // Return the saved file path/name for sharing
      } catch (error) {
        console.error("File save was canceled", error);
        return null; // Return null if user cancels
      }
    } else {
      // Fallback for browsers that do not support `showSaveFilePicker`
      return new Promise((resolve) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(data);
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Ask user to confirm once they finish saving
        setTimeout(() => {
          const confirmSave = window.confirm("Did you finish saving the file?");
          resolve(confirmSave ? fileName : null);
        }, 500);
      });
    }
  }
};

export { exportToExcel };
