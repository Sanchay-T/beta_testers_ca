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
import { useToast } from "../../hooks/use-toast";
import { Input } from "../ui/input";
import localForage from "localforage";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../ui/alert-dialog";
import { Checkbox } from "../ui/checkbox";

const defaultColumns = {
  "Payment Receipt Contra": [
    "invoice_date",
    "effective_date",
    // "reference_number",
    "dr_ledger",
    "cr_ledger",
    "amount",
    "narration",
    "voucher_type",
  ],
};

const TallyDirectImport = ({ defaultVoucher, source }) => {
  const vouchers = ["Payment Receipt Contra", "Ledgers", "Import Ledgers"];
  // const [vouchers, setVouchers] = useState(["Payment Receipt Contra"]);
  const [selectedVoucher, setSelectedVoucher] = useState(defaultVoucher);
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
  const [excelHeaders, setExcelHeaders] = useState([]);

  // If you have a caseId in the ReportContext:
  const { reportData, updateReportData } = useReportContext();
  const { caseId } = reportData;
  const [ledgerCreationTableData, setLedgerCreationTableData] = useState([]);
  const { toast } = useToast();
  const [port, setPort] = useState("9000");
  const [tallyVersion, setTallyVersion] = useState("TallyPrime");
  const [importedLedgers, setImportedLedgers] = useState([]);
  const [selectedBankLedger, setSelectedBankLedger] = useState();
  const [showTallyWarning, setShowTallyWarning] = useState(false);
  const [isEmptyLedgersSelected, setIsEmptyLedgersSelected] = useState(false);

  useEffect(() => {
    const checkIsTallyStatus = async () => {
      // check if tally is running or not
      const response = await window.electron.checkTallyRunning(port);
      const isTallyRunning = response.success;
      console.log({ isTallyRunning });

      if (!isTallyRunning) {
        setShowTallyWarning(true);
      }
    };

    checkIsTallyStatus();
  }, []);

  const handleInputChange = (e) => {
    setPort(e.target.value);
  };

  // ----------------------------------
  // 1) FETCHING VOUCHERS/TRANSACTIONS
  //    (only if not in “manual” source)
  // ----------------------------------

  useEffect(() => {
    if (source !== "manual") {
      // If we’re NOT in “manual” mode, fetch transactions from your existing logic
      setLoading(true);

      // fetchVouchersTransactions();
      console.log({ selectedVoucher });
      handleVoucherChange(selectedVoucher);
    }
  }, [source, defaultVoucher]);

  // New helper function to fetch and process transactions data
  async function fetchAllTransactions() {
    try {
      const data = await window.electron.getTransactions(caseId);
      // const sortedData = data.sort((a, b) => a.imported - b.imported);
      // const storedReasons = JSON.parse(
      //   localStorage.getItem("failedTransactions") || "{}"
      // );
      const formattedData = data
        .map((transaction) => {
          if (transaction.voucher_type === "unknown") return null;
          return {
            date: new Date(transaction.date).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            }),
            effective_date: "",
            bill_reference: "",
            ledger:
              transaction.entity !== "unknown"
                ? transaction.entity
                : transaction.category,
            // dr_ledger:
            //   transaction.type === "debit"
            //     ? transaction.entity !== "unknown"
            //       ? transaction.entity
            //       : transaction.category
            //     : "",
            // cr_ledger:
            //   transaction.type === "credit"
            //     ? transaction.entity !== "unknown"
            //       ? transaction.entity
            //       : transaction.category
            //     : "",
            amount: transaction.amount,
            voucher_type: transaction.voucher_type,
            type: transaction.type,
            narration: transaction.description,
            id: transaction.id,
            imported: transaction.imported === 1,
            failed_reason: "",
          };
        })
        .filter((t) => t !== null);
      // Update state so that other parts of your component can use this data
      setTransactions(formattedData);
      return formattedData;
    } catch (err) {
      console.error("Error fetching transactions:", err);
      return [];
    }
  }

  const handleVoucherChange = async (voucherName) => {
    setSelectedVoucher(voucherName);
    setLoading(true);
    try {
      // Always fetch transactions first
      const allTransactions = await fetchAllTransactions();

      if (voucherName === "Ledgers") {
        // Extract unique ledger names from transactions
        const uniqueLedgers = [
          ...new Set(allTransactions.map((transaction) => transaction.ledger)),
        ];
        setUniqueLedgers(uniqueLedgers);

        // Create ledger table data
        const tableDataForLedgerCreation = uniqueLedgers.map(
          (ledger, index) => ({
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
            imported: false,
            failed_reason: "",
          })
        );

        setLedgerCreationTableData(tableDataForLedgerCreation);
        setDataToRender(tableDataForLedgerCreation);
      } else if (voucherName === "Import Ledgers") {
      } else if (voucherName === "Payment Receipt Contra") {
        // Render Payment Receipt Contra
        // For other vouchers, use the fetched transactions directly
        setDataToRender(allTransactions);
      }
    } catch (err) {
      console.error("Error handling voucher change:", err);
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

  const handleTallyUpload = async (txData) => {
    console.log(txData);
    // “txData” is optional—ManualEntryTable might pass it.
    if (!companyName.trim()) {
      // alert("Please enter a company name before uploading.");
      toast({
        title: "Error",
        description: "Please enter a company name before uploading.",
        status: "error",
        duration: 5000,
        variant: "destructive",
        type: "error",
      });
      return;
    }
    console.log({ selectedBankLedger, selectedVoucher });
    if (selectedVoucher === "Payment Receipt Contra" && !selectedBankLedger) {
      // alert("Please enter a company name before uploading.");
      toast({
        title: "Error",
        description: "Please select a Bank Ledger before uploading.",
        status: "error",
        duration: 5000,
        variant: "destructive",
        type: "error",
      });
      return;
    }
    // // Check if any non-imported transaction is missing DrLedger or CrLedger
    // const incompleteTransactions = txData.filter((transaction) => {
    //   if (transaction.imported) return false;
    //   // check if transaction contains a key as cr_ledger
    //   return !transaction.dr_ledger || !transaction.cr_ledger;
    // });
    // if (incompleteTransactions.length > 0) {
    //   // alert(
    //   //   "Some transactions are missing DrLedger or CrLedger. Please fill them before uploading."
    //   // );
    //   toast({
    //     title: "Error",
    //     description:
    //       "Some transactions are missing DrLedger or CrLedger. Please fill them before uploading.",
    //     status: "error",
    //     duration: 5000,
    //     variant: "destructive",
    //     type: "error",
    //   });
    //   return;
    // }

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

        const dr_ledger =
          transaction.type === "debit"
            ? transaction.ledger
            : selectedBankLedger;

        const cr_ledger =
          transaction.type === "credit"
            ? transaction.ledger
            : selectedBankLedger;
        return {
          companyName: companyName,
          invoiceDate: formatDateForTally(
            transaction.date || transaction.invoice_date || ""
          ),
          effectiveDate: formatDateForTally(transaction.effective_date || ""),
          // effectiveDate: 20240401,
          // referenceNumber: transaction.reference_number || null,
          DrLedger: isEmptyLedgersSelected ? "Suspense" : dr_ledger,
          CrLedger: isEmptyLedgersSelected ? "Suspense" : cr_ledger,
          amount: parseInt(transaction.amount),
          narration: transaction.narration,
          voucherName: tempVoucherType,
          id: transaction.id,
        };
      })
      .filter(Boolean);

    console.log({ tallyData });

    setTallyUploadData(tallyData);
    setConfirmationModal(true);
  };

  const handleLedgerCreation = async (data) => {
    console.log({ LedgerCreation: data });

    // “txData” is optional—ManualEntryTable might pass it.
    if (!companyName.trim()) {
      // alert("Please enter a company name before uploading.");
      toast({
        title: "Error",
        description: "Please enter a company name before uploading.",
        status: "error",
        duration: 5000,
        variant: "destructive",
        type: "error",
      });

      return;
    }

    // Check if any non-imported transaction is missing DrLedger or CrLedger
    const incompleteTransactions = data.filter((transaction) => {
      if (transaction.imported) return false;
      return !transaction.ledger_group;
    });
    if (incompleteTransactions.length > 0) {
      toast({
        title: "Error",
        description:
          "Some transactions are missing Ledger Group. Please fill them before uploading.",
        status: "error",
        duration: 5000,
        variant: "destructive",
        type: "error",
      });
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
    // updateReportData({ ledgerCreated: true });
  };

  const handleUploadAfterConfirmation = async () => {
    setLoading2(true);
    try {
      let response;
      if (selectedVoucher === "Payment Receipt Contra") {
        response = await window.electron.uploadToTally(tallyUploadData, port);
        //  TODO - store the success data to tally new table in db
      } else if (selectedVoucher === "Ledgers") {
        response = await window.electron.uploadLedgerToTally(
          tallyUploadData,
          port,
          tallyVersion
        );
        // TODO - store the newly created ones to ledeger master
      }

      const { failedTransactions = [], successIds = [] } = response;

      const newDataToRender = dataToRender.map((ledger) => {
        if (successIds.includes(ledger.id)) {
          return {
            ...ledger,
            imported: true,
          };
        } else if (Object.keys(failedTransactions).includes(ledger.id)) {
          return {
            ...ledger,
            imported: false,
            failed_reason: failedTransactions[ledger.id],
          };
        } else {
          return ledger;
        }
      });

      const tempDataToRender = newDataToRender.sort(
        (a, b) => a.imported - b.imported
      );

      setDataToRender(tempDataToRender);

      // Show summary
      setFailedTransactions(failedTransactions);
      setSuccessIds(successIds);

      console.log({ response });

      // // Store failed reasons in localStorage
      // const storedReasons = JSON.parse(
      //   localStorage.getItem("failedTransactions") || "{}"
      // );
      // failedTransactions.forEach((ft) => {
      //   storedReasons[ft.id] = ft.error;
      // });
      // // Remove success IDs from stored reasons
      // successIds.forEach((id) => {
      //   delete storedReasons[id];
      // });
      // localStorage.setItem(
      //   "failedTransactions",
      //   JSON.stringify(storedReasons)
      // );

      // // Update local transactions with new “failed_reason” or “imported” flags
      // const tempTransactions = transactions.map((tr) => {
      //   if (successIds.includes(tr.id)) {
      //     return { ...tr, imported: true, failed_reason: "" };
      //   }
      //   if (storedReasons[tr.id]) {
      //     return { ...tr, failed_reason: storedReasons[tr.id] };
      //   }
      //   return tr;
      // });

      // const tempSortedTransactions = tempTransactions.sort(
      //   (a, b) => a.imported - b.imported
      // );

      // setTransactions(tempSortedTransactions);
      // setDataToRender(tempSortedTransactions);
    } catch (err) {
      console.error("Error uploading to Tally:", err);
    } finally {
      setLoading2(false);
      setConfirmationModal(false);
    }
  };

  const handleLedgerImport = async () => {
    if (!companyName.trim()) {
      // alert("Please enter a company name before uploading.");
      toast({
        title: "Error",
        description: "Please enter a company name before uploading.",
        status: "error",
        duration: 5000,
        variant: "destructive",
        type: "error",
      });
      return;
    }

    const response = await window.electron.importLedgers(companyName, port);
    console.log({ response });
    if (response.success) {
      const ledgerData = response.ledgerData;
      setImportedLedgers(ledgerData);
      removeDuplicateLedgers(ledgerData);
      // TODO - store imported ledgers in db

      updateReportData({ importedLedgers: ledgerData });
    }
    toast({
      title: "Success",
      description: `Imported Ledgers and removed already existing ones from above list.`,
      duration: 3000,
      variant: "success",
    });
  };

  const removeDuplicateLedgers = (resLedgers = importedLedgers) => {
    console.log({ dataToRender });
    const ledgers = resLedgers.map((ledger) => ledger.ledgerName);
    const uniqueLedgersData = dataToRender.filter(
      (d) => !ledgers.includes(d.ledger_name)
    );
    console.log({ uniqueLedgersData });
    setDataToRender(uniqueLedgersData);
  };

  // Simple summary for the Tally upload dialog
  const tallyUploadResponseStats = () => {
    const totalTransactions = tallyUploadData.length;
    const failedTransactionsCount = failedTransactions.length;
    const successTransactionsCount = successIds.length;

    // Aggregate error types if needed
    const errorCounts =
      failedTransactions &&
      failedTransactions.reduce((acc, transaction) => {
        const errorMessage = transaction.error.toLowerCase();
        console.log({ errorMessage });
        let errorCategory = "Other Errors";

        if (
          errorMessage.includes("Ledgers") &&
          errorMessage.includes("does not exist")
        ) {
          errorCategory = "Ledger Not Found";
        } else if (errorMessage.includes("out of range")) {
          errorCategory = "Date Range Error";
        } else if (errorMessage.includes("port number")) {
          errorCategory = "Port Number Error";
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
  // Updated handleExcelUpload function

  // Define a helper function
  const toSnakeCase = (str) =>
    str
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "")
      .replace(/_+/g, "_")
      .replace(/_+$/, ""); // Remove trailing underscores

  const handleExcelUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        // Parse with headers from the first row
        const parsedData = XLSX.utils.sheet_to_json(sheet, {
          header: "A", // Use A,B,C as keys initially
          range: 0,
        });
        console.log("Parsed Excel Data:", parsedData);

        if (parsedData.length === 0) return;

        // Extract header row (first row)
        const headerRow = parsedData[1];
        console.log("Excel Headers row:", headerRow);

        // Create a mapping of column indices to actual header names
        const headers = Object.keys(headerRow).map((key) => headerRow[key]);
        console.log("Excel Headers:", headers);

        // Check if a company name column exists
        const companyNameIndex = headers.findIndex(
          (header) =>
            header &&
            typeof header === "string" &&
            header.toLowerCase().includes("company name")
        );
        console.log("Company Name Index:", companyNameIndex);

        // If company name exists in the headers, set it
        // if (companyNameIndex !== -1) {
        //   // Look for company name in the second row (data row)
        //   if (parsedData.length > 1) {
        //     const firstDataRow = parsedData[1];
        //     const columnLetter = String.fromCharCode(65 + companyNameIndex); // A, B, C, etc.
        //     const companyNameValue = firstDataRow[columnLetter];
        //     if (companyNameValue) {
        //       // setCompanyName(companyNameValue.toString());
        //     }
        //   }
        // }

        // Filter out company name from headers if it exists
        const filteredHeaders = headers.filter(
          (header, index) => index !== companyNameIndex && header
        );

        // Process data rows (skip header row)
        const newTransactions = parsedData.slice(2).map((row, idx) => {
          const transaction = {
            id: `excel-${idx}`,
            imported: false,
            failed_reason: "",
            voucher_type: "Payment Voucher", // Default value
          };

          // Map each column to the corresponding field
          filteredHeaders.forEach((header, index) => {
            const columnLetter = String.fromCharCode(
              65 +
                (index >= companyNameIndex && companyNameIndex !== -1
                  ? index + 1
                  : index)
            );
            let value = row[columnLetter];

            // Convert only "date" and "effective date" fields
            if (
              value !== undefined &&
              typeof header === "string" &&
              (header.toLowerCase() === "date *" ||
                header.toLowerCase() === "effective date")
            ) {
              if (typeof value === "number") {
                const date = excelSerialToJSDate(value);
                value = date ? formatDateToDDMMYYYY(date) : "";
              } else if (value instanceof Date) {
                value = formatDateToDDMMYYYY(value);
              }
            }
            // Convert header to snake_case for field name
            const fieldName =
              typeof header === "string"
                ? toSnakeCase(header)
                : toSnakeCase(String(header));

            // console.log({ fieldName, value });
            console.log({ header, value });

            // Store with original header name as key
            transaction[fieldName] = value || "";
          });

          return transaction;
        });

        console.log("Excel Headers:", filteredHeaders);
        console.log("Processed Transactions:", newTransactions);

        // Set filtered headers for the table to use
        setExcelHeaders(
          filteredHeaders.map((header) => ({
            original: header,
            field:
              typeof header === "string"
                ? toSnakeCase(header)
                : toSnakeCase(String(header)),
          }))
        );

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
    if (selectedVoucher === "Payment Receipt Contra") {
      console.log("Payment reciept submit triggered");
      handleTallyUpload(transactions);
    } else if (selectedVoucher === "Ledgers") {
      console.log("Ledger creation triggered");
      handleLedgerCreation(transactions);
    }
  };

  const updateLedgerCreationStatus = async (id, status) => {
    console.log("updateLedgerCreationStatus", { id, status });
    let ledgerCreationStatusHistory = await localForage.getItem(
      "ledgerCreationStatusHistory"
    );
    console.log({ got: ledgerCreationStatusHistory });
    if (ledgerCreationStatusHistory) {
      ledgerCreationStatusHistory[id] = status;
      console.log("setting 1", ledgerCreationStatusHistory);
      await localForage.setItem(
        "ledgerCreationStatusHistory",
        ledgerCreationStatusHistory
      );
    } else {
      ledgerCreationStatusHistory = { [id]: status };
      console.log("setting 2", ledgerCreationStatusHistory);

      await localForage.setItem(
        "ledgerCreationStatusHistory",
        ledgerCreationStatusHistory
      );
    }
  };

  const recheckTallystatus = async () => {
    const response = await window.electron.checkTallyRunning(port);
    const isTallyRunning = response.success;
    console.log({ isTallyRunning });

    if (isTallyRunning) setShowTallyWarning(false);
    else {
      toast({
        title: "Error",
        description: "Please Make sure tally is running on Port " + port,
        status: "error",
        duration: 5000,
        variant: "destructive",
        type: "error",
      });
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
                : `${selectedVoucher} Voucher`}
            </CardTitle>

            {/* Select voucher dropdown */}
            {/* {source !== "manual" && (
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
              </div>
            )} */}

            {selectedVoucher === "Payment Receipt Contra" && (
              <div className="text-sm text-gray-800 max-w-xl flex gap-x-4 items-center">
                <Checkbox
                  id="confirm-delete"
                  checked={isEmptyLedgersSelected}
                  onCheckedChange={setIsEmptyLedgersSelected}
                  className=""
                />
                <label className="whitespace-nowrap">
                  Upload Empty Ledgers
                </label>
              </div>
            )}
            <div className="text-sm text-gray-800 max-w-xl flex gap-x-4 items-center">
              <label className="whitespace-nowrap">
                Please Enter Port Number:
              </label>
              <Input
                type="number"
                value={port}
                onChange={handleInputChange}
                placeholder="Enter Port Number"
              />
            </div>
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
                  </div>

                  {/* Show ManualEntryTable (simple table where user can add row by row) */}
                  <ManualTallyTable
                    initialData={dataToRender}
                    columnsProp={
                      source === "manual" && excelHeaders.length > 0
                        ? excelHeaders.map((h) => h.field)
                        : defaultColumns[selectedVoucher]
                    }
                    originalHeaders={excelHeaders}
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
                      : `Tally ${selectedVoucher} Voucher`
                  }
                  subtitle=""
                  handleUpload={handleUploadClick}
                  setCompanyName={setCompanyName}
                  companyName={companyName}
                  selectedVoucher={selectedVoucher}
                  caseId={caseId}
                  handleLedgerImport={handleLedgerImport}
                  setSelectedBankLedger={setSelectedBankLedger}
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
                  {`You are about to import ${tallyUploadData.length} ${
                    selectedVoucher === "Ledgers" ? "ledgers" : "transactions"
                  }
                  to Tally. Are you sure you want to proceed?`}
                </p>
                <p className="my-4 text-sm text-gray-500">
                  Note: Already uploaded transactions will not be uploaded
                  again.
                </p>

                {/* Show a dropdown for selecting tally version */}
                {selectedVoucher === "Ledgers" && (
                  <Select
                    onValueChange={setTallyVersion}
                    value={tallyVersion}
                    className="w-1/2"
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Tally Version" />
                    </SelectTrigger>
                    <SelectContent>
                      {["TallyPrime", "TallyERP"].map((version) => (
                        <SelectItem key={version} value={version}>
                          {version}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setConfirmationModal(false)}
              >
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

        {/* A warning dialog to let user know that tally is closed so please start it */}

        <AlertDialog open={showTallyWarning}>
          {/* <AlertDialogTrigger>Open</AlertDialogTrigger> */}
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Alert</AlertDialogTitle>
              <AlertDialogDescription>
                Tally is not running, please start tally to continue.
                {/*  */}
                <div className="mt-4 max-w-xl flex gap-x-4 items-center">
                  <label className="whitespace-nowrap">Port Number:</label>
                  <Input
                    type="number"
                    value={port}
                    onChange={handleInputChange}
                    placeholder="Enter Port Number"
                  />
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              {/* <AlertDialogCancel>Cancel</AlertDialogCancel> */}
              <AlertDialogAction onClick={recheckTallystatus}>
                Retry
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Card>
    </div>
  );
};

export default TallyDirectImport;
