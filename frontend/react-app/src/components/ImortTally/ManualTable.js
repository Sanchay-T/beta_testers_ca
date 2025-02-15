import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Loader2,
  Check,
  Download,
  Save,
  Plus,
  MessageCircle,
  Mail,
  Share2,
  UploadCloud,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
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
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";

/** Default category options */
const categoryOptionsfixed = [
  "Bank Charges",
  "Bank Interest Received",
  "Bonus Paid",
  "Bonus Received",
  "Bounce",
  "Cash Deposits",
  "Cash Reversal",
  "Cash Withdrawal",
  "Closing Balance",
  "Credit Card Payment",
  "Debtor List",
  "Departmental Stores",
  "Donation",
  "Food Expense/Hotel",
  "General Insurance",
  "Gold Loan",
  "GST Paid",
  "Income Tax Paid",
  "Income Tax Refund",
  "Indirect tax",
  "Interest Debit",
  "Interest Received",
  "Investment",
  "Life insurance",
  "Loan",
  "Loan given",
  "Local Cheque Collection",
  "Online Shopping",
  "Opening Balance",
  "Other Expenses",
  "POS-Cr",
  "POS-Dr",
  "Probable Claim Settlement",
  "Property Tax",
  "Provident Fund",
  "Redemption, Dividend & Interest",
  "Refund/Reversal",
  "Rent Paid",
  "Rent Received",
  "Salary Paid",
  "Salary Received",
  "Subscription / Entertainment",
  "TDS Deducted",
  "Total Income Tax Paid",
  "Travelling Expense",
  "UPI-Cr",
  "UPI-Dr",
  "Utility Bills",
  "Loan taken",
  "Loan Given",
  "Self transfer",
];

