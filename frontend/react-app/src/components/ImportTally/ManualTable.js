import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Loader2,
  Check,
  Download,
  X,
  Save,
  Plus,
  MessageCircle,
  Mail,
  Share2,
  Trash2,
  Info,
} from "lucide-react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
  Card,
  CardContent,
  CardHeader,
  // CardTitle,
  // CardDescription,
} from "../ui/card";

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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "../ui/dialog";

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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";

// If you have your own exportToExcel logic, import it:
import { exportToExcel } from "../exportToExcel";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

import { useToast } from "../../hooks/use-toast";

const voucherOptions = ["Payment", "Receipt", "Contra"];

const ManualTallyTable = ({
  initialData = [],
  columnsProp = [],
  tableTitle = "Manual Tally Table",
  handleUpload,
  companyName,
  setCompanyName,
}) => {
  const { toast } = useToast();

  // ---------------------------------------------
  // 1) Internal State
  // ---------------------------------------------

  // "transactions" or "rows" we are displaying
  const [allRows, setAllRows] = useState(initialData);

  // The "filtered" array after search/filter
  const [filteredData, setFilteredData] = useState([]);
  // Searching
  const [searchTerm, setSearchTerm] = useState("");

  // Category filtering
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [currentFilterColumn, setCurrentFilterColumn] = useState(null);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [categorySearchTerm, setCategorySearchTerm] = useState("");

  // Numeric filtering
  const [numericFilterModalOpen, setNumericFilterModalOpen] = useState(false);
  const [currentNumericColumn, setCurrentNumericColumn] = useState(null);
  const [minValue, setMinValue] = useState("");
  const [maxValue, setMaxValue] = useState("");

  // Category classification logic
  const [showClassificationModal, setShowClassificationModal] = useState(false);
  const [newCategoryToClassify, setNewCategoryToClassify] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [pendingCategoryChange, setPendingCategoryChange] = useState(null);

  // Reasoning modal
  const [reasoningModalOpen, setReasoningModalOpen] = useState(false);
  const [currentTransaction, setCurrentTransaction] = useState(null);
  const [reasoning, setReasoning] = useState("");
  const [showKeywordInput, setShowKeywordInput] = useState(false);

  // Bulk category update
  const [globalSelectedRows, setGlobalSelectedRows] = useState(new Set());
  const [bulkCategoryModalOpen, setBulkCategoryModalOpen] = useState(false);
  const [confirmationModalOpen, setConfirmationModalOpen] = useState(false);
  const [selectedBulkCategory, setSelectedBulkCategory] = useState("");
  const [bulkReasoning, setBulkReasoning] = useState("");

  const [dateFilterModalOpen, setDateFilterModalOpen] = useState(false);
  const [currentDateColumn, setCurrentDateColumn] = useState([]);
  const [toDate, setToDate] = useState("");
  const [fromDate, setFromDate] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentData, setCurrentData] = useState([]);
  const [totalPages, setTotalPages] = useState(1);

  // Category options. Possibly load from localStorage or a fixed set
  const [categoryOptions, setCategoryOptions] = useState([
    "Bank Charges",
    "Bank Interest Received",
    "Bonus Paid",
    "Cash Deposits",
    "Cash Withdrawal",
    "Income Tax Paid",
    "Loan",
    "Loan given",
    "Other Expenses",
    "Receipt",
    // ... your bigger list
  ]);

  // Entities editing
  const [editedEntities, setEditedEntities] = useState({});
  // For ledger bulk changes
  const [selectedTransactions, setSelectedTransactions] = useState([]);
  const [bulkLedgerValue, setBulkLedgerValue] = useState("");
  const [ledgerField, setLedgerField] = useState("dr_ledger");

  // Loading states
  const [isLoading, setIsLoading] = useState(false);

  // For share
  const [shareModalOpen, setShareModalOpen] = useState(false);

  // If the user wants to track "hasChanges" (like TallyTable did for category changes)
  const [hasChanges, setHasChanges] = useState(false);
  const [modifiedData, setModifiedData] = useState([]);
  const [existingFilterData, setExistingFilterData] = useState([]);

  console.log("initial data", initialData);
  function convertToIsoDate(originalString) {
    // If your original data is "DD-MM-YYYY", parse it to "YYYY-MM-DD"
    const [dd, mm, yyyy] = originalString.split("-");
    return `${yyyy}-${mm}-${dd}`; // e.g. "2025-03-04"
  }
  
  // For "Add Row": We create new blank rows
  const handleAddRow = () => {
    // Create a new row object. We'll assume each column is blank or a default
    const newRow = {};
    console.log({columns})
    columns.forEach((col) => {
      newRow[col] = "";
    });
    // Also might want an ID. E.g. a local negative ID or a random string
    newRow.id = `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    newRow.imported = false;
    newRow.failed_reason = "";

    // Update both allRows and filteredData if no search is active
    setAllRows((prev) => {
      const updated = [...prev, newRow];
      // If there's no active search term, update filteredData too
      if (!searchTerm) {
        setFilteredData(updated);
      }
      return updated;
    });
  };

  // For "Remove Row"
  const handleRemoveRow = (rowId) => {
    // Check if row was newly added or from DB, etc.
    const tempSetAllRows = (prev) => prev.filter((row) => row.id !== rowId);
    setAllRows(tempSetAllRows);
    setFilteredData(tempSetAllRows);
    // Also remove from selection sets
    setGlobalSelectedRows((prev) => {
      const newSet = new Set(prev);
      newSet.delete(rowId);
      return newSet;
    });
  };

  // Instead of deriving columns from data[0], we rely on columnsProp or fallback
  let columns = columnsProp.length > 0 ? columnsProp : [];
  // If still no columns, we try from allRows
  if (columns.length === 0 && allRows.length > 0) {
    columns = Object.keys(allRows[0]).filter((c) => c !== "id");
  }

  // Numeric columns detection
  const numericColumns = columns.filter((column) =>
    allRows.some((row) => {
      const value = String(row[column]);
      return !isNaN(parseFloat(value)) && !value.includes("-");
    })
  );

  // ---------------------------------------------
  // 2) Effects: searching, filtering, pagination
  // ---------------------------------------------
  const parseCustomDate = (dateStr) => {
    if (!dateStr) return null;
    // Check if the string matches the DD-MM-YYYY pattern
    const regex = /^(\d{2})-(\d{2})-(\d{4})$/;
    const match = dateStr.match(regex);
    if (match) {
      const [, day, month, year] = match;
      // Create a date string in the format YYYY-MM-DD
      return new Date(`${year}-${month}-${day}`);
    }
    // Fallback: attempt to create a Date with the original string
    return new Date(dateStr);
  };
  
  // Whenever allRows changes, we reset filteredData
  useEffect(() => {
    console.log({ allRows,initialData });
    setAllRows(initialData);
    setFilteredData(initialData);
  }, [initialData]);

  // Recalculate pagination
  useEffect(() => {
    const totalPagesTemp = Math.ceil(filteredData.length / rowsPerPage) || 1;
    setTotalPages(totalPagesTemp);

    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    setCurrentData(filteredData.slice(startIndex, endIndex));
  }, [filteredData, currentPage, rowsPerPage]);

  // Searching
  const handleSearch = (term) => {
    setSearchTerm(term);
    if (!term) {
      // Reset
      setFilteredData(allRows);
      setCurrentPage(1);
      return;
    }
    const dataToFilter =
      existingFilterData.length > 0 ? existingFilterData : allRows;
    const lower = term.toLowerCase();
    // Filter any row if it matches any column
    const filtered = dataToFilter.filter((row) =>
      Object.entries(row).some(([key, val]) => {
        if (!val) return false;
        return String(val).toLowerCase().includes(lower);
      })
    );
    setFilteredData(filtered);
    setExistingFilterData(filtered);
    setCurrentPage(1);
  };

  // Clear filters
  const clearFilters = () => {
    setSearchTerm("");
    setSelectedCategories([]);
    setCategorySearchTerm("");
    setMinValue("");
    setMaxValue("");
    setFilteredData(allRows);
    setCurrentPage(1);
    setFromDate("");
    setToDate("");
    setExistingFilterData([]);
  };

  // Category filtering
  const handleCategorySelect = (category) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((cat) => cat !== category)
        : [...prev, category]
    );
  };
  const getUniqueValues = (col) => {
    const setVals = new Set();
    allRows.forEach((r) => setVals.add(String(r[col] || "")));
    return [...setVals];
  };
  const getFilteredUniqueValues = (col) => {
    const allVals = getUniqueValues(col);
    if (!categorySearchTerm) return allVals;
    return allVals.filter((val) =>
      val.toLowerCase().includes(categorySearchTerm.toLowerCase())
    );
  };
  const handleSelectAllFilter = () => {
    const visibleCats = getFilteredUniqueValues(currentFilterColumn);
    // if everything is already selected, unselect them
    const allSelected = visibleCats.every((c) =>
      selectedCategories.includes(c)
    );
    setSelectedCategories(allSelected ? [] : visibleCats);
  };
  const handleColumnFilter = () => {
    const dataToFilter =
      existingFilterData.length > 0 ? existingFilterData : allRows;
    if (selectedCategories.length === 0) {
      setFilteredData(allRows);
    } else {
      const filtered = dataToFilter.filter((row) =>
        selectedCategories.includes(String(row[currentFilterColumn]))
      );
      setFilteredData(filtered);
      setExistingFilterData(filtered);
    }
    setFilterModalOpen(false);
    setCurrentPage(1);
  };

  const handleDateFilter = (columnName, fromDate, toDate) => {
    console.log("Initial filter params:", { columnName, fromDate, toDate });
    const dataToFilter =
      existingFilterData.length > 0 ? existingFilterData : initialData;

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

  // Numeric filter
  const handleNumericFilter = (columnName, min, max) => {
    const dataToFilter =
      existingFilterData.length > 0 ? existingFilterData : allRows;
    const filtered = dataToFilter.filter((row) => {
      const val = parseFloat(row[columnName]);
      if (isNaN(val)) return false;
      const meetsMin = !min || val >= parseFloat(min);
      const meetsMax = !max || val <= parseFloat(max);
      return meetsMin && meetsMax;
    });
    setFilteredData(filtered);
    setExistingFilterData(filtered);
    setCurrentPage(1);
  };

  // ---------------------------------------------
  // 3) Category classification & editing
  // ---------------------------------------------
  const handleAddCategory = (newCategory, row) => {
    if (!newCategory) return false;
    if (!categoryOptions.includes(newCategory)) {
      // Show classification modal
      setNewCategoryToClassify(newCategory);
      // Insert into categoryOptions
      const updatedOptions = [...categoryOptions, newCategory].sort();
      setCategoryOptions(updatedOptions);

      if (row) {
        // Single row flow
        setPendingCategoryChange({
          transactionId: row.id,
          newCategory,
          oldCategory: row.category,
          transaction: row,
          isDebit: row.credit === 0, // or your logic
        });
      }
      setShowClassificationModal(true);
      return true;
    }
    return false;
  };

  const handleCategoryChange = (transaction, newCategory) => {
    // We'll capture the old category
    const oldCategory = transaction.category || "";
    setPendingCategoryChange({
      transactionId: transaction.id,
      newCategory,
      oldCategory,
      transaction,
      // isDebit depends on your logic
      isDebit: (transaction.credit || 0) === 0,
    });
    setCurrentTransaction(transaction);
    // Show reasoning modal or classification if it’s brand new
    // But first check if it's an existing or brand new category
    if (!categoryOptions.includes(newCategory)) {
      // brand new category => classification flow
      handleAddCategory(newCategory, transaction);
    } else {
      // existing => just open reasoning
      setReasoningModalOpen(true);
    }
  };

  // Once user confirms
  const confirmCategoryChange = () => {
    if (!pendingCategoryChange) return;
    const { transactionId, newCategory, oldCategory } = pendingCategoryChange;
    // Update row in filteredData & allRows
    setFilteredData((prev) =>
      prev.map((row) =>
        row.id === transactionId ? { ...row, category: newCategory } : row
      )
    );
    setAllRows((prev) =>
      prev.map((row) =>
        row.id === transactionId ? { ...row, category: newCategory } : row
      )
    );

    // Keep track of changes if you do IPC later
    let modifiedObj = {
      transactionId,
      oldCategory,
      newCategory,
      reasoning: showKeywordInput ? reasoning : "",
    };
    if (selectedType) {
      modifiedObj = {
        ...modifiedObj,
        classification: selectedType,
        is_new: true,
      };
    } else {
      modifiedObj = { ...modifiedObj, is_new: false };
    }
    setModifiedData((prev) => [...prev, modifiedObj]);
    setHasChanges(true);

    // close modals
    setReasoningModalOpen(false);
    setPendingCategoryChange(null);
    setReasoning("");
    setShowKeywordInput(false);
    setSelectedType("");
  };

  // Bulk category
  const toggleRowSelection = (id) => {
    setGlobalSelectedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };
  const handleBulkCategoryChange = () => {
    // create copy
    const dataOnUi = filteredData.map((r) => ({ ...r }));
    const newModifiedData = [...modifiedData];

    globalSelectedRows.forEach((id) => {
      const idx = dataOnUi.findIndex((row) => row.id === id);
      if (idx !== -1) {
        const oldCategory = dataOnUi[idx].category || "";
        const newCat = selectedBulkCategory || categorySearchTerm;
        dataOnUi[idx].category = newCat;
        if (selectedType) {
          dataOnUi[idx].classification = selectedType;
          dataOnUi[idx].is_new = true;
        }
        // record the change
        newModifiedData.push({
          transactionId: id,
          oldCategory,
          newCategory: newCat,
          reasoning: bulkReasoning,
        });
      }
    });

    setFilteredData(dataOnUi);
    setAllRows((prevRows) =>
      prevRows.map((row) => {
        const updated = dataOnUi.find((r) => r.id === row.id);
        return updated || row;
      })
    );

    setModifiedData(newModifiedData);
    setHasChanges(true);
    setGlobalSelectedRows(new Set());
    setBulkCategoryModalOpen(false);
    setConfirmationModalOpen(false);
    setSelectedBulkCategory("");
    setBulkReasoning("");
    setSelectedType("");
  };

  // Classification modal
  const handleClassificationSubmit = () => {
    // brand new category classification
    if (bulkCategoryModalOpen) {
      // Bulk route
      setSelectedBulkCategory(newCategoryToClassify);
      setNewCategoryToClassify("");
      setShowClassificationModal(false);
    } else if (pendingCategoryChange) {
      // Single route
      setPendingCategoryChange({
        ...pendingCategoryChange,
        newCategory: newCategoryToClassify,
      });
      setNewCategoryToClassify("");
      setShowClassificationModal(false);
      setReasoningModalOpen(true);
    }
  };

  // ---------------------------------------------
  // 4) Entities, ledger field updates, etc.
  // ---------------------------------------------
  const handleEntityChange = (tid, newValue) => {
    setEditedEntities((prev) => ({ ...prev, [tid]: newValue }));
  };

  const handleEntityUpdateConfirm = (row) => {
    const newVal = editedEntities[row.id];
    // Could confirm() here or just do it
    // Update row in allRows
    setAllRows((prev) =>
      prev.map((r) => (r.id === row.id ? { ...r, entity: newVal } : r))
    );
    setFilteredData((prev) =>
      prev.map((r) => (r.id === row.id ? { ...r, entity: newVal } : r))
    );
    // Clear the local editing
    setEditedEntities((prev) => {
      const newState = { ...prev };
      delete newState[row.id];
      return newState;
    });
    toast({
      title: "Entity updated",
      description: `Updated entity for transaction ${row.id} to "${newVal}"`,
    });
  };

  // If user wants to do a batch entity update
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchEntityValue, setBatchEntityValue] = useState("");
  const handleBatchUpdate = () => {
    if (!batchEntityValue) return;
    const dataOnUi = filteredData.map((r) => ({ ...r }));
    globalSelectedRows.forEach((id) => {
      const idx = dataOnUi.findIndex((r) => r.id === id);
      if (idx !== -1) {
        dataOnUi[idx].entity = batchEntityValue;
      }
    });
    setFilteredData(dataOnUi);
    setAllRows((prev) =>
      prev.map((row) => {
        const updated = dataOnUi.find((r) => r.id === row.id);
        return updated || row;
      })
    );
    setGlobalSelectedRows(new Set());
    setBatchEntityValue("");
    setBatchModalOpen(false);

    toast({
      title: "Batch entity update",
      description: "Successfully updated selected rows.",
    });
  };

  // Ledger updates
  const toggleTransactionSelection = (transactionId) => {
    setSelectedTransactions((prev) =>
      prev.includes(transactionId)
        ? prev.filter((id) => id !== transactionId)
        : [...prev, transactionId]
    );
  };

  const toggleSelectAll = () => {
    // if everything is selected, unselect all
    if (selectedTransactions.length === filteredData.length) {
      setSelectedTransactions([]);
    } else {
      setSelectedTransactions(filteredData.map((t) => t.id));
    }
  };

  const handleBulkLedgerUpdate = () => {
    if (!bulkLedgerValue) return;
    setAllRows((prev) =>
      prev.map((row) =>{
        return row[ledgerField].length === 0
          ? { ...row, [ledgerField]: bulkLedgerValue }
          : row;
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

  const handleLedgerChange = (transactionId, field, value) => {
    // Single row
    setAllRows((prev) =>
      prev.map((row) =>
        row.id === transactionId ? { ...row, [field]: value } : row
      )
    );
    setFilteredData((prev) =>
      prev.map((row) =>
        row.id === transactionId ? { ...row, [field]: value } : row
      )
    );
  };

  // Updating an input in a row
  const handleInputChange = (transactionId, column, value) => {
    setAllRows((prev) =>
      prev.map((row) =>
        row.id === transactionId ? { ...row, [column]: value } : row
      )
    );
    setFilteredData((prev) =>
      prev.map((row) =>
        row.id === transactionId ? { ...row, [column]: value } : row
      )
    );
  };

  // ---------------------------------------------
  // 5) Summations, pagination, other helpers
  // ---------------------------------------------
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

  // Summations for numeric columns
  const totals = numericColumns.reduce((acc, column) => {
    const total = filteredData.reduce((sum, row) => {
      const val = parseFloat(row[column]);
      return !isNaN(val) ? sum + val : sum;
    }, 0);
    return { ...acc, [column]: total.toFixed(2) };
  }, {});

  // Download
  const handleDownload = async () => {
    exportToExcel(allRows, tableTitle);
  };

  // Email / WhatsApp share
  const handleMailShare = async () => {
    const fileName = await exportToExcel(allRows, `${tableTitle}.xlsx`, true);
    if (!fileName) return alert("File saving was canceled.");
    const subject = encodeURIComponent(`${tableTitle} Report`);
    const body = encodeURIComponent(
      `Please find attached ${tableTitle}.\n\n(Attach the file manually if needed.)`
    );
    const mailtoLink = `mailto:?subject=${subject}&body=${body}`;
    window.location.href = mailtoLink;
  };
  const handleWhatsappShare = async () => {
    const fileName = await exportToExcel(allRows, `${tableTitle}.xlsx`, true);
    if (!fileName) return alert("File saving was canceled.");
    const message = encodeURIComponent(
      `Please find attached: ${tableTitle}\n(Attach the file manually if needed.)`
    );
    const whatsappLink = `https://api.whatsapp.com/send?text=${message}`;
    window.open(whatsappLink, "_blank");
  };

  // For Tally direct upload
  const handleUploadToTally = () => {
    let data = allRows;
    // Check if any rows are selected
    if (selectedTransactions.length > 0) {
      data = allRows.filter((tx) => selectedTransactions.includes(tx.id));
    }
    // if(selectedVoucher==="Ledger"){
    //   // If no rows selected, show a warning (optional)
    //   if (globalSelectedRows.length === 0) {
    //     alert("Please select at least one row to upload.");
    //     return;
    //   }

    //   // 2) Grab only those transactions whose IDs are in `selectedTransactions`
    //   const selectedRows = data.filter((tx) =>
    //     globalSelectedRows.includes(tx.id)
    //   );
    //   data=selectedRows
    // }
    console.log({data})
    handleUpload(data);
  };

  // ---------------------------------------------
  // 6) Render
  // ---------------------------------------------
  return (
    <Card className="min-w-full max-w-[0] pt-6">
      <CardContent>
     

{/* Top Controls: Company Name & Action Buttons */}
<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
  {/* Left Side: Company Name */}
  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
    <label htmlFor="companyName" className="font-medium">
      Company Name:
    </label>
    <input
      id="companyName"
      type="text"
      placeholder="Enter Company Name"
      value={companyName}
      onChange={(e) => setCompanyName(e.target.value)}
      className="border rounded-md p-2 w-full sm:w-64 dark:bg-gray-800 dark:text-white"
    />
  </div>

  {/* Right Side: Add Row, Bulk Ledger, Upload to Tally */}
  <div className="flex flex-wrap items-center gap-4">
    <Button onClick={handleAddRow} variant="default">
      <Plus className="w-4 h-4 mr-2" />
      Add Row
    </Button>

    {/* Bulk Ledger */}
    <div className="flex items-center gap-2">
      <select
        onChange={(e) => setLedgerField(e.target.value)}
        className="border rounded-md p-2"
      >
        <option value="dr_ledger">Dr Ledger</option>
        <option value="cr_ledger">Cr Ledger</option>
      </select>
      <input
        type="text"
        placeholder={`Enter ${ledgerField}`}
        value={bulkLedgerValue}
        onChange={(e) => setBulkLedgerValue(e.target.value)}
        className="border rounded-md p-2 w-full sm:w-32 dark:bg-gray-800 dark:text-white"
      />
      <Button
        onClick={handleBulkLedgerUpdate}
        // disabled={selectedTransactions.length === 0}
      >
        Set for Empty
      </Button>
    </div>

    <Button onClick={handleUploadToTally} variant="default">
      <Share2 className="w-4 h-4 mr-2" />
      Upload to Tally
    </Button>
  </div>
</div>

{/* Search & Pagination Controls */}
<div className="flex flex-wrap items-center justify-between gap-4 mb-4">
  <div className="relative">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
    <Input
      placeholder="Search..."
      className="pl-10 w-full sm:w-48"
      value={searchTerm}
      onChange={(e) => handleSearch(e.target.value)}
    />
  </div>

  <div className="flex flex-wrap items-center gap-2">
    <select
      className="p-2 border rounded-md text-sm dark:bg-slate-800 dark:border-slate-700"
      value={rowsPerPage}
      onChange={(e) => {
        setRowsPerPage(Number(e.target.value));
        setCurrentPage(1);
      }}
    >
      <option value="10">10 rows</option>
      <option value="20">20 rows</option>
      <option value="50">50 rows</option>
    </select>

    <Button variant="outline" onClick={clearFilters}>
      Clear Filters
    </Button>

    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" onClick={handleDownload}>
            <Download className="w-4 h-4 text-blue-500" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Download</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShareModalOpen(true)}
          >
            <Share2 className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Share</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  </div>
