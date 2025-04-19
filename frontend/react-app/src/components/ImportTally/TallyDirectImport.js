import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Loader2, Settings, Info, ChevronDown } from "lucide-react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Checkbox } from "../ui/checkbox";
import { useNavigate, useLocation, matchPath } from "react-router-dom";
import localForage, { clear } from "localforage";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

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

const TallyDirectImport = ({ defaultVoucher, source, setActiveTab }) => {
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
  const navigate = useNavigate();
  const location = useLocation();
  // If you have a caseId in the ReportContext:
  const { reportData, updateReportData } = useReportContext();
  const { caseId } = reportData;
  const { toast } = useToast();
  const [port, setPort] = useState(reportData.tallyPortNumber);
  const [tallyVersion, setTallyVersion] = useState("TallyPrime");
  const [selectedBankLedger, setSelectedBankLedger] = useState("");
  const [showTallyWarning, setShowTallyWarning] = useState(false);
  const [isEmptyLedgersSelected, setIsEmptyLedgersSelected] = useState(false);
  const [inititalLedgersData, setInititalLedgersData] = useState([]);
  const [initialPayRecContraData, setInitialPayRecContraData] = useState([]);

  useEffect(() => {
    const checkIsTallyStatus = async () => {
      // check if tally is running or not
      const response = await window.electron.checkTallyRunning(port);
      const isTallyRunning = response.success;

      if (!isTallyRunning) {
        setShowTallyWarning(true);
      }
    };

    if (reportData.selectedCompany && selectedVoucher !== "Ledgers") {
      setCompanyName(reportData.selectedCompany);
    }

    checkIsTallyStatus();
    handleLedgerImport();
  }, []);

  useEffect(() => {
    if (selectedVoucher === "Ledgers") {
      removeDuplicateLedgers();
    }
  }, [companyName]);

  const handlePortChange = (e) => {
    setPort(e.target.value);
    updateReportData({ tallyPortNumber: e.target.value });
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
      handleVoucherChange(selectedVoucher);
    }
  }, [source, defaultVoucher]);

  // New helper function to fetch and process transactions data
  async function fetchAllTransactions() {
    try {
      const data = await window.electron.getTallyTransactions(caseId);
      console.log("fetched data", data);
      // const sortedData = data.sort((a, b) => a.imported - b.imported);
      // const storedReasons = JSON.parse(
      //   localStorage.getItem("failedTransactions") || "{}"
      // );
      console.log(
        "particular",
        data.map((d) => d.bill_reference)
      );
      const formattedData = data
        .map((transaction) => {
          if (transaction.voucher_type === "unknown") return null;
          return {
            date: new Date(transaction.date).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            }),
            effective_date: transaction.effective_date || "",
            bill_reference: transaction.bill_reference || "",
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
            failed_reason: transaction.failed_reason || "",
          };
        })
        .filter((t) => t !== null);

      console.log("formattedData", formattedData);
      // Update state so that other parts of your component can use this data
      setTransactions(formattedData);
      setInitialPayRecContraData(formattedData);
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

        setDataToRender(tableDataForLedgerCreation);
        setInititalLedgersData(tableDataForLedgerCreation);
      } else if (voucherName === "Import Ledgers") {
      } else if (voucherName === "Payment Receipt Contra") {
        // Render Payment Receipt Contra
        // For other vouchers, use the fetched transactions directly
        setDataToRender(allTransactions);
        console.log("data to render", dataToRender);
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
      return false;
    }
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
      return false;
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
        // if (transaction.imported) {
        //   // remove Already uploaded
        //   return null;
        // }
        let dr_ledger = "";
        let cr_ledger = "";

        // if (transaction.voucher_type !== "Contra") {
        dr_ledger =
          transaction.type === "debit"
            ? isEmptyLedgersSelected
              ? "Suspense"
              : transaction.ledger
            : selectedBankLedger;

        cr_ledger =
          transaction.type === "credit"
            ? isEmptyLedgersSelected
              ? "Suspense"
              : transaction.ledger
            : selectedBankLedger;
        // } else {
        //   // Cr is present two times in buildxml, means the ledger will in cr and bank will be in dr for contra
        // if(transaction.type === "debit"){
        // }

        if (isEmptyLedgersSelected) {
          if (dr_ledger === selectedBankLedger) {
            cr_ledger = "Suspense";
          } else {
            dr_ledger = "Suspense";
          }
        }
        const tempVoucherType =
          transaction.voucher_type === "Payment Voucher"
            ? "Payment"
            : transaction.voucher_type === "Receipt Voucher"
            ? "Receipt"
            : transaction.voucher_type || "Payment"; // fallback

        return {
          companyName: companyName,
          invoiceDate: formatDateForTally(
            transaction.date || transaction.invoice_date || ""
          ),
          effectiveDate: formatDateForTally(transaction.effective_date || ""),
          // effectiveDate: 20240401,
          // referenceNumber: transaction.reference_number || null,
          billRefernce: transaction.bill_reference || "-",
          DrLedger: dr_ledger,
          CrLedger: cr_ledger,
          amount: transaction.amount,
          narration: transaction.narration,
          voucherName: tempVoucherType,
          id: transaction.id,
        };
      })
      .filter(Boolean);

    setTallyUploadData(tallyData);
    setConfirmationModal(true);
    return true;
  };

  const handleLedgerCreation = async (data) => {
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

      return false;
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
      return false;
    }

    // Prepare data for Tally
    const tallyData = data
      .map((transaction) => {
        if (transaction.imported) {
          // Already uploaded
          return null;
        }
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

    setTallyUploadData(tallyData);
    setConfirmationModal(true);
    // updateReportData({ ledgerCreated: true });

    return true;
  };

  const handleUploadAfterConfirmation = async () => {
    setLoading2(true);
    try {
      let response;
      if (selectedVoucher === "Payment Receipt Contra") {
        response = await window.electron.uploadToTally(tallyUploadData, port);
        console.log("response payment receipt", response);
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
      console.log("selectedBankLedger", selectedBankLedger);
      // selectedBankLedger
      const dbStoreResponse = await window.electron.storeTallyUpload(
        response,
        selectedBankLedger,
        tallyUploadData
      );

      if (dbStoreResponse.success) {
        // Handle successful database storage
        console.log(
          "Tally upload results stored successfully",
          dbStoreResponse.insertedRecords
        );
      } else {
        // Handle storage failure
        console.error(
          "Failed to store Tally upload results",
          dbStoreResponse.error
        );
      }

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

      if (selectedVoucher === "Ledgers") {
        handleLedgerImport();
      }
    } catch (err) {
      console.error("Error uploading to Tally:", err);
    } finally {
      setLoading2(false);
      setConfirmationModal(false);
    }
  };

  const handleLedgerImport = async (isFromRefresh = false) => {
    // if (!companyName.trim()) {
    //   toast({
    //     title: "Error",
    //     description: "Please enter a company name before uploading.",
    //     status: "error",
    //     duration: 5000,
    //     variant: "destructive",
    //     type: "error",
    //   });
    //   return;
    // }

    const response = await window.electron.importLedgers(companyName, port);
    console.log({ importLedgers: response });
    if (response.success) {
      const ledgerData = response.ledgerData;
      removeDuplicateLedgers(ledgerData);
      // TODO - store imported ledgers in db

      updateReportData({ importedLedgerData: ledgerData });
    }
    if (isFromRefresh) {
      toast({
        title: "Success",
        description: `Imported Ledgers and removed already existing ones from above list.`,
        duration: 3000,
        variant: "success",
      });
    }
  };

  const removeDuplicateLedgers = (
    resLedgers = reportData.importedLedgerData
  ) => {
    const currentCompanyName = companyName || reportData.selectedCompany;
    const currentLedgerData = dataToRender || inititalLedgersData;
    if (!currentCompanyName) {
      console.log("Returned as currentCompanyName is null");
      return;
    }
    if (currentLedgerData.length === 0) {
      console.log("Returned as currentLedgerData is empty");
      return;
    }
    if (selectedVoucher !== "Ledgers") return;
    console.log("from removeDuplicates", { resLedgers, currentCompanyName });

    const selectedCompanyData = resLedgers.filter(
      (data) => data.companyName === currentCompanyName
    )[0];

    if (!selectedCompanyData || !selectedCompanyData.ledgerData) {
      console.log("No ledger data found for the selected company");
      return;
    }

    // Create a map of ledger names to their full data from Tally
    const tallyLedgersMap = new Map();
    selectedCompanyData.ledgerData.forEach((ledger) => {
      if (ledger.ledgerName) {
        tallyLedgersMap.set(ledger.ledgerName, ledger);
      }
    });

    // Get unique ledger names for quick lookup
    const uniqueLedgerNames = Array.from(tallyLedgersMap.keys());
    console.log({ uniqueLedgerNames });

    let updatedLedgersData;

    // Instead of just marking as imported, also fill in details from Tally
    updatedLedgersData = dataToRender.map((ledger) => {
      // If the ledger is already in Tally
      if (uniqueLedgerNames.includes(ledger.ledger_name)) {
        const tallyLedgerData = tallyLedgersMap.get(ledger.ledger_name);
        return {
          ...ledger,
          imported: true,
          failed_reason: "", // Clear any previous error
          // Fill in additional details from Tally data
          ledger_group: tallyLedgerData.ledgerGroup || ledger.ledger_group,
          opening_balance:
            tallyLedgerData.openingBalance || ledger.opening_balance,
          gst_number:
            tallyLedgerData.GSTNumber === "null"
              ? ledger.gst_number
              : tallyLedgerData.GSTNumber,
          country:
            tallyLedgerData.country === "null"
              ? ledger.country
              : tallyLedgerData.country,
          state:
            tallyLedgerData.state === "null"
              ? ledger.state
              : tallyLedgerData.state,
        };
      }
      // Otherwise, keep it as not imported
      return ledger;
    });

    // Sort the data so non-imported ledgers appear first
    updatedLedgersData.sort((a, b) => {
      // Sort by imported status first (false comes before true)
      if (a.imported !== b.imported) {
        return a.imported ? 1 : -1;
      }
      // If imported status is the same, sort alphabetically by ledger name
      return a.ledger_name.localeCompare(b.ledger_name);
    });

    // Check if all ledgers are imported
    const allLedgersImported = updatedLedgersData
      ? updatedLedgersData.every((ledger) => ledger.imported === true)
      : false;

    // Update ledger creation status in localStorage based on whether all ledgers are imported
    if (allLedgersImported) {
      localForage
        .setItem(`${caseId}_${currentCompanyName}_ledgersCreated`, true)
        .then(() => {
          console.log(`All ledgers created for ${currentCompanyName}`);
        })
        .catch((err) => {
          console.error("Error saving ledger creation status:", err);
        });
    } else {
      localForage
        .setItem(`${caseId}_${currentCompanyName}_ledgersCreated`, false)
        .catch((err) => {
          console.error("Error saving ledger creation status:", err);
        });
    }

    setDataToRender(updatedLedgersData);
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

        if (parsedData.length === 0) return;

        // Extract header row (first row)
        const headerRow = parsedData[1];

        // Create a mapping of column indices to actual header names
        const headers = Object.keys(headerRow).map((key) => headerRow[key]);

        // Check if a company name column exists
        const companyNameIndex = headers.findIndex(
          (header) =>
            header &&
            typeof header === "string" &&
            header.toLowerCase().includes("company name")
        );

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

            // Store with original header name as key
            transaction[fieldName] = value || "";
          });

          return transaction;
        });

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

  const handleUploadClick = async (transactions = null) => {
    if (selectedVoucher === "Payment Receipt Contra") {
      return await handleTallyUpload(transactions);
    } else if (selectedVoucher === "Ledgers") {
      return await handleLedgerCreation(transactions);
    }
  };

  const recheckTallystatus = async (e) => {
    e.preventDefault();
    const response = await window.electron.checkTallyRunning(port);
    const isTallyRunning = response.success;

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

  const goToSummary = () => {
    setActiveTab("Summary");
  };

  const handleCompanyNameChange = (value) => {
    setCompanyName(value);
    updateReportData({ selectedCompany: value });
  };
  return (
    <div className="p-8">
      <Card className="shadow-none">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center ">
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
                    setCompanyName={handleCompanyNameChange}
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
                  setCompanyName={handleCompanyNameChange}
                  companyName={companyName}
                  selectedVoucher={selectedVoucher}
                  caseId={caseId}
                  handleLedgerImport={handleLedgerImport}
                  selectedBankLedger={selectedBankLedger}
                  setSelectedBankLedger={setSelectedBankLedger}
                  isEmptyLedgersSelected={isEmptyLedgersSelected}
                  setIsEmptyLedgersSelected={setIsEmptyLedgersSelected}
                  port={port}
                  setPort={setPort}
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
            <form onSubmit={recheckTallystatus}>
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
                      onChange={handlePortChange}
                      placeholder="Enter Port Number"
                    />
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className={"mt-4"}>
                {/* <AlertDialogCancel>Cancel</AlertDialogCancel> */}
                <AlertDialogAction onClick={goToSummary}>
                  Go Back
                </AlertDialogAction>
                <Button type="submit" variant="default" className="">
                  <AlertDialogAction onClick={recheckTallystatus}>
                    Retry
                  </AlertDialogAction>
                </Button>
              </AlertDialogFooter>
            </form>
          </AlertDialogContent>
        </AlertDialog>
      </Card>
    </div>
  );
};

export default TallyDirectImport;
