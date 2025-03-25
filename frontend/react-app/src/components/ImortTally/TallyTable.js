import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Download,
  Plus,
  MessageCircle,
  Mail,
  Share2,
  UploadCloud,
  Copy,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "../ui/card";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  TableFooter,
} from "../ui/table";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { cn } from "../../lib/utils";
import { Checkbox } from "../ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "../ui/pagination";
import { Label } from "../ui/label";
import { useToast } from "../../hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { exportToExcel } from "../exportToExcel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { useReportContext } from "../../contexts/ReportContext";
import { AiFillFileExcel } from "react-icons/ai"; // Install react-icons using npm install react-icons
import { debounce } from "lodash"; // or write a small debounce of your own
import localForage from "localforage";

const ledgerGroups = [
  "Branch / Divisions",
  "Capital Account",
  "Current Assets",
  "Current Liabilities",
  "Direct Expenses",
  "Direct Incomes",
  "Fixed Assets",
  "Indirect Expenses",
  "Indirect Incomes",
  "Investments",
  "Loans (Liability)",
  "Misc. Expenses (ASSET)",
  "Purchase Accounts",
  "Sales Accounts",
  "Suspense A/c",
  "Bank Accounts",
  "Bank OD A/c",
  "Cash-in-Hand",
  "Deposits (Asset)",
  "Duties &amp; Taxes", // <--- &amp; is preserved
  "Loans &amp; Advances (Asset)", // <--- &amp; is preserved
  "Provisions",
  "Reserves &amp; Surplus", // <--- &amp; is preserved
  "Secured Loans",
  "Stock-in-Hand",
  "Sundry Creditors",
  "Sundry Debtors",
  "Unsecured Loans",
  "Profit &amp; Loss A/c", // <--- &amp; is preserved
  "Bank OCC A/c",
];

function decodeHtmlEntities(str) {
  // Replace any &amp; with &
  return str.replace(/&amp;/g, "&");
}