</div>




        {/* Data Table */}
        <div className="overflow-x-auto max-w-full">
          <Table className="min-w-full min-h-[300px]">
            <TableHeader className="bg-gray-200 dark:bg-gray-900">
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={
                      selectedTransactions.length === filteredData.length &&
                      filteredData.length > 0
                    }
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>

                {columns.map((column) => (
                  <TableHead
                    key={column}
                    className={cn(
                      "whitespace-nowrap",
                      ["narration"].includes(column) && "min-w-[300px]"
                    )}
                  >
                    <div className="flex items-center gap-2">
                    {["dr_ledger","cr_ledger"].includes(column) && <p className="text-lg text-gray-500 dark:text-gray-400">
                        *
                      </p>}
                      {column
                        .split("_")
                        .map(
                          (w) =>
                            w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
                        )
                        .join(" ")}
                      {/* filter button, except for certain columns */}
                      {![
                        "narration",
                        "effective_date",
                        "imported",
                        "reference_number",
                      ].includes(column.toLowerCase()) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => {
                            if (column.toLowerCase() === "invoice_date") {
                              setCurrentFilterColumn(column);
                              setCurrentDateColumn(column);
                              setDateFilterModalOpen(true);
                            } else if (column.toLowerCase() === "amount") {
                              setCurrentNumericColumn(column);
                              setNumericFilterModalOpen(true);
                              setDateFilterModalOpen(false);
                            } else {
                              setCurrentFilterColumn(column);
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

                {/* "Actions" for removing row */}
                <TableHead className="min-w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody >
              {currentData.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length + 2}
                    className="text-center"
                  >
                    No matching results found
                  </TableCell>
                </TableRow>
              ) : (
                currentData.map((row) => (
                  <TableRow
                    key={row.id}
                    className={cn(
                      row.imported
                        ? "bg-green-100 dark:bg-green-900 hover:bg-green-200 dark:hover:bg-green-800"
                        : "hover:bg-gray-50 dark:hover:bg-gray-800"
                    )}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedTransactions.includes(row.id)}
                        onCheckedChange={() =>
                          toggleTransactionSelection(row.id)
                        }
                      />
                    </TableCell>

                    {columns.map((column) => {
                      // Some special cases from TallyTable:
                      if (column.toLowerCase() === "entity") {
                        return (
                          <TableCell key={column}>
                            <div className="flex items-center">
                              <Input
                                type="text"
                                value={
                                  editedEntities[row.id] !== undefined
                                    ? editedEntities[row.id]
                                    : row[column] || ""
                                }
                                onChange={(e) =>
                                  handleEntityChange(row.id, e.target.value)
                                }
                                className="w-full"
                              />
                              {/* If user changed the entity from the original, show a check to confirm */}
                              {editedEntities[row.id] !== undefined &&
                                editedEntities[row.id] !== row[column] && (
                                  <Check
                                    className="ml-2 cursor-pointer text-green-500"
                                    onClick={() =>
                                      handleEntityUpdateConfirm(row)
                                    }
                                  />
                                )}
                            </div>
                          </TableCell>
                        );

                      } else if (column.toLowerCase() === "effective_date" || column.toLowerCase() === "invoice_date") {
                        return (
                          <TableCell key={column} className="w-[250px] group relative">
                          <DatePicker
                                selected={row[column] ? parseCustomDate(row[column]) : null}
                                onChange={(date) =>
                                  handleInputChange(
                                    row.id,
                                    column,
                                    date ? date.toISOString().split("T")[0] : ""
                                  )
                                }
                                dateFormat="yyyy-MM-dd"      // Displays date as 2025-03-04
                                placeholderText="YYYY-MM-DD" // Clear placeholder format
                                className="w-full p-2 border border-gray-300 rounded-md"
                              />
                        </TableCell>
                        );
                      } 
                      // else if (column.toLowerCase() === "invoice_date") {
                      //   return (
                      //     <TableCell
                      //       key={column}
                      //       className="w-[250px] group relative"
                      //     >
                      //       <Input
                      //         type="date"
                      //         value={
                      //           row[column] ? row[column].split("T")[0] : ""
                      //         }
                      //         onChange={(e) =>
                      //           handleInputChange(
                      //             row.id,
                      //             column,
                      //             e.target.value
                      //           )
                      //         }
                      //         className="w-full p-2 border border-gray-300 rounded-md"
                      //       />
                      //     </TableCell>
                      //   );
                      // }

                      if (column.toLowerCase() === "category") {
                        return (
                          <TableCell key={column} className="min-w-[200px]">
                            <Select
                              value={row[column] || ""}
                              onValueChange={(value) =>
                                handleCategoryChange(row, value)
                              }
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue>
                                  {row[column] || "Select category"}
                                </SelectValue>
                              </SelectTrigger>

                              <SelectContent>
                                {/* a small “search input + add” for categories */}
                                <div className="p-2 border-b flex gap-2">
                                  <div className="relative flex-1">
                                    <Input
                                      placeholder="Search categories..."
                                      value={categorySearchTerm}
                                      onChange={(e) =>
                                        setCategorySearchTerm(e.target.value)
                                      }
                                      onKeyDown={(e) => e.stopPropagation()}
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                      }}
                                    />
                                  </div>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      if (categorySearchTerm.trim()) {
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
                                  </Button>
                                </div>
                                {/* list categories */}
                                <div className="max-h-52 overflow-y-auto">
                                  {categoryOptions
                                    .filter((c) =>
                                      c
                                        .toLowerCase()
                                        .includes(
                                          categorySearchTerm.toLowerCase()
                                        )
                                    )
                                    .map((cat) => (
                                      <SelectItem key={cat} value={cat}>
                                        {cat}
                                      </SelectItem>
                                    ))}
                                </div>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        );
                      }

                      if (
                        ["dr_ledger", "cr_ledger"].includes(
                          column.toLowerCase()
                        )
                      ) {
                        return (
                          <TableCell key={column}>
                            <Input
                              type="text"
                              value={row[column] || ""}
                              onChange={(e) => {
                                // Single row
                                handleLedgerChange(
                                  row.id,
                                  column,
                                  e.target.value
                                );

                                // If row is selected, update the others
                                if (selectedTransactions.includes(row.id)) {
                                  selectedTransactions.forEach((id) => {
                                    if (id !== row.id) {
                                      handleLedgerChange(
                                        id,
                                        column,
                                        e.target.value
                                      );
                                    }
                                  });
                                }
                              }}
                              placeholder={`Enter ${column
                                .split("_") // Split by underscore
                                .map(
                                  (word) =>
                                    word.charAt(0).toUpperCase() +
                                    word.slice(1).toLowerCase()
                                ) // Capitalize
                                .join(" ")}`}
                              className="w-full min-w-[200px]"
                            />
                          </TableCell>
                        );
                      }

                      if (column.toLowerCase() === "narration") {
                        return (
                          <TableCell key={column} className="min-w-[300px]">
                            <Input
                              type="text"
                              value={row[column] || ""}
                              onChange={(e) =>
                                handleInputChange(
                                  row.id,
                                  column,
                                  e.target.value
                                )
                              }
                              placeholder="Enter narration"
                              className="w-full"
                            />
                          </TableCell>
                        );
                      }

                      // voucher type
                      if (column.toLowerCase() === "voucher_type") {
                        return (
                          <TableCell key={column}>
                            <Select
                              value={row[column] || ""}
                              onValueChange={(value) =>
                                handleInputChange(row.id, column, value)
                              }
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select voucher type">
                                  {row[column]}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {voucherOptions.map((voucher) => (
                                  <SelectItem key={voucher} value={voucher}>
                                    {voucher}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        );
                      }
                      // Default text input
                      return (
                        <TableCell key={column}>
                          <Input
                            type="text"
                            value={row[column] || ""}
                            onChange={(e) =>
                              handleInputChange(row.id, column, e.target.value)
                            }
                            className="w-full min-w-[200px]"
                            placeholder={`Enter ${column
                              .split("_") // Split by underscore
                              .map(
                                (word) =>
                                  word.charAt(0).toUpperCase() +
                                  word.slice(1).toLowerCase()
                              ) // Capitalize
                              .join(" ")}`}
                          />
                        </TableCell>
                      );
                    })}

                    {/* Actions cell for removing row */}
                    <TableCell className="text-center">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRemoveRow(row.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>Total</TableCell>
                {columns.map((col) => {
                  if (
                    ["credit", "debit", "balance", "amount"].includes(
                      col.toLowerCase()
                    )
                  ) {
                    return <TableCell key={col}>{totals[col] || ""}</TableCell>;
                  }
                  return <TableCell key={col} />;
                })}
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    className={cn(
                      "cursor-pointer",
                      currentPage === 1 && "pointer-events-none opacity-50"
                    )}
                  />
                </PaginationItem>
                {getPageNumbers().map((num, i) => (
                  <PaginationItem key={i}>
                    {num === "ellipsis" ? (
                      <PaginationEllipsis />
                    ) : (
                      <PaginationLink
                        onClick={() => setCurrentPage(num)}
                        isActive={currentPage === num}
                        className="cursor-pointer"
                      >
                        {num}
                      </PaginationLink>
                    )}
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext
                    onClick={() =>
                      setCurrentPage((p) => Math.min(p + 1, totalPages))
                    }
                    className={cn(
                      "cursor-pointer",
                      currentPage === totalPages &&
                        "pointer-events-none opacity-50"
                    )}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}

        {/* Filter Modal for text columns */}
        <Dialog open={filterModalOpen} onOpenChange={setFilterModalOpen}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Filter {currentFilterColumn}</DialogTitle>
              <p className="text-sm text-gray-600">
                Make changes to your filter here.
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
              {getFilteredUniqueValues(currentFilterColumn).map((val) => (
                <label
                  key={val}
                  className="flex items-center gap-1 p-2 hover:bg-gray-50 rounded-md cursor-pointer dark:hover:bg-gray-700"
                >
                  <Checkbox
                    checked={selectedCategories.includes(val)}
                    onCheckedChange={() => handleCategorySelect(val)}
                  />
                  <span className="text-gray-700 dark:text-white">
                    {val || "(empty)"}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={handleSelectAllFilter}>
                Select All
              </Button>
              <Button variant="default" onClick={handleColumnFilter}>
                Save changes
              </Button>
            </div>
          </DialogContent>
        </Dialog>

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

        {/* Numeric Filter Modal */}
        <Dialog
          open={numericFilterModalOpen}
          onOpenChange={setNumericFilterModalOpen}
        >
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Filter {currentNumericColumn}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Min Value</Label>
                <Input
                  type="number"
                  value={minValue}
                  onChange={(e) => setMinValue(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Max Value</Label>
                <Input
                  type="number"
                  value={maxValue}
                  onChange={(e) => setMaxValue(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="ghost"
                onClick={() => setNumericFilterModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="default"
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

        {/* Share Modal */}
        <Dialog open={shareModalOpen} onOpenChange={setShareModalOpen}>
          <DialogContent className="max-w-md p-6">
            <DialogHeader className="flex justify-between items-center">
              <DialogTitle>Share This Report</DialogTitle>
            </DialogHeader>
            <div className="flex justify-center gap-6 py-4">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      className="p-4"
                      onClick={handleMailShare}
                    >
                      <Mail className="w-6 h-6 text-red-500" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Share via Email</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      className="p-4"
                      onClick={handleWhatsappShare}
                    >
                      <MessageCircle className="w-6 h-6 text-green-500" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Share via WhatsApp</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={() => setShareModalOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default ManualTallyTable;