const DataTableWithColumns = ({
  /**
   * Array of column names to be rendered as table headers.
   * e.g. ["date", "category", "dr_ledger", "cr_ledger", ...]
   * If not provided, the table defaults to 5 columns.
   */
  colnames,
  /**
   * Table data array, each object must have an "id" and matching keys for colnames.
   */
  data = [],
  title,
  subtitle,
  caseId,
  source,
  handleUpload,
  companyName,
  setCompanyName,
}) => {
  // ========= State Hooks =========
  const [transactions, setTransactions] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  // Category filter states
  const [categoryOptions, setCategoryOptions] = useState(categoryOptionsfixed);
  const [categorySearchTerm, setCategorySearchTerm] = useState("");
  const [selectedCategories, setSelectedCategories] = useState([]);

  // Modal & filter states
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [currentFilterColumn, setCurrentFilterColumn] = useState(null);
  const [numericFilterModalOpen, setNumericFilterModalOpen] = useState(false);
  const [currentNumericColumn, setCurrentNumericColumn] = useState(null);
  const [minValue, setMinValue] = useState("");
  const [maxValue, setMaxValue] = useState("");

  // Classification & category update
  const [showClassificationModal, setShowClassificationModal] = useState(false);
  const [selectedType, setSelectedType] = useState("");
  const [newCategoryToClassify, setNewCategoryToClassify] = useState("");
  const [bulkCategoryModalOpen, setBulkCategoryModalOpen] = useState(false);
  const [confirmationModalOpen, setConfirmationModalOpen] = useState(false);
  const [selectedBulkCategory, setSelectedBulkCategory] = useState("");
  const [bulkReasoning, setBulkReasoning] = useState("");
  const [reasoningModalOpen, setReasoningModalOpen] = useState(false);
  const [pendingCategoryChange, setPendingCategoryChange] = useState(null);
  const [currentTransaction, setCurrentTransaction] = useState(null);
  const [showKeywordInput, setShowKeywordInput] = useState(false);
  const [reasoning, setReasoning] = useState("");

  // Columns to ignore
  const [columnsToIgnore] = useState(["id", "transactionId"]);

  // Entity editing
  const [editedEntities, setEditedEntities] = useState({});
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchEntityValue, setBatchEntityValue] = useState("");

  // Global row selection for bulk operations
  const [globalSelectedRows, setGlobalSelectedRows] = useState(new Set());
  const [selectedTransactions, setSelectedTransactions] = useState([]);

  // Ledger fields
  const [ledgerField, setLedgerField] = useState("dr_ledger");
  const [bulkLedgerValue, setBulkLedgerValue] = useState("");

  // Toast
  const { toast } = useToast();

  // Change tracking
  const [hasChanges, setHasChanges] = useState(false);
  const [modifiedData, setModifiedData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Sharing modal
  const [shareModalOpen, setShareModalOpen] = useState(false);

  // For one-time load
  const isFirstLoad = useRef(true);

  // ========= Determine Final Columns =========
  const defaultColnames = ["Column 1", "Column 2", "Column 3", "Column 4", "Column 5"];
  const finalColnames = colnames && colnames.length > 0 ? colnames : defaultColnames;
  const columns = finalColnames.filter((col) => !columnsToIgnore.includes(col));

  const numericColumns = columns.filter((column) =>
    data.some((row) => {
      const value = String(row[column]);
      return !isNaN(parseFloat(value)) && !value.includes("-");
    })
  );
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
  // ========= Data & Default Rows Effect =========
  useEffect(() => {
    if (data.length === 0) {
      // If no data is provided, create 5 default empty rows
      const emptyRows = [];
      for (let i = 0; i < 5; i++) {
        const newRow = { id: Date.now() + i };
        columns.forEach((col) => (newRow[col] = ""));
        emptyRows.push(newRow);
      }
      setTransactions(emptyRows);
      setFilteredData(emptyRows);
    } else {
      const formatted = data.map((row) => ({ ...row }));
      setTransactions(formatted);
      setFilteredData(formatted);
    }

    // Category options from localStorage merge with data
    const storedCats = localStorage.getItem("categoryOptions");
    let localCats = storedCats ? JSON.parse(storedCats) : null;
    if (!localCats) {
      localCats = categoryOptions;
      localStorage.setItem("categoryOptions", JSON.stringify(localCats));
    }
    const dataCats = data.map((tx) => tx.category).filter(Boolean);
    const mergedCats = Array.from(new Set([...localCats, ...dataCats]));
    if (mergedCats.length !== localCats.length) {
      localStorage.setItem("categoryOptions", JSON.stringify(mergedCats));
    }
    setCategoryOptions(mergedCats);
  }, [data, columns]);

  // ========= Handlers =========

  const handleSearch = (value) => {
    setSearchTerm(value);
    if (!value) {
      setFilteredData(transactions);
      return;
    }
    const filtered = transactions.filter((row) =>
      Object.entries(row).some(([key, val]) => {
        if (!val) return false;
        return String(val).toLowerCase().includes(value.toLowerCase());
      })
    );
    setFilteredData(filtered);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setFilteredData(transactions);
    setMinValue("");
    setMaxValue("");
    setSelectedCategories([]);
    setCategorySearchTerm("");
  };

  const handleColumnFilter = () => {
    if (selectedCategories.length === 0) {
      setFilteredData(transactions);
    } else {
      const filtered = transactions.filter((row) =>
        selectedCategories.includes(String(row[currentFilterColumn]))
      );
      setFilteredData(filtered);
    }
  };

  const handleCategorySelect = (category) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((cat) => cat !== category)
        : [...prev, category]
    );
  };

  const handleSelectAllCategoryValues = () => {
    const allValues = getFilteredUniqueValues(currentFilterColumn);
    const allSelected = allValues.every((val) => selectedCategories.includes(val));
    setSelectedCategories(allSelected ? [] : allValues);
  };

  const getUniqueValues = (colName) => {
    return [...new Set(transactions.map((row) => String(row[colName] || "")))];
  };
  const getFilteredUniqueValues = (colName) => {
    const unique = getUniqueValues(colName);
    if (!categorySearchTerm) return unique;
    return unique.filter((v) =>
      v.toLowerCase().includes(categorySearchTerm.toLowerCase())
    );
  };

  const handleNumericFilter = (colName, min, max) => {
    const filtered = transactions.filter((row) => {
      const val = parseFloat(row[colName]);
      if (isNaN(val)) return false;
      const meetsMin = min === "" || val >= parseFloat(min);
      const meetsMax = max === "" || val <= parseFloat(max);
      return meetsMin && meetsMax;
    });
    setFilteredData(filtered);
  };

  const handleCategoryChange = (row, newCategory) => {
    const oldCategory = row.category;
    const isDebit = row.credit === 0; // adjust as needed
    setPendingCategoryChange({
      transactionId: row.id,
      oldCategory,
      newCategory,
      isDebit,
    });
    setCurrentTransaction(row);
    setReasoningModalOpen(true);
  };

  const confirmCategoryChange = () => {
    if (!pendingCategoryChange) return;
    const { transactionId, oldCategory, newCategory } = pendingCategoryChange;
    const updated = filteredData.map((tx) =>
      tx.id === transactionId ? { ...tx, category: newCategory } : tx
    );
    setFilteredData(updated);
    const changedRow = updated.find((r) => r.id === transactionId);
    let finalObj = {
      ...changedRow,
      oldCategory,
      keyword: showKeywordInput ? reasoning : "",
    };
    if (selectedType) {
      finalObj.classification = selectedType;
      finalObj.is_new = true;
    } else {
      finalObj.is_new = false;
    }
    setModifiedData((prev) => [...prev, finalObj]);
    setHasChanges(true);
    setReasoning("");
    setShowKeywordInput(false);
    setSelectedType("");
    setReasoningModalOpen(false);
    setPendingCategoryChange(null);
  };

  const handleBulkCategoryChange = () => {
    const dataCopy = [...filteredData];
    const newModified = [...modifiedData];
    globalSelectedRows.forEach((id) => {
      const index = dataCopy.findIndex((r) => r.id === id);
      if (index !== -1) {
        const oldCategory = dataCopy[index].category;
        dataCopy[index].category =
          selectedBulkCategory === "" ? categorySearchTerm : selectedBulkCategory;
        if (selectedType) {
          dataCopy[index].classification = selectedType;
          dataCopy[index].is_new = true;
        }
        newModified.push({
          ...dataCopy[index],
          oldCategory,
          reasoning: bulkReasoning,
        });
      }
    });
    setFilteredData(dataCopy);
    setModifiedData(newModified);
    setHasChanges(true);
    setGlobalSelectedRows(new Set());
    setBulkCategoryModalOpen(false);
    setConfirmationModalOpen(false);
    setSelectedBulkCategory("");
    setBulkReasoning("");
    setSelectedType("");
  };

  const handleAddCategory = (newCategory, row) => {
    if (newCategory && !categoryOptions.includes(newCategory)) {
      setNewCategoryToClassify(newCategory);
      const updatedCats = [...categoryOptions, newCategory].sort();
      setCategoryOptions(updatedCats);
      localStorage.setItem("categoryOptions", JSON.stringify(updatedCats));
      if (row) {
        setPendingCategoryChange({
          transactionId: row.id,
          newCategory,
          oldCategory: row.category,
          isDebit: row.credit === 0,
        });
        setShowClassificationModal(true);
      } else {
        setShowClassificationModal(true);
      }
      return true;
    }
    return false;
  };

  const handleClassificationSubmit = () => {
    if (!newCategoryToClassify) return;
    if (pendingCategoryChange) {
      setPendingCategoryChange({
        ...pendingCategoryChange,
        newCategory: newCategoryToClassify,
      });
      setCurrentTransaction(
        filteredData.find((tx) => tx.id === pendingCategoryChange.transactionId)
      );
      setReasoningModalOpen(true);
    } else if (bulkCategoryModalOpen) {
      setSelectedBulkCategory(newCategoryToClassify);
      setPendingCategoryChange(null);
    }
    setShowClassificationModal(false);
    setNewCategoryToClassify("");
  };

  // ===== Entity Editing =====
  const handleEntityChange = (tid, newValue) => {
    setEditedEntities((prev) => ({ ...prev, [tid]: newValue }));
  };

  const handleEntityUpdateConfirm = (row) => {
    if (!row) return;
    const tid = row.id;
    const newVal = editedEntities[tid];
    if (
      window.confirm("Are you sure you want to update the Entity for this row?")
    ) {
      entityUpdateIpc([{ entity: newVal, transactionId: tid }]);
      setFilteredData((prev) => {
        const copy = [...prev];
        const idx = copy.findIndex((r) => r.id === tid);
        if (idx !== -1) {
          copy[idx] = { ...copy[idx], entity: newVal };
        }
        return copy;
      });
      setEditedEntities((prev) => {
        const copy = { ...prev };
        delete copy[tid];
        return copy;
      });
    }
  };

  const entityUpdateIpc = async (payload) => {
    try {
      console.log("Entity update payload => ", payload);
      toast({
        title: "Entity Updated",
        description: "Entity update successful.",
      });
    } catch (err) {
      toast({
        title: "Error updating entity",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const handleBatchUpdate = () => {
    if (!batchEntityValue) return;
    if (
      window.confirm(
        "Are you sure you want to update the Entity for the selected rows?"
      )
    ) {
      const dataCopy = [...filteredData];
      const payload = [];
      globalSelectedRows.forEach((id) => {
        const idx = dataCopy.findIndex((r) => r.id === id);
        if (idx !== -1) {
          dataCopy[idx].entity = batchEntityValue;
          payload.push({ entity: batchEntityValue, transactionId: dataCopy[idx].id });
        }
      });
      setFilteredData(dataCopy);
      entityUpdateIpc(payload);
      setGlobalSelectedRows(new Set());
      setBatchEntityValue("");
      setBatchModalOpen(false);
    }
  };

  const toggleRowSelection = (id) => {
    setGlobalSelectedRows((prev) => {
      const copy = new Set(prev);
      copy.has(id) ? copy.delete(id) : copy.add(id);
      return copy;
    });
  };

  const toggleTransactionSelection = (id) => {
    setSelectedTransactions((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    );
  };

  const toggleSelectAllTransactions = () => {
    if (selectedTransactions.length === filteredData.length) {
      setSelectedTransactions([]);
    } else {
      setSelectedTransactions(filteredData.map((t) => t.id));
    }
  };

  const handleBulkLedgerUpdate = () => {
    if (!bulkLedgerValue) return;
    const dataCopy = [...filteredData];
    dataCopy.forEach((row) => {
      if (selectedTransactions.includes(row.id)) {
        row[ledgerField] = bulkLedgerValue;
      }
    });
    setFilteredData(dataCopy);
    setTransactions(dataCopy);
    setSelectedTransactions([]);
    setBulkLedgerValue("");
  };

  // ===== Add Transaction: Directly add a new empty row =====
  const handleAddTransaction = () => {
    const newId = Date.now();
    const newRow = { id: newId };
    columns.forEach((col) => (newRow[col] = ""));
    setTransactions((prev) => [...prev, newRow]);
    setFilteredData((prev) => [...prev, newRow]);
  };

  const handleSaveChanges = async () => {
    setIsLoading(true);
    try {
      console.log("Modified Data => ", modifiedData);
      const payload = modifiedData.reduce((acc, transaction) => {
        acc[transaction.id] = transaction;
        return acc;
      }, {});
      console.log("Payload => ", payload);
      toast({
        title: "Changes saved successfully",
        description: "All category updates have been saved",
      });
      setHasChanges(false);
      setModifiedData([]);
      setSelectedType("");
    } catch (err) {
      toast({
        title: "Error saving changes",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    exportToExcel(filteredData, title);
  };

  const handleUploadToTally = () => {
    console.log("Uploading to Tally => ", transactions);
    if (handleUpload) handleUpload(transactions);
  };

  const handleShare = () => {
    setShareModalOpen(true);
  };

  const handleMailShare = async () => {
    const fileName = await exportToExcel(filteredData, `${title}.xlsx`, true);
    if (!fileName) {
      alert("File saving was canceled.");
      return;
    }
    const subject = encodeURIComponent(`${title} Report`);
    const body = encodeURIComponent(
      `Please find the attached ${title} report.\n\n📌 Don't forget to manually attach the saved file before sending.`
    );
    const mailtoLink = `mailto:?subject=${subject}&body=${body}`;
    window.location.href = mailtoLink;
  };

  const handleWhatsappShare = async () => {
    const fileName = await exportToExcel(filteredData, `${title}.xlsx`, true);
    if (!fileName) {
      alert("File saving was canceled.");
      return;
    }
    const message = encodeURIComponent(
      `📁 Please find the attached Report: ${title}\n\n📌 Don't forget to manually attach the saved file before sending.`
    );
    const whatsappLink = `https://api.whatsapp.com/send?text=${message}`;
    window.open(whatsappLink, "_blank");
  };

  const handleInputChange = (transactionId, column, value) => {
    setFilteredData((prev) =>
      prev.map((r) => (r.id === transactionId ? { ...r, [column]: value } : r))
    );
    setTransactions((prev) =>
      prev.map((r) => (r.id === transactionId ? { ...r, [column]: value } : r))
    );
  };

  // ========= Render =========
  return (
    <Card className="min-w-full">
      {/* Top Bar */}
      <div className="flex justify-between items-center px-4 pt-2">
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
            onChange={(e) => setCompanyName?.(e.target.value)}
            onFocus={(e) => e.target.select()}
            className="border rounded-md p-2 w-64 dark:bg-gray-800 dark:text-white"
          />
        </div>
        <div className="flex gap-4 p-4 pb-0">
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
            className="border rounded-md p-2 w-64 dark:bg-gray-800 dark:text-white"
          />
          <Button onClick={handleBulkLedgerUpdate} disabled={selectedTransactions.length === 0}>
            Set for Selected
          </Button>
        </div>
      </div>

      <CardHeader>
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <Button
              onClick={handleUploadToTally}
              className="px-6 py-3 text-base font-medium text-white bg-gray-900 dark:bg-gray-800 hover:bg-gray-700 transition-all rounded-lg flex items-center gap-2 shadow-sm"
            >
              <UploadCloud className="w-5 h-5 text-white" />
              Upload to Tally
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex items-center gap-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                className="pl-10 w-[300px]"
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
              />
              <Button
                variant="outline"
                className="px-3 py-1.5 text-sm font-medium border border-gray-300 dark:border-gray-600 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-md shadow-sm"
                onClick={clearFilters}
              >
                Clear Filters
              </Button>
              <div className="flex gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="p-2 rounded-md bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 shadow-sm"
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
                      size="icon"
                      className="p-2 rounded-md bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 shadow-sm"
                      onClick={handleShare}
                    >
                      <Share2 className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Share</TooltipContent>
                </Tooltip>
              </div>
              {columns.includes("entity") && (
                <Button
                  variant="default"
                  className="ml-2"
                  disabled={globalSelectedRows.size === 0}
                  onClick={() => setBatchModalOpen(true)}
                >
                  Batch Edit Entities
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {filteredData.length === 0 ? (
          <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-md text-center">
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              No transactions found.
            </p>
            <Button onClick={handleAddTransaction}>Add Transaction</Button>
          </div>
        ) : (
          <div className="relative overflow-x-auto">
            <Table className="w-full">
              <TableHeader className="bg-gray-200 dark:bg-gray-900">
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selectedTransactions.length === filteredData.length}
                      onCheckedChange={toggleSelectAllTransactions}
                    />
                  </TableHead>
                  {columns.map((col) => {
                    const colTitle = col
                      .split("_")
                      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                      .join(" ");
                    return (
                      <TableHead key={col} className="whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {["dr_ledger", "cr_ledger"].includes(col) && (
                            <p className="text-lg text-gray-500 dark:text-gray-400">*</p>
                          )}
                          {colTitle}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => {
                              if (numericColumns.includes(col)) {
                                setCurrentNumericColumn(col);
                                setNumericFilterModalOpen(true);
                              } else {
                                setCurrentFilterColumn(col);
                                setSelectedCategories([]);
                                setCategorySearchTerm("");
                                setFilterModalOpen(true);
                              }
                            }}
                          >
                            ▼
                          </Button>
                        </div>
                      </TableHead>
                    );
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((row) => (
                  <TableRow
                    key={row.id}
                    className={`${
                      row.imported
                        ? "bg-green-100 dark:bg-green-900 hover:bg-green-200 dark:hover:bg-green-800"
                        : "hover:bg-gray-100 dark:hover:bg-gray-800"
                    }`}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedTransactions.includes(row.id)}
                        onCheckedChange={() => toggleTransactionSelection(row.id)}
                      />
                    </TableCell>
                    {columns.map((col) => {
                      const lowerCol = col.toLowerCase();
                      if (lowerCol === "entity") {
                        const original = row[col];
                        const editing = editedEntities[row.id] !== undefined;
                        const newVal = editing ? editedEntities[row.id] : original;
                        return (
                          <TableCell key={col}>
                            <div className="flex items-center">
                              <Input
                                type="text"
                                value={newVal || ""}
                                onChange={(e) => handleEntityChange(row.id, e.target.value)}
                                className="w-full"
                              />
                              {editing && newVal !== original && (
                                <Check
                                  className="ml-2 cursor-pointer text-green-500"
                                  onClick={() => handleEntityUpdateConfirm(row)}
                                />
                              )}
                            </div>
                          </TableCell>
                        );
                      }
                      if (lowerCol === "category") {
                        return (
                          <TableCell key={col} className="max-w-[200px] group relative">
                            <Select
                              value={row[col] || ""}
                              onValueChange={(value) => handleCategoryChange(row, value)}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue>{row[col] || "Select category"}</SelectValue>
                              </SelectTrigger>
                              <SelectContent onCloseAutoFocus={(e) => e.preventDefault()}>
                                <div className="p-2 border-b flex gap-2">
                                  <div className="relative flex-1">
                                    <Input
                                      placeholder="Search categories..."
                                      value={categorySearchTerm}
                                      onChange={(e) => setCategorySearchTerm(e.target.value)}
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
                                    className="px-2 h-10"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      if (categorySearchTerm.trim()) {
                                        const added = handleAddCategory(categorySearchTerm.trim(), row);
                                        if (added) {
                                          setCategorySearchTerm("");
                                        }
                                      }
                                    }}
                                  >
                                    <Plus className="h-4 w-4" /> Add
                                  </Button>
                                </div>
                                <div className="max-h-[200px] overflow-y-auto">
                                  {categoryOptions
                                    .filter((c) =>
                                      c.toLowerCase().includes(categorySearchTerm.toLowerCase())
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
                      if (lowerCol === "narration") {
                        return (
                          <TableCell key={col} className="max-w-[500px] group relative">
                            <Input
                              type="text"
                              value={row[col] || ""}
                              onChange={(e) => handleInputChange(row.id, col, e.target.value)}
                              placeholder="Enter Narration"
                              className="w-full p-2 border border-gray-300 truncate rounded-md"
                            />
                          </TableCell>
                        );
                      }
                      if (lowerCol === "bill_reference" || lowerCol === "reference_number") {
                        return (
                          <TableCell key={col}>
                            <Input
                              type="text"
                              value={row[col] || ""}
                              onChange={(e) => handleInputChange(row.id, col, e.target.value)}
                              placeholder={`Enter ${col.split("_").join(" ")}`}
                              className="w-full p-2 border border-gray-300 rounded-md"
                            />
                          </TableCell>
                        );
                      }
                      if (lowerCol === "effective_date") {
                        return (
                          <TableCell key={col}>
                            <Input
                              type="date"
                              value={row[col] ? row[col].split("T")[0] : ""}
                              onChange={(e) => handleInputChange(row.id, col, e.target.value)}
                              className="w-full p-2 border border-gray-300 rounded-md"
                            />
                          </TableCell>
                        );
                      }
                      if (["dr_ledger", "cr_ledger"].includes(lowerCol)) {
                        return (
                          <TableCell key={col}>
                            <Input
                              type="text"
                              placeholder={`Enter ${col.split("_").join(" ")}`}
                              value={row[col] || ""}
                              onChange={(e) => handleInputChange(row.id, col, e.target.value)}
                              className="border rounded-md p-2 w-full dark:bg-gray-800 dark:text-white"
                            />
                          </TableCell>
                        );
                      }
                      if (lowerCol === "imported") {
                        const text =
                          row.imported === true
                            ? "Success"
                            : row.failed_reason === ""
                            ? "Not Uploaded Yet"
                            : "Failed";
                        return (
                          <TableCell key={col}>
                            <div>{text}</div>
                          </TableCell>
                        );
                      }
                      return (
                        <TableCell key={col} className="max-w-[200px]">
                          {row[col]}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
              {numericColumns.length > 0 && (
                <TableFooter>
                  <TableRow>
                    <TableCell>Total</TableCell>
                    {columns.map((col) => (
                      <TableCell key={col}>
                        {["credit", "debit", "balance", "amount"].includes(
                          col.toLowerCase()
                        )
                          ? totals[col] || ""
                          : ""}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>
        )}
        {/* Add Transaction Button */}
        <div className="mt-4">
          <Button onClick={handleAddTransaction}>
            <Plus className="w-4 h-4 mr-2" /> Add Transaction
          </Button>
        </div>
      </CardContent>

      {/* Fixed Bottom Actions Bar */}
      {(hasChanges || globalSelectedRows.size > 0) && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 shadow-lg flex justify-end gap-2 z-50">
          {globalSelectedRows.size > 0 && (
            <Button variant="secondary" onClick={() => setBulkCategoryModalOpen(true)}>
              Update Selected ({globalSelectedRows.size})
            </Button>
          )}
          {hasChanges && (
            <Button
              onClick={handleSaveChanges}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Changes
            </Button>
          )}
        </div>
      )}

      {/* ----- All Modals (filter, classification, share, etc.) remain unchanged ----- */}
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
                <span className="text-gray-700 dark:text-white">{val}</span>
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={handleSelectAllCategoryValues}>
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

      <Dialog open={numericFilterModalOpen} onOpenChange={setNumericFilterModalOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Filter {currentNumericColumn}</DialogTitle>
            <p className="text-sm text-gray-600">
              Set the min and max values for the filter.
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
            <Button variant="ghost" onClick={() => setNumericFilterModalOpen(false)}>
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

  

      <Dialog open={confirmationModalOpen} onOpenChange={setConfirmationModalOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Confirm Category Update</DialogTitle>
            <DialogDescription>
              Are you sure you want to update the category to "{selectedBulkCategory}" for {globalSelectedRows.size} transactions?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmationModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="default" onClick={handleBulkCategoryChange}>
              Confirm Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showClassificationModal} onOpenChange={setShowClassificationModal}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Classify New Category</DialogTitle>
            <DialogDescription>
              Please classify "{newCategoryToClassify}" into one of the following types
            </DialogDescription>
          </DialogHeader>
          <RadioGroup
            value={selectedType}
            onValueChange={setSelectedType}
            className="space-y-3"
          >
            {(!pendingCategoryChange?.isDebit || bulkCategoryModalOpen) && (
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Income" id="income" />
                <Label htmlFor="income">Income</Label>
              </div>
            )}
            {(pendingCategoryChange?.isDebit || bulkCategoryModalOpen) && (
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Important Expenses / Payments" id="important_expenses" />
                <Label htmlFor="important_expenses">Important Expenses</Label>
              </div>
            )}
            {(pendingCategoryChange?.isDebit || bulkCategoryModalOpen) && (
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Other Expenses / Payments" id="other_expenses" />
                <Label htmlFor="other_expenses">Other Expenses</Label>
              </div>
            )}
          </RadioGroup>
          <DialogFooter>
            <Button variant="default" onClick={handleClassificationSubmit} disabled={!selectedType}>
              Save Classification
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reasoningModalOpen} onOpenChange={setReasoningModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="mb-2">Category Change Reasoning</DialogTitle>
            <DialogDescription>
              Transaction Details:
              {currentTransaction && (
                <div className="mt-2 p-3 bg-muted rounded-md">
                  <p>
                    <strong>Description:</strong> {currentTransaction.Description}
                  </p>
                  <p>
                    <strong>Category Change:</strong> {pendingCategoryChange?.oldCategory} → {pendingCategoryChange?.newCategory}
                  </p>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox id="show-keywords" checked={showKeywordInput} onCheckedChange={setShowKeywordInput} />
              <Label htmlFor="show-keywords">Add keywords for category change</Label>
            </div>
            {showKeywordInput && (
              <div className="space-y-2">
                <Label>
                  Which keywords made you change the category from "{pendingCategoryChange?.oldCategory}" to "{pendingCategoryChange?.newCategory}"?
                </Label>
                <Input
                  value={reasoning}
                  onChange={(e) => setReasoning(e.target.value)}
                  placeholder="Enter Keyword..."
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setReasoningModalOpen(false);
                setPendingCategoryChange(null);
                setReasoning("");
                setShowKeywordInput(false);
              }}
            >
              Cancel
            </Button>
            <Button variant="default" onClick={confirmCategoryChange} disabled={showKeywordInput && !reasoning}>
              Confirm Change
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={shareModalOpen} onOpenChange={setShareModalOpen}>
        <DialogContent className="max-w-md p-6 rounded-lg shadow-lg border dark:border-gray-700 bg-white dark:bg-gray-900">
          <DialogHeader className="flex justify-between items-center">
            <DialogTitle className="text-lg font-semibold text-gray-800 dark:text-white">
              Share This Report
            </DialogTitle>
          </DialogHeader>
          <div className="flex justify-center gap-6 py-4">
            <TooltipProvider>
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

      {isLoading && (
        <div className="fixed inset-0 bg-white bg-opacity-80 backdrop-blur-sm flex items-center justify-center">
          <Loader2 className="animate-spin h-8 w-8 text-[#3498db]" />
        </div>
      )}
    </Card>
  );
};

export default DataTableWithColumns;