const TallyTable = ({
  data = [],
  title,
  handleUpload,
  companyName,
  setCompanyName,
  selectedVoucher,
  caseId,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [transactions, setTransactions] = useState([]);
  const [filteredData, setFilteredData] = useState(data);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [currentFilterColumn, setCurrentFilterColumn] = useState(null);
  const [numericFilterModalOpen, setNumericFilterModalOpen] = useState(false);
  const [currentNumericColumn, setCurrentNumericColumn] = useState(null);
  const [minValue, setMinValue] = useState("");
  const [maxValue, setMaxValue] = useState("");
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [categorySearchTerm, setCategorySearchTerm] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const columnsToIgnore = ["id", "transactionId"];
  const [dateFilterModalOpen, setDateFilterModalOpen] = useState(false);
  const [currentDateColumn, setCurrentDateColumn] = useState([]);
  const [toDate, setToDate] = useState("");
  const [fromDate, setFromDate] = useState("");

  const [currentData, setCurrentdata] = useState([]);
  const [totalPages, setTotalPages] = useState(0);

  // States for entity updating
  const { toast } = useToast();

  // States for sharing
  const [shareModalOpen, setShareModalOpen] = useState(false);

  // NEW: Using transaction id instead of row index
  const [selectedTransactions, setSelectedTransactions] = useState([]);
  const [bulkLedgerValue, setBulkLedgerValue] = useState("");
  const [ledgerField, setLedgerField] = useState("dr_ledger"); // "dr_ledger" or "cr_ledger"

  // Get report data from context
  const { reportData } = useReportContext();
  const numbericInput = ["pincode", "opening_balance"];
  const dateInput = [""];

  const textAreaInput = [
    "address",
    "state",
    "city",
    "country",
    "gst_number",
    "ledger_name",
  ];
  const [existingFilterData, setExistingFilterData] = useState([]);
  const [showPopup, setShowPopup] = useState(false);
  const [pendingValues, setPendingValues] = useState({});

  const isFirstLoad = useRef(true);

  // Load data for this report when component mounts
  useEffect(() => {
    const loadData = async () => {
      try {
        const savedData = await localForage.getItem(
          `tallyTableData_${selectedVoucher}_${caseId}`
        );
        if (savedData) {
          setTransactions(savedData);
          setFilteredData(savedData);
        } else {
          // Only initialize with provided data if no saved data exists.
          setTransactions(data);
          setFilteredData(data);
        }
      } catch (error) {
        console.error("Error loading saved data:", error);
      }
    };

    loadData();
  }, [caseId]);

  // Save transactions state to localForage whenever it changes (debounced)
  useEffect(() => {
    const saveData = () => {
      try {
        localForage.setItem(
          `tallyTableData_${selectedVoucher}_${caseId}`,
          transactions
        );
        console.log("Data saved for report:", transactions);
      } catch (error) {
        console.error("Error saving data:", error);
      }
    };

    // Use a simple timeout to debounce saves by 1 second
    const timer = setTimeout(() => {
      saveData();
    }, 5000);

    return () => clearTimeout(timer);
  }, [transactions, caseId, selectedVoucher]);

  // A stable ref to our debounced update
  const debouncedUpdate = useRef(
    debounce((transactionId, column, value) => {
      // Now update transactions and filteredData:
      setTransactions((prev) => {
        return prev.map((item) =>
          item.id === transactionId ? { ...item, [column]: value } : item
        );
      });
      setFilteredData((prev) => {
        return prev.map((item) =>
          item.id === transactionId ? { ...item, [column]: value } : item
        );
      });
    }, 300)
  ).current;
  // Helper: Format dates
  const formatValue = (value) => {
    if (value instanceof Date) return value.toLocaleDateString();
    return value;
  };

  useEffect(() => {
    console.log("Data from tally table - ", data);
    const formattedData = data.map((row) => {
      const newRow = { ...row };
      Object.keys(row).forEach((key) => {
        newRow[key] = formatValue(row[key]);
      });
      return newRow;
    });

    // If it's the first load, set the transactions
    if (isFirstLoad) {
      setTransactions(formattedData);
      setFilteredData(formattedData);
      isFirstLoad.current = false;
      return;
    }
  }, [data]);

  // Get dynamic columns from first data item
  let columns = data.length > 0 ? Object.keys(data[0]) : [];
  columns = columns.filter((column) => !columnsToIgnore.includes(column));

  const hasEntity = columns.some((column) => column.toLowerCase() === "entity");

  // Determine which columns are numeric
  const numericColumnstemp = columns.filter((column) =>
    data.every((row) => {
      const value = String(row[column]);
      return !isNaN(parseFloat(value)) && !value.includes("-");
    })
  );

  const numericColumns = [...numericColumnstemp, ...numbericInput];

  const handleSearch = (searchValue) => {
    setSearchTerm(searchValue);
    if (searchValue === "") {
      setFilteredData(data);
      setCurrentPage(1);
      return;
    }

    // Calculate totals for numeric columns
    const totals = numericColumns.reduce((acc, column) => {
      const total = filteredData.reduce((sum, row) => {
        const value = parseFloat(String(row[column]).replace(/,/g, ""));
        return !isNaN(value) ? sum + value : sum;
      }, 0);
      return {
        ...acc,
        [column]: total.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
      };
    }, {});

    const columnsToReplace = ["amount", "balance", "debit", "credit"];
    const filtered = filteredData.filter((row) =>
      Object.entries(row).some(([key, value]) => {
        if (columnsToReplace.includes(key)) {
          return String(value)
            .replace(/,/g, "")
            .toLowerCase()
            .includes(searchValue.toLowerCase());
        }
        return String(value).toLowerCase().includes(searchValue.toLowerCase());
      })
    );

    setFilteredData(filtered);
    setCurrentPage(1);
  };

  //   Filter functions

  const handleCategorySelect = (category) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((cat) => cat !== category)
        : [...prev, category]
    );
  };

  const filteredCategories = ledgerGroups.filter((category) =>
    category.toLowerCase().includes(categorySearchTerm.toLowerCase())
  );

  const handleSelectAll = () => {
    const visibleCategories = getFilteredUniqueValues(currentFilterColumn);
    const allSelected = visibleCategories.every((cat) =>
      selectedCategories.includes(cat)
    );
    setSelectedCategories(allSelected ? [] : visibleCategories);
  };

  const handleColumnFilter = () => {
    const dataToFilter =
      existingFilterData.length > 0 ? existingFilterData : data;
    if (selectedCategories.length === 0) {
      setFilteredData(data);
    } else {
      const filtered = dataToFilter.filter((row) =>
        selectedCategories.includes(String(row[currentFilterColumn]))
      );
      setFilteredData(filtered);
      setExistingFilterData(filtered);
    }
    setCurrentPage(1);
    setFilterModalOpen(false);
  };

  const handleNumericFilter = (columnName, min, max) => {
    const dataToFilter =
      existingFilterData.length > 0 ? existingFilterData : data;
    const filtered = dataToFilter.filter((row) => {
      const value = parseFloat(row[columnName]);
      if (isNaN(value)) return false;
      const meetsMin = min === "" || value >= parseFloat(min);
      const meetsMax = max === "" || value <= parseFloat(max);
      return meetsMin && meetsMax;
    });
    setFilteredData(filtered);
    setExistingFilterData(filtered);
    setCurrentPage(1);
  };

  const handleDateFilter = (columnName, fromDate, toDate) => {
    console.log("Initial filter params:", { columnName, fromDate, toDate });

    const dataToFilter =
      existingFilterData.length > 0 ? existingFilterData : data;

    const parseDate = (dateStr) => {
      if (!dateStr) return null;
      console.log("Parsing date:", dateStr);

      // Handle date input format (yyyy-mm-dd)
      if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const date = new Date(dateStr);
        date.setHours(0, 0, 0, 0);
        console.log("Parsed input date:", date);
        return date;
      }

      // Handle data format (dd/mm/yyyy)
      let day, month, year;
      if (dateStr.includes("/")) {
        [day, month, year] = dateStr.split("/");
      } else if (dateStr.includes("-")) {
        [day, month, year] = dateStr.split("-");
      } else {
        console.warn("Unsupported date format:", dateStr);
        return null;
      }

      // Ensure we have all parts
      if (!day || !month || !year) {
        console.warn("Invalid date parts:", { day, month, year });
        return null;
      }

      // Create date (month - 1 because months are 0-based in JavaScript)
      const date = new Date(year, parseInt(month) - 1, parseInt(day));
      date.setHours(0, 0, 0, 0);

      // Validate the date is correct
      if (isNaN(date.getTime())) {
        console.warn("Invalid date created:", dateStr);
        return null;
      }

      console.log("Parsed data date:", date);
      return date;
    };

    const from = parseDate(fromDate);
    const to = parseDate(toDate);

    if (!from || !to) {
      console.warn("Invalid date range:", { fromDate, toDate });
      return;
    }

    // Set end of day for to date
    to.setHours(23, 59, 59, 999);

    console.log("Processing with date range:", { from, to });

    const filtered = dataToFilter.filter((row) => {
      const rowDateStr = row[columnName];
      const rowDate = parseDate(rowDateStr);

      if (!rowDate) {
        console.warn("Invalid row date:", rowDateStr);
        return false;
      }

      const isInRange = rowDate >= from && rowDate <= to;
      console.log("Row date check:", {
        date: rowDate.toISOString(), // Convert to string for better logging
        isInRange,
        value: row[columnName],
      });

      return isInRange;
    });

    // console.log("Filtered results count:", filtered.length);
    setFilteredData(filtered);
    setExistingFilterData(filtered);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setFilteredData(transactions);
    setCurrentPage(1);
    setMinValue("");
    setMaxValue("");
    setSelectedCategories([]);
    setCategorySearchTerm("");
    setFromDate("");
    setToDate("");
    setExistingFilterData([]);
    setSelectedTransactions([]);
    setBulkLedgerValue("");
  };

  const getUniqueValues = (columnName) => {
    return [...new Set(data.map((row) => String(row[columnName])))];
  };

  const getFilteredUniqueValues = (columnName) => {
    const uniqueValues = getUniqueValues(columnName);
    if (!categorySearchTerm) return uniqueValues;
    return uniqueValues.filter((value) =>
      value.toLowerCase().includes(categorySearchTerm.toLowerCase())
    );
  };

  const handleCategorySearch = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setCategorySearchTerm(e.target.value);
  };

  useEffect(() => {
    const totalPagesTemp = Math.ceil(filteredData.length / rowsPerPage);
    setTotalPages(totalPagesTemp);
    const startIndexTemp = (currentPage - 1) * rowsPerPage;
    const endIndexTemp = startIndexTemp + rowsPerPage;
    setCurrentdata(filteredData.slice(startIndexTemp, endIndexTemp));
  }, [filteredData, currentPage, rowsPerPage]);

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pageNumbers = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      pageNumbers.push(1);
      if (currentPage > 2) {
        pageNumbers.push("ellipsis");
      }
      if (currentPage !== 1 && currentPage !== totalPages) {
        pageNumbers.push(currentPage);
      }
      if (currentPage < totalPages - 1) {
        pageNumbers.push("ellipsis");
      }
      pageNumbers.push(totalPages);
    }
    return pageNumbers;
  };

  // Calculate totals for numeric columns
  const totals = numericColumns.reduce((acc, column) => {
    const total = filteredData.reduce((sum, row) => {
      const value = parseFloat(row[column]);
      return !isNaN(value) ? sum + value : sum;
    }, 0);
    return { ...acc, [column]: total.toFixed(2) };
  }, {});

  const handleShare = async () => {
    setShareModalOpen(true);
  };

  // const handleDownload = ()=>{
  //   exportToExcel(data,title);
  // }

  const handleDownload = () => {
    let newTitle = title;

    const tmpName = reportData.reportName;
    newTitle = `${tmpName} ${newTitle}`;

    exportToExcel(data, (title = newTitle));
  };

  const handleMailShare = async () => {
    let newTitle = title;
    const tmpName = reportData.customerName
      ? reportData.customerName
      : reportData.reportName;
    newTitle = `${tmpName} ${title}`;

    const fileName = await exportToExcel(data, `${newTitle}.xlsx`, true);
    if (!fileName) return alert("File saving was canceled.");

    // Generate mailto link (without attachment, since it's not possible)
    const subject = encodeURIComponent(`${title} Report`);
    const body = encodeURIComponent(
      `Please find the attached ${title} report.\n\n📌 Don't forget to manually attach the saved file before sending.`
    );
    const mailtoLink = `mailto:?subject=${subject}&body=${body}`;

    // Open mail client **only after the file is saved**
    window.location.href = mailtoLink;
  };

  const handleWhatsappShare = async () => {
    let newTitle = title;
    const tmpName = reportData.customerName
      ? reportData.customerName
      : reportData.reportName;
    newTitle = `${tmpName} ${title}`;

    const fileName = await exportToExcel(data, `${newTitle}.xlsx`, true);
    if (!fileName) return alert("File saving was canceled.");

    // Generate WhatsApp sharing link (without attachment, since it's not possible)
    const message = encodeURIComponent(
      `📁 Please find the attached Report: ${title}\n\n📌 Don't forget to manually attach the saved file before sending.`
    );
    const whatsappLink = `https://api.whatsapp.com/send?text=${message}`;

    // Open WhatsApp Web
    window.open(whatsappLink, "_blank");
  };

  const handleInputChange = (transactionId, column, value) => {
    setPendingValues((prev) => ({
      ...prev,
      [transactionId]: {
        ...prev[transactionId],
        [column]: value,
      },
    }));

    // Immediately update transactions and filteredData for UI & filtering.
    setTransactions((prev) =>
      prev.map((item) =>
        item.id === transactionId ? { ...item, [column]: value } : item
      )
    );
    setFilteredData((prev) =>
      prev.map((item) =>
        item.id === transactionId ? { ...item, [column]: value } : item
      )
    );

    debouncedUpdate(transactionId, column, value);
  };

  const handleUploadToTally = async () => {
    let data = transactions;
    // Check if any rows are selected
    if (selectedTransactions.length > 0) {
      data = transactions.filter((tx) => selectedTransactions.includes(tx.id));
    }
    if (selectedVoucher === "Ledger") {
      // If no rows selected, show a warning (optional)
      if (selectedTransactions.length === 0) {
        // alert("Please select at least one row to upload.");
        toast({
          title: "Alert",
          variant: "destructive",
          duration: 3000,
          type: "error",
          description: "Please select at least one row to upload.",
        });
        return;
      }
      // 2) Grab only those transactions whose IDs are in `selectedTransactions`
      const selectedRows = data.filter((tx) =>
        selectedTransactions.includes(tx.id)
      );
      data = selectedRows;
    }
    console.log({ data });
    handleUpload(data);
  };

  const toggleTransactionSelection = (transactionId) => {
    setSelectedTransactions((prev) =>
      prev.includes(transactionId)
        ? prev.filter((id) => id !== transactionId)
        : [...prev, transactionId]
    );
  };

  const toggleSelectAll = () => {
    setSelectedTransactions((prev) =>
      prev.length === filteredData.length ? [] : filteredData.map((t) => t.id)
    );
  };

  const handleBulkLedgerUpdate = () => {
    console.log(ledgerField, bulkLedgerValue, selectedTransactions);
    setTransactions((prevTransactions) =>
      prevTransactions.map((transaction) => {
        return transaction[ledgerField].length === 0
          ? { ...transaction, [ledgerField]: bulkLedgerValue }
          : transaction;
      })
    );

    setFilteredData((prevData) =>
      prevData.map((transaction) => {
        return transaction[ledgerField].length === 0
          ? { ...transaction, [ledgerField]: bulkLedgerValue }
          : transaction;
      })
    );
    setSelectedTransactions([]);
    setBulkLedgerValue("");
  };

  const renderCell = (row, column) => {
    const value = row[column];

    // If we're in editing mode and an input type is defined,
    // render an input field based on the inputType.
    let typeProp = null;

    if (numbericInput.includes(column)) {
      typeProp = "number";
    }
    if (dateInput.includes(column)) {
      typeProp = "date";
    }
    if (textAreaInput.includes(column)) {
      typeProp = "text";
    }

    if (typeProp) {
      return (
        <Input
          type={typeProp}
          value={value || ""}
          onChange={(e) => handleInputChange(row.id, column, e.target.value)}
          className="w-full p-2 border rounded-md"
        />
      );
    }

    // Otherwise, simply render the value.
    return <div>{value}</div>;
  };

  const handleCopyToClipboard = () => {
    // Use the same "columns" array (filtered to ignore unwanted keys)
    // const headerRow = columns.join('\t');
    // Map over the filteredData (or data you want to copy) and join each row's values with a tab.
    const rows = filteredData.map((row) => {
      const rowValues = columns.map((col) => {
        if (col === "bill_reference") {
          return row[col] ? row[col] : "-";
        }
        return row[col];
      });
      return [companyName, ...rowValues].join("\t");
    });

    // const textToCopy = [headerRow, ...rows].join('\n');
    const textToCopy = [...rows].join("\n");

    navigator.clipboard
      .writeText(textToCopy)
      .then(() => {
        toast({
          title: "Copied to Clipboard",
          description: "You can now paste the data directly into Excel.",
        });
      })
      .catch((err) => {
        console.error("Error copying text: ", err);
      });
  };
  const handleOpenFile = async (filePath) => {
    console.log("filePath", filePath);
    try {
      const response = await window.electron.openFile(filePath);
      if (response.error) {
        throw new Error(response.error); // If there's an error, throw it
      }
      console.log("File opened successfully:", response);
      setShowPopup(false);
    } catch (error) {
      console.error(error);
    }
  };

  const makeReadable = (column) => {
    return column
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()) // Capitalize
      .join(" ");
  };

  const handleAddRow = () => {
    // Create an empty row object. Use Date.now() for a unique id.
    const newRow = { id: Date.now() };

    // Populate each expected column with an empty string.
    columns.forEach((column) => {
      newRow[column] = "";
    });
    newRow.isAdded = true;

    // Optionally, initialize any additional fields here.

    // Update state so the new row is at the top of the list.
    setTransactions((prev) => [newRow, ...prev]);
    setFilteredData((prev) => [newRow, ...prev]);

    // Also update pendingValues if needed so the new row is editable immediately.
    setPendingValues((prev) => ({ ...prev, [newRow.id]: {} }));
  };

  const handleDeleteRow = (rowId) => {
    setFilteredData((prevData) => prevData.filter((row) => row.id !== rowId));
  };

  return (
    <Card className="min-w-full max-w-[0]">
      <CardHeader className="flex flex-col gap-4 p-4">
        {/* Top Row: Company Info and Ledger Selection */}
        <div className="flex flex-wrap justify-between items-center gap-4">
          {/* Company Name Section */}
          <div className="flex items-center gap-4">
            <label htmlFor="companyName" className="font-medium">
              Company Name:
            </label>
            <input
              id="companyName"
              type="text"
              placeholder="Enter Company Name"
              value={companyName}
              tabIndex="0"
              onChange={(e) => setCompanyName(e.target.value)}
              className="border rounded-md p-2 w-64 dark:bg-gray-800 dark:text-white"
              onFocus={(e) => e.target.select()}
            />
          </div>

          {/* Ledger Selection Controls */}
          {selectedVoucher === "Payment Receipt Contra Voucher" && (
            <div className="flex items-center gap-4">
              <select
                onChange={(e) => setLedgerField(e.target.value)}
                className="border rounded-md p-2 dark:bg-gray-800 dark:text-white"
              >
                <option value="dr_ledger">Dr Ledger</option>
                <option value="cr_ledger">Cr Ledger</option>
              </select>
              <input
                type="text"
                placeholder={`Enter ${ledgerField}`}
                value={bulkLedgerValue}
                onChange={(e) => setBulkLedgerValue(e.target.value)}
                className="border rounded-md p-2 w-64 dark:bg-gray-800 dark:text-white"
              />
              <Button
                onClick={handleBulkLedgerUpdate}
                // disabled={selectedTransactions.length === 0}
              >
                Set for Empty
              </Button>
            </div>
          )}
          {selectedVoucher === "Ledgers" && (
            <Button onClick={handleAddRow} className="ml-auto">
              Add Row
            </Button>
          )}
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  className="p-2 rounded-md bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 
                      transition-all shadow-sm hover:shadow-md flex items-center gap-2"
                  onClick={handleCopyToClipboard}
                >
                  <Copy className="w-4 h-4" />
                  {/* <span>Copy Data</span> */}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copy Data</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  className="p-2 rounded-md bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 
                      transition-all shadow-sm hover:shadow-md"
                  onClick={handleDownload}
                >
                  <Download className="w-4 h-4 text-blue-500" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Download</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  className="p-2 rounded-md bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 
                      transition-all shadow-sm hover:shadow-md"
                  onClick={handleShare}
                >
                  <Share2 className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Share</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Middle Row: Action Buttons and Search */}
        <div className="flex flex-wrap justify-between items-center gap-4">
          {/* Action Buttons Group */}
          <div className="flex items-center gap-2">
            {/* <Button
              onClick={() =>
                handleOpenFile("tallyprime/payment_receipt_contra.xlsm")
              }
              className="px-3 py-2 text-base font-medium text-white transition-all duration-200 ease-in-out rounded-lg flex items-center gap-2 shadow-sm hover:shadow-md"
            >
              <AiFillFileExcel className="w-5 h-5 text-white" />
              Open Voucher
            </Button>
            <Button
              onClick={() => setShowPopup(true)}
              className="px-3 py-2 text-base font-medium text-white transition-all duration-200 ease-in-out rounded-lg flex items-center gap-2 shadow-sm hover:shadow-md"
            >
              <AiFillFileExcel className="w-5 h-5 text-white" />
              Ledger Voucher
            </Button> */}
            <Button
              onClick={handleUploadToTally}
              className="px-3 py-2 text-base font-medium text-white bg-gray-900 dark:bg-gray-800 dark:hover:bg-gray-700 hover:bg-gray-700 transition-all duration-200 ease-in-out rounded-lg flex items-center gap-2 shadow-sm hover:shadow-md"
            >
              <UploadCloud className="w-5 h-5 text-white" />
              Upload to Tally
            </Button>
            <Button
              onClick={handleUploadToTally}
              className="px-3 py-2 text-base font-medium text-white bg-gray-900 dark:bg-gray-800 dark:hover:bg-gray-700 hover:bg-gray-700 transition-all duration-200 ease-in-out rounded-lg flex items-center gap-2 shadow-sm hover:shadow-md"
            >
              <UploadCloud className="w-5 h-5 text-white" />
              Import Ledgers
            </Button>
          </div>

          {/* Search and Filter Controls */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                className="pl-10 w-[300px]"
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>
            <select
              className="p-2 border rounded-md text-sm dark:bg-slate-800 dark:border-slate-700 w-[120px]"
              value={rowsPerPage}
              onChange={(e) => {
                const value = e.target.value;
                setRowsPerPage(Number(value));
                setCurrentPage(1);
              }}
            >
              <option value="10">10 rows</option>
              <option value="20">20 rows</option>
              <option value="50">50 rows</option>
            </select>
            <Button
              variant="outline"
              className="px-3 py-1.5 text-sm font-medium border border-gray-300 dark:border-gray-600 
                bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 
                transition-all rounded-md shadow-sm hover:shadow-md"
              onClick={clearFilters}
            >
              Clear Filters
            </Button>
          </div>
        </div>

        {/* Popup Dialog for ledger selection - kept intact */}
        {showPopup && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full relative">
              <h3 className="text-xl font-semibold text-gray-800 mb-5 text-center">
                Select Ledger Type
              </h3>

              <div className="flex flex-col gap-4">
                <Button
                  onClick={() => handleOpenFile("tallyprime/ledger_prime.xlsm")}
                  className="px-3 py-3 text-base font-medium text-white transition-all duration-200 ease-in-out rounded-lg flex items-center gap-2 shadow-sm hover:shadow-md"
                >
                  <AiFillFileExcel className="w-5 h-5 text-white" />
                  Ledger Prime
                </Button>

                <Button
                  onClick={() => handleOpenFile("tallyprime/ledger_erp.xlsm")}
                  className="px-3 py-3 text-base font-medium text-white transition-all duration-200 ease-in-out rounded-lg flex items-center gap-2 shadow-sm hover:shadow-md"
                >
                  <AiFillFileExcel className="w-5 h-5 text-white" />
                  Ledger ERP
                </Button>
              </div>

              <div className="flex justify-center mt-5">
                <button
                  onClick={() => setShowPopup(false)}
                  className="px-5 py-2 text-sm font-medium text-gray-600 bg-gray-200 rounded-lg hover:bg-gray-300 transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent>
        <div className="relative  overflow-x-auto">
          <Table className="w-full">
            <TableHeader className="bg-gray-200 dark:bg-gray-900">
              <TableRow>
                <TableHead className="w-10 sticky left-0 bg-gray-200 z-10">
                  <Checkbox
                    checked={
                      selectedTransactions.length === filteredData.length
                    }
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                {columns.map((column) => (
                  <TableHead
                    key={column}
                    className={`whitespace-nowrap ${
                      ["bill_reference", "dr_ledger", "cr_ledger"].includes(
                        column
                      )
                        ? "min-w-[180px]"
                        : "min-w-[150px]"
                    } ${column === "narration" && "min-w-[300px]"}`}
                    // className={source === "summary" ? "bg-gray-900 dark:bg-slate-800 text-white" : ""}
                  >
                    <div className="flex items-center gap-2">
                      {["dr_ledger", "cr_ledger"].includes(column) && (
                        <p className="text-lg text-gray-500 dark:text-gray-400">
                          *
                        </p>
                      )}
                      {makeReadable(column)}

                      {[
                        "narration",
                        "bill_reference",
                        "effective_date",
                        "reference_number",
                      ].includes(column.toLowerCase()) === false && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => {
                            if (column.toLowerCase() === "date") {
                              setCurrentFilterColumn(column);
                              setCurrentDateColumn(column);
                              setDateFilterModalOpen(true);
                            } else if (column.toLowerCase() === "amount") {
                              setCurrentNumericColumn(column);
                              setNumericFilterModalOpen(true);
                              setDateFilterModalOpen(false);
                            } else {
                              setCurrentFilterColumn(column);
                              setSelectedCategories([]);
                              setCategorySearchTerm("");
                              setFilterModalOpen(true);
                              setDateFilterModalOpen(false);
                            }
                          }}
                        >
                          ▼
                        </Button>
                      )}
                    </div>
                  </TableHead>
                ))}
                <TableHead className="">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {currentData.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={hasEntity ? columns.length + 1 : columns.length}
                    className="text-center"
                  >
                    No matching results found
                  </TableCell>
                </TableRow>
              ) : (
                currentData.map((row) => {
                  return (
                    <TableRow
                      key={row.id}
                      className={`group ${
                        row.imported
                          ? "bg-green-100 dark:bg-green-900 hover:bg-green-200 dark:hover:bg-green-800"
                          : "hover:bg-gray-100 dark:hover:bg-gray-800"
                      }`}
                      // className={source === "summary" ? "even:bg-slate-200 even:dark:bg-slate-800 hover:bg-transparent even:hover:bg-slate-200" : ""}
                    >
                      <TableCell className={`sticky left-0 bg-white z-10`}>
                        <Checkbox
                          checked={selectedTransactions.includes(row.id)}
                          onCheckedChange={() =>
                            toggleTransactionSelection(row.id)
                          }
                        />
                      </TableCell>
                      {columns.map((column) => {
                        if (column.toLowerCase() === "ledger_group") {
                          return (
                            <TableCell
                              key={column}
                              className="min-w-[250px] group relative"
                            >
                              <Select
                                value={
                                  pendingValues[row.id]?.[column] ??
                                  row[column] ??
                                  ""
                                }
                                onValueChange={(value) => {
                                  handleInputChange(row.id, column, value);
                                  // If this row is selected, update all selected rows
                                  if (selectedTransactions.includes(row.id)) {
                                    selectedTransactions.forEach((id) => {
                                      if (id !== row.id) {
                                        // Skip current row since already updated
                                        handleInputChange(
                                          id,
                                          "ledger_group",
                                          value
                                        );
                                      }
                                    });
                                  }
                                }}
                                className="w-full"
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue>
                                    {row[column] || "Select Ledger Group"}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent
                                  onCloseAutoFocus={(e) => {
                                    e.preventDefault();
                                  }}
                                >
                                  <div className="p-2 border-b flex gap-2">
                                    <div className="relative flex-1">
                                      <Input
                                        placeholder="Search Group..."
                                        value={categorySearchTerm}
                                        onChange={(e) =>
                                          handleCategorySearch(e)
                                        }
                                        // onFocus={() =>
                                        //   setIsSearchInputFocused(true)
                                        // }
                                        // onBlur={() =>
                                        //   setIsSearchInputFocused(false)
                                        // }
                                        onKeyDown={(e) => e.stopPropagation()}
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                        }}
                                      />
                                    </div>
                                    {/* <Button
                                  variant="outline"
                                  size="sm"
                                  className="px-2 h-10"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (categorySearchTerm.trim()) {
                                      // Pass the whole row for a single update
                                      const added = handleAddCategory(
                                        categorySearchTerm.trim(),
                                        row
                                      );
                                      if (added) {
                                        setCategorySearchTerm("");
                                      }
                                    }
                                  }}
                                >
                                  <Plus className="h-4 w-4" />
                                  Add
                                </Button> */}
                                  </div>
                                  <div className="max-h-[200px] overflow-y-auto">
                                    {filteredCategories.length > 0 ? (
                                      filteredCategories.map((ledgerGroup) => (
                                        <SelectItem
                                          key={ledgerGroup}
                                          value={ledgerGroup}
                                        >
                                          {decodeHtmlEntities(ledgerGroup)}
                                        </SelectItem>
                                      ))
                                    ) : (
                                      <div className="p-4 max-w-[300px] text-center text-muted-foreground">
                                        <p className="text-md">
                                          No matching categories found
                                        </p>
                                        <p className="text-sm mt-1">
                                          Click the{" "}
                                          <Plus className="h-3 w-3 inline-block mx-1" />{" "}
                                          icon above to add "
                                          {categorySearchTerm}" as a new
                                          category
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </SelectContent>
                              </Select>
                            </TableCell>
                          );
                        } else if (column.toLowerCase() === "narration") {
                          return (
                            <TableCell
                              key={column}
                              className="max-w-[500px] group relative"
                            >
                              <Input
                                type="text"
                                value={
                                  pendingValues[row.id]?.[column] ??
                                  row[column] ??
                                  ""
                                }
                                onChange={(e) => {
                                  handleInputChange(
                                    row.id,
                                    column,
                                    e.target.value
                                  );
                                  // If this row is selected, update all selected rows
                                  if (selectedTransactions.includes(row.id)) {
                                    selectedTransactions.forEach((id) => {
                                      if (id !== row.id) {
                                        // Skip current row since already updated
                                        handleInputChange(
                                          id,
                                          column,
                                          e.target.value
                                        );
                                      }
                                    });
                                  }
                                }}
                                placeholder="Enter Narration"
                                className="w-full p-2 border border-gray-300  truncate rounded-md"
                              />
                              <div className="absolute right-24 top-12 hidden group-hover:block bg-black text-white text-sm rounded p-2 z-50 whitespace-normal min-w-[200px] ">
                                {row[column]}
                              </div>
                            </TableCell>
                          );
                        } else if (
                          column.toLowerCase() === "date" &&
                          row.isAdded
                        ) {
                          return (
                            <TableCell
                              key={column}
                              className="w-[250px] group relative"
                            >
                              {" "}
                              <Input
                                type="date"
                                value={
                                  row[column] ? row[column].split("T")[0] : ""
                                }
                                onChange={(e) =>
                                  handleInputChange(
                                    row.id,
                                    column,
                                    e.target.value
                                  )
                                }
                                className="w-full p-2 border border-gray-300 rounded-md"
                              />
                            </TableCell>
                          );
                        } else if (column.toLowerCase() === "effective_date") {
                          return (
                            <TableCell
                              key={column}
                              className="w-[250px] group relative"
                            >
                              {" "}
                              <Input
                                type="date"
                                value={
                                  row[column] ? row[column].split("T")[0] : ""
                                }
                                onChange={(e) =>
                                  handleInputChange(
                                    row.id,
                                    column,
                                    e.target.value
                                  )
                                }
                                className="w-full p-2 border border-gray-300 rounded-md"
                              />
                            </TableCell>
                          );
                        } else if (column.toLowerCase() === "imported") {
                          return (
                            <TableCell key={column} className="max-w-[200px]">
                              <div>
                                {row[column] === true
                                  ? "Success"
                                  : row.failed_reason === ""
                                  ? "Not Uploaded Yet"
                                  : "Failed"}
                              </div>
                            </TableCell>
                          );
                        } else if (
                          column.toLowerCase() === "dr_ledger" &&
                          data.find((tx) => tx.id === row.id).dr_ledger === ""
                        ) {
                          return (
                            <TableCell>
                              <input
                                type="text"
                                placeholder="Enter Dr-Ledger"
                                value={
                                  pendingValues[row.id]?.[column] ??
                                  row[column] ??
                                  ""
                                }
                                onChange={(e) => {
                                  // Update individual row
                                  handleInputChange(
                                    row.id,
                                    "dr_ledger",
                                    e.target.value
                                  );

                                  // If this row is selected, update all selected rows
                                  if (selectedTransactions.includes(row.id)) {
                                    selectedTransactions.forEach((id) => {
                                      if (id !== row.id) {
                                        // Skip current row since already updated
                                        handleInputChange(
                                          id,
                                          "dr_ledger",
                                          e.target.value
                                        );
                                      }
                                    });
                                  }
                                }}
                                className="border rounded-md p-2 w-full dark:bg-gray-800 dark:text-white"
                              />
                            </TableCell>
                          );
                        } else if (
                          column.toLowerCase() === "cr_ledger" &&
                          data.find((tx) => tx.id === row.id).cr_ledger === ""
                        ) {
                          return (
                            <TableCell>
                              <input
                                type="text"
                                placeholder="Enter Cr-Ledger"
                                value={
                                  pendingValues[row.id]?.[column] ??
                                  row[column] ??
                                  ""
                                }
                                onChange={(e) => {
                                  // Update individual row
                                  handleInputChange(
                                    row.id,
                                    "cr_ledger",
                                    e.target.value
                                  );

                                  // If this row is selected, update all selected rows
                                  if (selectedTransactions.includes(row.id)) {
                                    selectedTransactions.forEach((id) => {
                                      if (id !== row.id) {
                                        // Skip current row since already updated
                                        handleInputChange(
                                          id,
                                          "cr_ledger",
                                          e.target.value
                                        );
                                      }
                                    });
                                  }
                                }}
                                className="border rounded-md p-2 w-full dark:bg-gray-800 dark:text-white"
                              />
                            </TableCell>
                          );
                        } else if (
                          [
                            "opening_balance",
                            "country",
                            "state",
                            "address",
                            "gst_number",
                            "reference_number",
                            "bill_reference",
                            "pincode",
                          ].includes(column.toLowerCase()) ||
                          (column === "ledger_name" &&
                            column === "ledger_name" &&
                            row.isAdded)
                        ) {
                          return (
                            <TableCell>
                              <input
                                type={
                                  numericColumns.includes(column)
                                    ? "number"
                                    : "text"
                                }
                                placeholder={"Enter " + makeReadable(column)}
                                // value={row[column] || ""}
                                value={
                                  pendingValues[row.id]?.[column] ??
                                  row[column] ??
                                  ""
                                }
                                onChange={(e) => {
                                  // Update individual row
                                  handleInputChange(
                                    row.id,
                                    column,
                                    e.target.value
                                  );

                                  // If this row is selected, update all selected rows
                                  if (selectedTransactions.includes(row.id)) {
                                    selectedTransactions.forEach((id) => {
                                      if (id !== row.id) {
                                        // Skip current row since already updated
                                        handleInputChange(
                                          id,
                                          column,
                                          e.target.value
                                        );
                                      }
                                    });
                                  }
                                }}
                                className="border rounded-md p-2 w-full dark:bg-gray-800 dark:text-white"
                              />
                            </TableCell>
                          );
                        } else {
                          return (
                            <TableCell key={column} className="max-w-[200px]">
                              {renderCell(row, column)}
                            </TableCell>
                          );
                        }
                      })}
                      <TableCell className="right-0 z-10">
                        <Tooltip>
                          <TooltipTrigger>
                            <Button
                              variant="ghost"
                              onClick={() => handleDeleteRow(row.id)}
                            >
                              <Trash2 className="w-5 h-5 text-red-500" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete Row</TooltipContent>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>Total</TableCell>
                {columns.slice(0).map((column) => (
                  <TableCell key={column}>
                    {["credit", "debit", "balance", "amount"].includes(
                      column.toLowerCase()
                    )
                      ? totals[column]
                      : ""}
                  </TableCell>
                ))}
              </TableRow>
            </TableFooter>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(prev - 1, 1))
                    }
                    className={cn(
                      "cursor-pointer",
                      currentPage === 1 && "pointer-events-none opacity-50"
                    )}
                  />
                </PaginationItem>
                {getPageNumbers().map((pageNumber, index) => (
                  <PaginationItem key={index}>
                    {pageNumber === "ellipsis" ? (
                      <PaginationEllipsis />
                    ) : (
                      <PaginationLink
                        onClick={() => setCurrentPage(pageNumber)}
                        isActive={currentPage === pageNumber}
                        className="cursor-pointer"
                      >
                        {pageNumber}
                      </PaginationLink>
                    )}
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                    }
                    className={cn(
                      "cursor-pointer",
                      currentPage === totalPages &&
                        "pointer-events-none opacity-50"
                    )}
                  />
                </PaginationItem>

                {/* <div>
              <p className="text:lg font-bold">Total : {filteredData.length}</p>
            </div> */}
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </CardContent>

      {/* Category Filter Modal - Apple Style */}
      {filterModalOpen && (
        <Dialog open={filterModalOpen} onOpenChange={setFilterModalOpen}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle className="dark:text-slate-300">
                Filter {currentFilterColumn}
              </DialogTitle>
              <p className="text-sm text-gray-600">
                Make changes to your filter here. Click save when you're done.
              </p>
            </DialogHeader>
            <Input
              type="text"
              placeholder="Search categories..."
              value={categorySearchTerm}
              onChange={(e) => setCategorySearchTerm(e.target.value)}
              className="mb-4"
            />
            <div className="max-h-60 overflow-y-auto space-y-[1px] mb-4">
              {getFilteredUniqueValues(currentFilterColumn).map((value) => (
                <label
                  key={value}
                  className="flex items-center gap-1 p-2 hover:bg-gray-50 rounded-md cursor-pointer dark:hover:bg-gray-700"
                >
                  <Checkbox
                    checked={selectedCategories.includes(value)}
                    onCheckedChange={() => handleCategorySelect(value)}
                  />
                  <span className="text-gray-700 dark:text-white">{value}</span>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={handleSelectAll}>
                Select All
              </Button>
              <Button
                variant="default"
                className="bg-black hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
                onClick={handleColumnFilter}
              >
                Save changes
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {numericFilterModalOpen && (
        <Dialog
          open={numericFilterModalOpen}
          onOpenChange={setNumericFilterModalOpen}
        >
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Filter {currentNumericColumn}</DialogTitle>
              <p className="text-sm text-gray-600">
                Set the minimum and maximum values for the filter.
              </p>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Minimum Value</Label>
                <Input
                  type="number"
                  value={minValue}
                  onChange={(e) => setMinValue(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Maximum Value</Label>
                <Input
                  type="number"
                  value={maxValue}
                  onChange={(e) => setMaxValue(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setNumericFilterModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="default"
                className="bg-black hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
                onClick={() => {
                  handleNumericFilter(currentNumericColumn, minValue, maxValue);
                  setNumericFilterModalOpen(false);
                }}
              >
                Save changes
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Date Filter Modal */}
      {dateFilterModalOpen && (
        <Dialog
          open={dateFilterModalOpen}
          onOpenChange={setDateFilterModalOpen}
        >
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Filter {currentDateColumn}</DialogTitle>
              <p className="text-sm text-gray-600">
                Select a start and end date for the filter.
              </p>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => {
                    console.log("Start date changed:", e.target.value);
                    setFromDate(e.target.value);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => {
                    console.log("End date changed:", e.target.value);
                    setToDate(e.target.value);
                  }}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setDateFilterModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="default"
                className="bg-black hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
                onClick={() => {
                  console.log("Applying filter with:", {
                    fromDate,
                    toDate,
                    currentDateColumn,
                  });
                  handleDateFilter(currentDateColumn, fromDate, toDate);
                  setDateFilterModalOpen(false);
                }}
              >
                Apply Filter
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* share modal dialog */}
      <Dialog open={shareModalOpen} onOpenChange={setShareModalOpen}>
        <DialogContent className="max-w-md p-6 rounded-lg shadow-lg border dark:border-gray-700 bg-white dark:bg-gray-900">
          {/* Header with Close Button */}
          <DialogHeader className="flex justify-between items-center">
            <DialogTitle className="text-lg font-semibold text-gray-800 dark:text-white">
              Share This Report
            </DialogTitle>
          </DialogHeader>

          {/* Share Options */}
          <div className="flex justify-center gap-6 py-4">
            <TooltipProvider>
              {/* Mail Button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    className="p-4 transition-all rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
                    onClick={handleMailShare}
                  >
                    <Mail className="w-6 h-6 text-red-500" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Share via Email</TooltipContent>
              </Tooltip>

              {/* WhatsApp Button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    className="p-4 transition-all rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
                    onClick={handleWhatsappShare}
                  >
                    <MessageCircle className="w-6 h-6 text-green-500" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Share via WhatsApp</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="text-xs text-left">
            <p>
              <span className="font-bold">Note:</span> Since this software
              operates entirely offline, the report is first downloaded to your
              device before sharing, Please remember to attach the downloaded
              file.
            </p>
          </div>

          {/* Cancel Button */}
          <div className="flex justify-end">
            <Button
              variant="outline"
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              onClick={() => setShareModalOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default TallyTable;
