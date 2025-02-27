import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Loader2 } from "lucide-react";
import TallyTable from "./TallyTable";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { useReportContext } from "../../contexts/ReportContext";
import ManualTallyTable from "./ManualTable";
import * as XLSX from "xlsx";
import { Info } from "lucide-react";
import  {Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

const defaultColumns = {
  "Payment Receipt Contra Voucher": [
    "invoice_date",
    "effective_date",
    "reference_number",
    "dr_ledger",
    "cr_ledger",
    "amount",
    "narration",
    "voucher_type",
  ],
};

const TallyDirectImport = ({ source }) => {
  // const [vouchers, setVouchers] = useState([
  //   "Payment Receipt Contra Voucher",
  //   "Ledger",
  // ]);
  const [vouchers, setVouchers] = useState([
    "Payment Receipt Contra Voucher",
  ]);
  const [selectedVoucher, setSelectedVoucher] = useState(
    "Payment Receipt Contra Voucher"
  );
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loading2, setLoading2] = useState(false);
  const [confirmationModal, setConfirmationModal] = useState(false);
  const [tallyUploadData, setTallyUploadData] = useState([]);
  const [failedTransactions, setFailedTransactions] = useState([]);
  const [companyName, setCompanyName] = useState("");
  const [successIds, setSuccessIds] = useState([]);
  const fileInputRef = useRef(null);
  const [uniqueLedgers, setUniqueLedgers] = useState([]);
  const [dataToRender, setDataToRender] = useState([]);

  // If you have a caseId in the ReportContext:
  const { reportData } = useReportContext();
  const { caseId } = reportData;
  const [ledgerCreationTableData, setLedgerCreationTableData] = useState([]);

  // ----------------------------------
  // 1) FETCHING VOUCHERS/TRANSACTIONS
  //    (only if not in “manual” source)
  // ----------------------------------

  async function fetchVouchersTransactions() {
    try {
      // const data = await window.electron.getTallyVoucherTransactions(
      //   caseId,
      //   newVoucher || selectedVoucher
      // );
      const data = await window.electron.getTransactions(caseId);
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
            reference_number: "",
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

      setTransactions(formattedData);
      setDataToRender(formattedData);
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
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (source !== "manual") {
      // If we’re NOT in “manual” mode, fetch transactions from your existing logic
      setLoading(true);

      // fetchVouchersTransactions();
      handleVoucherChange(selectedVoucher);
    }
  }, [source]);

  const fetchUniqueVouchers = () => {
    const uniqueLeds = transactions.map((transaction) => {
      return transaction.dr_ledger || transaction.cr_ledger;
    });

    const uniqueLedgers = [...new Set(uniqueLeds)];

    setUniqueLedgers(uniqueLedgers);

    const tableDataForLedgerCreation = uniqueLedgers.map((ledger, index) => {
      return {
        date: new Date().toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }),
        ledger_name: ledger,
        ledger_group: null,
        gst_number: null,
        address: null,
        pincode: null,
        state: null,
        country: null,
        opening_balance: null,
        id: index,
      };
    });

    console.log({ tableDataForLedgerCreation });
    setLedgerCreationTableData(tableDataForLedgerCreation);
    setDataToRender(tableDataForLedgerCreation);
  };

  // Changing voucher
  const handleVoucherChange = async (voucherName) => {
    setSelectedVoucher(voucherName);
    setLoading(true);
    try {
      console.log({ voucherName });

      if (voucherName === "Ledger") {
        fetchUniqueVouchers();
      } else {
        await fetchVouchersTransactions(voucherName);
      }
    } catch (err) {
      console.error("Error fetching transactions:", err);
    }
    setLoading(false);
  };

  // ----------------------------------
  // 2) UPLOAD TO TALLY LOGIC
  //    (common for both modes)
  // ----------------------------------

  const formatDateForTally = (dateString) => {
    if (!dateString) return "";

    // If user enters YYYY-MM-DD
    if (dateString.includes("-")) {
      return dateString.replace(/-/g, "");
    }

    // If user enters DD/MM/YYYY
    if (dateString.includes("/")) {
      const [day, month, year] = dateString.split("/");
      return `${year}${month}${day}`;
    }

    return dateString;
  };

  const handleTallyUpload = async (txData = transactions) => {
    // “txData” is optional—ManualEntryTable might pass it.
    if (!companyName.trim()) {
      alert("Please enter a company name before uploading.");
      return;
    }

    // Check if any non-imported transaction is missing DrLedger or CrLedger
    const incompleteTransactions = txData.filter((transaction) => {
      if (transaction.imported) return false;
      return !transaction.dr_ledger || !transaction.cr_ledger;
    });
    if (incompleteTransactions.length > 0) {
      alert(
        "Some transactions are missing DrLedger or CrLedger. Please fill them before uploading."
      );
      return;
    }

    // Prepare data for Tally
    const tallyData = txData
      .map((transaction) => {
        if (transaction.imported) {
          // Already uploaded
          return null;
        }
        const tempVoucherType =
          transaction.voucher_type === "Payment Voucher"
            ? "Payment"
            : transaction.voucher_type === "Receipt Voucher"
            ? "Receipt"
            : transaction.voucher_type || "Payment"; // fallback

        return {
          companyName: companyName,
          invoiceDate: formatDateForTally(transaction.date||transaction.invoice_date || ""),
          effectiveDate: formatDateForTally(transaction.effective_date || ""),
          // effectiveDate: 20240401,
          referenceNumber: transaction.reference_number || null,
          DrLedger: transaction.dr_ledger || null,
          CrLedger: transaction.cr_ledger || null,
          amount: parseInt(transaction.amount),
          narration: transaction.narration,
          voucherName: tempVoucherType,
          id: transaction.id,
        };
      })
      .filter(Boolean);

    setTallyUploadData(tallyData);
    setConfirmationModal(true);
  };

  const handleLedgerCreation = async (data) => {
    console.log({ LedgerCreation: data });

    // “txData” is optional—ManualEntryTable might pass it.
    if (!companyName.trim()) {
      alert("Please enter a company name before uploading.");
      return;
    }
    // Prepare data for Tally
    const tallyData = data
      .map((transaction) => {
        return {
          companyName: companyName,
          id: transaction.id,
          ledgerName: transaction.ledger_name,
          ledgerGroup: transaction.ledger_group,
          GSTnum: transaction.gst_number,
          Address: transaction.address,
          pincode: transaction.pincode,
          state: transaction.state,
          country: transaction.country,
          openingBalance: transaction.opening_balance,
          date: formatDateForTally(transaction.date),
        };
      })
      .filter(Boolean);

    console.log({ tallyData });
    setTallyUploadData(tallyData);
    setConfirmationModal(true);
  };

  const handleUploadAfterConfirmation = async () => {
    setLoading2(true);
    try {
      if (selectedVoucher === "Payment Receipt Contra Voucher") {
        const response = await window.electron.uploadToTally(tallyUploadData);

        const { failedTransactions = [], successIds = [] } = response;

        // Store failed reasons in localStorage
        const storedReasons = JSON.parse(
          localStorage.getItem("failedTransactions") || "{}"
        );
        failedTransactions.forEach((ft) => {
          storedReasons[ft.id] = ft.error;
        });
        // Remove success IDs from stored reasons
        successIds.forEach((id) => {
          delete storedReasons[id];
        });
        localStorage.setItem(
          "failedTransactions",
          JSON.stringify(storedReasons)
        );

        // Update local transactions with new “failed_reason” or “imported” flags
        const tempTransactions = transactions.map((tr) => {
          if (successIds.includes(tr.id)) {
            return { ...tr, imported: true, failed_reason: "" };
          }
          if (storedReasons[tr.id]) {
            return { ...tr, failed_reason: storedReasons[tr.id] };
          }
          return tr;
        });

        const tempSortedTransactions = tempTransactions.sort(
          (a, b) => a.imported - b.imported
        );

        setTransactions(tempSortedTransactions);
        setDataToRender(tempSortedTransactions);

        // Show summary
        setFailedTransactions(failedTransactions);
        setSuccessIds(successIds);
      } else if (selectedVoucher === "Ledger") {
        const response = await window.electron.uploadLedgerToTally(
          tallyUploadData
        );
        console.log({ response });
      }
    } catch (err) {
      console.error("Error uploading to Tally:", err);
    } finally {
      setLoading2(false);
      setConfirmationModal(false);
    }
  };

  // Simple summary for the Tally upload dialog
  const tallyUploadResponseStats = () => {
    const totalTransactions = tallyUploadData.length;
    const failedTransactionsCount = failedTransactions.length;
    const successTransactionsCount = successIds.length;

    // Aggregate error types if needed
    const errorCounts = failedTransactions.reduce((acc, transaction) => {
      const errorMessage = transaction.error.toLowerCase();
      let errorCategory = "Other Errors";

      if (
        errorMessage.includes("ledger") &&
        errorMessage.includes("does not exist")
      ) {
        errorCategory = "Ledger Not Found";
      } else if (errorMessage.includes("out of range")) {
        errorCategory = "Date Range Error";
      }
      // more conditions here if needed

      acc[errorCategory] = (acc[errorCategory] || 0) + 1;
      return acc;
    }, {});

    return (
      <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">
          Transaction Upload Summary
        </h2>
        <div className="flex justify-between items-center mb-6">
          <div className="flex flex-col items-center">
            <span className="text-xl font-semibold text-green-600">
              {successTransactionsCount}
            </span>
            <span className="text-sm text-gray-600 dark:text-gray-300">
              Successful
            </span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-xl font-semibold text-red-600">
              {failedTransactionsCount}
            </span>
            <span className="text-sm text-gray-600 dark:text-gray-300">
              Failed
            </span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-xl font-semibold text-blue-600">
              {totalTransactions}
            </span>
            <span className="text-sm text-gray-600 dark:text-gray-300">
              Total
            </span>
          </div>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
            Error Breakdown
          </h3>
          {Object.entries(errorCounts).length > 0 ? (
            <ul className="space-y-2">
              {Object.entries(errorCounts).map(([errorType, count]) => (
                <li
                  key={errorType}
                  className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-md"
                >
                  <span className="font-medium text-gray-700 dark:text-gray-200">
                    {errorType}
                  </span>
                  <span className="font-bold text-gray-800 dark:text-gray-100">
                    {count}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-600 dark:text-gray-300">No errors found.</p>
          )}
        </div>
      </div>
    );
  };

  // ----------------------------------
  // 3) MANUAL MODE / EXCEL UPLOAD
  // ----------------------------------
  function excelSerialToJSDate(serial) {
    const dateObj = XLSX.SSF.parse_date_code(serial);
    if (!dateObj) return null;
    return new Date(dateObj.y, dateObj.m - 1, dateObj.d);
  }

  // Helper: Format a JS Date to "dd-mm-yyyy"
  function formatDateToDDMMYYYY(date) {
    const day = ("0" + date.getDate()).slice(-2);
    const month = ("0" + (date.getMonth() + 1)).slice(-2);
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }
  // Example: parse Excel with an IPC call or local library
  const handleExcelUpload = async (e) => {
    console.log({ hey: "hey", e });
    const file = e.target.files?.[0];
    console.log({ file });
    if (!file) return;
    try {
      const reader = new FileReader();
      console.log({ reader });
      reader.onload = async (e) => {
        const data = new Uint8Array(e.target.result);
        console.log({ data });
        const workbook = XLSX.read(data, { type: "array" });
        console.log({ workbook });
        const sheetName = workbook.SheetNames[0];
        console.log({ sheetName });
        const sheet = workbook.Sheets[sheetName];
        console.log({ sheet });
        // const parsedData = XLSX.utils.sheet_to_json(sheet);
        // We assume the second row is your actual data row, so we skip the first row with range: 0 or 1
        const parsedData = XLSX.utils.sheet_to_json(sheet, {
          header: [
            "Company name *",
            "Date *",
            "Effective Date",
            "Bill Refrence *",
            "Dr Ledger *",
            "Cr Ledger *",
            "Amount *",
            "Narration",
            "Status",
          ],
        });
        const newParsedData = parsedData.slice(2);

        // Example in your mapping logic:

        const newTransactions = newParsedData.map((row, idx) => {
          console.log({row})
          let invoiceDateVal = row["Date *"];
          let effectiveDateVal = row["Effective Date"];

          // Convert numeric date serials to JS date strings in dd-mm-yyyy format
          if (typeof invoiceDateVal === "number") {
            const date = excelSerialToJSDate(invoiceDateVal);
            invoiceDateVal = date ? formatDateToDDMMYYYY(date) : "";
          } else if (invoiceDateVal instanceof Date) {
            invoiceDateVal = formatDateToDDMMYYYY(invoiceDateVal);
          }

          if (typeof effectiveDateVal === "number") {
            const date = excelSerialToJSDate(effectiveDateVal);
            effectiveDateVal = date ? formatDateToDDMMYYYY(date) : "";
          } else if (effectiveDateVal instanceof Date) {
            effectiveDateVal = formatDateToDDMMYYYY(effectiveDateVal);
          }

          return {
            id: `excel-${idx}`,
            invoice_date: invoiceDateVal,
            effective_date: effectiveDateVal,
            reference_number: row["Bill Refrence *"] || "",
            dr_ledger: row["Dr Ledger *"] || "",
            cr_ledger: row["Cr Ledger *"] || "",
            amount: row["Amount *"] || 0,
            narration: row["Narration"] || "",
            voucher_type: row["Voucher"] || "Payment Voucher",
            imported: false,
            failed_reason: "",
          };
        });

        console.log({ newTransactions });
        // Add them to our table
        setTransactions(newTransactions);
        setDataToRender(newTransactions);
      };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error("Error parsing Excel:", err);
    } finally {
      fileInputRef.current.value = "";
    }
  };

  // If the user manually enters rows, “ManualEntryTable” might call this:
  const handleManualEntriesSubmit = (rows) => {
    console.log({ rows });
    // rows is an array from ManualEntryTable
    // setTransactions(rows);
    handleTallyUpload(rows);
  };

  const handleClear = () => {
    // Clear the file input value so that the same file can be re-selected if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    // Optionally clear transactions if you want to remove any parsed data:
    setTransactions([]);

    setDataToRender([]);
  };

  const handleUploadClick = (transactions = null) => {
    console.log("Inside handleUploadClick ", transactions, { selectedVoucher });
    if (selectedVoucher === "Payment Receipt Contra Voucher") {
      console.log("Payment reciept submit triggered");
      handleTallyUpload(transactions);
    } else if (selectedVoucher === "Ledger") {
      console.log("Ledger creation triggered");
      handleLedgerCreation(transactions);
    }
  };

  return (
    <div className="p-8">
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg font-semibold">
            {source === "manual"
              ? "Manual Tally Import"
              : `Tally ${selectedVoucher} Transactions`}
          </CardTitle>

          {source !== "manual" && (
            <div className="flex gap-4">
              <Select
                onValueChange={handleVoucherChange}
                value={selectedVoucher}
              >
                <SelectTrigger className="w-98">
                  <SelectValue placeholder="Select a Voucher" />
                </SelectTrigger>
                <SelectContent>
                  {vouchers.map((voucher) => (
                    <SelectItem key={voucher} value={voucher}>
                      {voucher}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline">
                    <Info className="w-5 h-5 text-black" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Ensure that Tally is running on port 9000 for the Upload to
                  work.
                </TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        ) : (
          <>
            {/* If we are in manual mode and have no transactions, show “ManualEntryTable” + an Excel upload button */}
            {source === "manual" ? (
              <div className="space-y-4 ">
                <div className="flex items-center gap-4">
                  <label
                    htmlFor="excelUpload"
                    // onClick={() => fileInputRef.current.click()}
                    className="flex-shrink-0 py-2 px-4 bg-gray-800 text-white rounded-md cursor-pointer"
                  >
                    Upload Excel
                  </label>
                  <input
                    id="excelUpload"
                    type="file"
                    accept=".xlsx, .csv, .xlsm"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleExcelUpload}
                  />
                  <Button variant="outline" onClick={handleClear}>
                    Clear
                  </Button>

                  <p className="text-sm text-gray-500">
                    or manually add rows below
                  </p>
                  <div className=" ml-auto bg-blue-100 border border-blue-200 p-3 rounded-md text-sm text-gray-800 max-w-xl">
                    <div className="flex items-center space-x-4">
                      <Info className="w-5 h-5 text-black" />
                      <h1>
                        Ensure that Tally is running on port 9000 for the Upload
                        to work.
                      </h1>
                    </div>
                  </div>
                </div>

                {/* Show ManualEntryTable (simple table where user can add row by row) */}
                <ManualTallyTable
                  initialData={dataToRender}
                  columnsProp={defaultColumns[selectedVoucher]}
                  handleUpload={handleManualEntriesSubmit}
                  setCompanyName={setCompanyName}
                  companyName={companyName}
                />
              </div>
            ) : transactions.length > 0 ? (
              // Otherwise, show the TallyTable with the “transactions” we have
              <TallyTable
                data={dataToRender}
                title={
                  source === "manual"
                    ? "Manual Transactions"
                    : "Tally Transactions"
                }
                subtitle=""
                handleUpload={handleUploadClick}
                setCompanyName={setCompanyName}
                companyName={companyName}
                selectedVoucher={selectedVoucher}
              />
            ) : (
              // Fallback if not manual and no data
              source !== "manual" && (
                <div className="text-center py-6 text-gray-500">
                  No transactions available
                </div>
              )
            )}
          </>
        )}
      </CardContent>

      {/* Confirmation Modal */}
      <Dialog open={confirmationModal} onOpenChange={setConfirmationModal}>
        <DialogContent className="min-w-[500px] max-w-[40%]">
          <DialogHeader>
            <DialogTitle>Confirm Tally Import</DialogTitle>
            <DialogDescription>
              <p className="mt-4 text-lg">
                You are about to import {tallyUploadData.length} transactions to
                Tally. Are you sure you want to proceed?
              </p>
              <p className="my-4 text-sm text-gray-500">
                Note: Already uploaded transactions will not be uploaded again.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmationModal(false)}>
              Cancel
            </Button>
            <Button
              disabled={loading2}
              variant="default"
              onClick={handleUploadAfterConfirmation}
            >
              {loading2 ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                "Confirm"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Show summary of Tally upload if there are any failed transactions */}
      <Dialog
        open={failedTransactions.length > 0 || successIds.length > 0}
        onOpenChange={setFailedTransactions}
      >
        <DialogContent className="min-w-[500px] max-w-[40%] max-h-[90%] overflow-y-auto">
          <DialogHeader />
          <DialogDescription>{tallyUploadResponseStats()}</DialogDescription>
          <DialogFooter className="sticky bottom-0">
            <Button
              variant="default"
              onClick={() => {
                setFailedTransactions([]);
                setSuccessIds([]);
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
    </div>
  );
};

export default TallyDirectImport;
