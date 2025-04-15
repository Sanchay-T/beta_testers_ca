import React, { useState, useEffect, useRef, useMemo } from "react";
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
  Eye,
  ChevronDown,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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
import { Badge } from "../ui/badge";
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
import * as XLSX from "xlsx";
import { useReportContext } from "../../contexts/ReportContext";
import SliderDemo from "../ui/slider";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "../ui/command";

const voucherOptions = ["Payment", "Receipt", "Contra"];

const DataTable = ({
  data = [],
  title,
  subtitle,
  source,
  refreshFunction,
  caseId,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [transactions, setTransactions] = useState([]);
  const [filteredData, setFilteredData] = useState(data);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [currentFilterColumn, setCurrentFilterColumn] = useState(null);
  const [numericFilterModalOpen, setNumericFilterModalOpen] = useState(false);
  const [dateFilterModalOpen, setDateFilterModalOpen] = useState(false);
  const [currentNumericColumn, setCurrentNumericColumn] = useState(null);
  const [minValue, setMinValue] = useState("");
  const [maxValue, setMaxValue] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [categorySearchTerm, setCategorySearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [existingFilterData, setExistingFilterData] = useState([]);
  const [pdfBlob, setPdfBlob] = useState(null);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [currentTransactionType, setCurrentTransactionType] = useState(null);
  const [typeErrorMessage, setTypeErrorMessage] = useState("");

  const [columnsToIgnore, setColumnsToIgnore] = useState([
    "id",
    "transactionId",
    "monthKey",
  ]);

  // const [categoryOptions, setCategoryOptions] = useState([
  //   "UPI-Cr",
  //   "UPI-Dr",
  //   "Bank Charges",
  //   "Bank Interest Received",
  //   "Bounce",
  //   "Bonus Paid",
  //   "Bonus Received",
  //   "Cash Deposits",
  //   "Cash Reversal",
  //   "Cash Withdrawal",
  //   "Credit Card Payment",
  //   "Debtor List",
  //   "Departmental Stores",
  //   "Donation",
  //   "Subscription / Entertainment",
  //   "Food Expense/Hotel",
  //   "General Insurance",
  //   "Gold Loan",
  //   "GST Paid",
  //   "Income Tax Paid",
  //   "Income Tax Refund",
  //   "Indirect tax",
  //   "Interest Debit",
  //   "Interest Received",
  //   "Investment",
  //   "Life insurance",
  //   "Loan",
  //   "Loan given",
  //   "Local Cheque Collection",
  //   "Online Shopping",
  //   "Other Expenses",
  //   "POS-Cr",
  //   "POS-Dr",
  //   "Probable Claim Settlement",
  //   "Property Tax",
  //   "Provident Fund",
  //   "Redemption, Dividend & Interest",
  //   "Refund/Reversal",
  //   "Rent Paid",
  //   "Rent Received",
  //   "TDS Deducted",
  //   "Total Income Tax Paid",
  //   "Travelling Expense",
  //   "Utility Bills",
  //   "Salary Received",
  //   "Salary Paid",
  //   "Self transfer",
  // ]);

  const [categoriesArray, setCategoriesArray] = useState([
    { name: "GST Paid", type: "debit" },
    { name: "Creditor", type: "debit" },
    { name: "Donation", type: "debit" },
    { name: "General Insurance", type: "debit" },
    { name: "Gold Loan", type: "debit" },
    { name: "Income Tax Paid", type: "debit" },
    { name: "Interest Debit", type: "debit" },
    { name: "Investment", type: "debit" },
    { name: "Life insurance", type: "debit" },
    { name: "Probable EMI", type: "debit" },
    { name: "Property Tax", type: "debit" },
    { name: "Rent Paid", type: "debit" },
    { name: "Salary Paid", type: "debit" },
    { name: "TDS Deducted", type: "debit" },
    { name: "Tax Payment", type: "debit" },
    { name: "Total Income Tax Paid", type: "debit" },
    { name: "Travelling Expense", type: "debit" },
    { name: "UPI-Dr", type: "debit" },
    { name: "Suspense", type: "debit" },
    { name: "Bank Charges", type: "debit" },
    { name: "Bounce", type: "debit" },
    { name: "Credit Card Payment", type: "debit" },
    { name: "Departmental Stores", type: "debit" },
    { name: "Food Expense/Hotel", type: "debit" },
    { name: "Indirect tax", type: "debit" },
    { name: "Loan given", type: "debit" },
    { name: "Local Cheque Collection", type: "debit" },
    { name: "Online Shopping", type: "debit" },
    { name: "Other Expenses", type: "debit" },
    { name: "POS-Dr", type: "debit" },
    { name: "Provident Fund", type: "debit" },
    { name: "Refund/Reversal", type: "debit" },
    { name: "Subscription / Entertainment", type: "debit" },
    { name: "Utility Bills", type: "debit" },
    { name: "Cash Withdrawal", type: "debit" },
    { name: "Self transfer", type: "debit" },
    { name: "Debtor", type: "credit" },
    { name: "Suspense", type: "credit" },
    { name: "Bank Interest Received", type: "credit" },
    { name: "Bonus Received", type: "credit" },
    { name: "Cash Reversal", type: "credit" },
    { name: "Income Tax Refund", type: "credit" },
    { name: "Interest Received", type: "credit" },
    { name: "Loan", type: "credit" },
    { name: "Online Shopping", type: "credit" },
    { name: "POS-Cr", type: "credit" },
    { name: "Probable Claim Settlement", type: "credit" },
    { name: "Redemption, Dividend & Interest", type: "credit" },
    { name: "Refund/Reversal", type: "credit" },
    { name: "Rent Received", type: "credit" },
    { name: "Salary Received", type: "credit" },
    { name: "UPI-Cr", type: "credit" },
    { name: "Cash Deposits", type: "credit" },
    { name: "Self transfer", type: "credit" },
  ]);

  const [currentDateColumn, setCurrentDateColumn] = useState([]);

  // Category states
  const [similarCategoryTransactions, setSimilarCategoryTransactions] =
    useState([]);
  const [
    selectedCategorySimilarTransactions,
    setSelectedCategorySimilarTransactions,
  ] = useState(new Set());
  const [categorySelectDropdownOpen, setCategorySelectDropdownOpen] =
    useState(null);

  const [hasChanges, setHasChanges] = useState(false);
  const [modifiedData, setModifiedData] = useState([]);
  const [showKeywordInput, setShowKeywordInput] = useState(false);
  const [currentData, setCurrentdata] = useState([]);
  const [totalPages, setTotalPages] = useState(0);

  // States for entity updating
  // const [similarEntityTransactions, setSimilarEntityTransactions] = useState(
  //   []
  // );
  const [editedEntities, setEditedEntities] = useState({});
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchEntityValue, setBatchEntityValue] = useState("");
  const { toast } = useToast();

  // States for sharing
  const [shareModalOpen, setShareModalOpen] = useState(false);

  // NEW: Using transaction id instead of row index
  const [globalSelectedRows, setGlobalSelectedRows] = useState(new Set());
  const [bulkCategoryModalOpen, setBulkCategoryModalOpen] = useState(false);
  const [selectedBulkCategory, setSelectedBulkCategory] = useState("");
  const [confirmationModalOpen, setConfirmationModalOpen] = useState(false);

  // Classification modal state
  const [selectedType, setSelectedType] = useState("");
  const [showClassificationModal, setShowClassificationModal] = useState(false);
  const [newCategoryToClassify, setNewCategoryToClassify] = useState("");

  // Reasoning modal state
  const [reasoningModalOpen, setReasoningModalOpen] = useState(false);
  const [currentTransaction, setCurrentTransaction] = useState(null);
  const [reasoning, setReasoning] = useState("");
  // We now store pending change by transaction id
  const [pendingCategoryChange, setPendingCategoryChange] = useState(null);
  const [bulkReasoning, setBulkReasoning] = useState("");

  const isFirstLoad = useRef(true);
  const categoryInputRef = useRef(null);

  // states for excel download and upload
  const fileInputRef = useRef(null);
  const [uploadedChanges, setUploadedChanges] = useState([]);
  const [categoryUpdateModalOpen, setCategoryUpdateModalOpen] = useState(false);
  const [pendingCategories, setPendingCategories] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const commandRef = useRef(null);

  const { reportData, updateReportData } = useReportContext();
  const [sliderValue, setSliderValue] = useState(85);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      // Return early if click is on or within a dropdown trigger or its content

      if (event.target.closest(".category-dropdown-container")) {
        return;
      }

      // Otherwise, close dropdowns
      setIsOpen(false);
      setCategorySelectDropdownOpen(null);
    };

    // Listen for clicks if any dropdown is open
    if (isOpen || categorySelectDropdownOpen != null) {
      document.addEventListener("mousedown", handleOutsideClick);
    }

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isOpen, categorySelectDropdownOpen]);
  // Helper: Format dates
  const formatValue = (value) => {
    if (value instanceof Date) return value.toLocaleDateString();
    return value;
  };

  useEffect(() => {
    let timer;
    try {
      timer = setTimeout(() => {
        if (categoryInputRef.current) {
          categoryInputRef.current.focus();
        }
      }, 0); // delay until after the render cycle
    } catch (e) {
      // console.log({ hey: e });
    }

    return () => clearTimeout(timer);
  }, [categorySearchTerm]);

  useEffect(() => {
    setCategorySearchTerm("");
  }, [categorySelectDropdownOpen]);

  useEffect(() => {
    // console.log("Data from unified - ", data);
    const formattedData = data.map((row) => {
      const newRow = { ...row };
      Object.keys(row).forEach((key) => {
        newRow[key] = formatValue(row[key]);
      });
      return newRow;
    });

    // If it's the first load, set the transactions
    if (isFirstLoad.current) {
      setTransactions(formattedData);
      setFilteredData(formattedData);
      isFirstLoad.current = false;
      return;
    }
    // Preserve user modifications while updating other data
    setFilteredData((prevFilteredData) => {
      return formattedData.map((newRow) => {
        const modifiedRow = prevFilteredData.find(
          (prevRow) => prevRow.id === newRow.id
        );
        return modifiedRow
          ? {
              ...newRow,
              category: modifiedRow.category,
              // entity: modifiedRow.entity,
              ledger: modifiedRow.ledger,
              entity: modifiedRow.entity,
            }
          : newRow;
      });
    });

    setTransactions(formattedData);

    // const storedCategories = localStorage.getItem("categoryOptions");
    // console.log("Stored categories", storedCategories);
    // let localCats = storedCategories ? JSON.parse(storedCategories) : null;
    // if (!localCats) {
    //   localCats = categoryOptions;
    //   localStorage.setItem("categoryOptions", JSON.stringify(localCats));
    // }

    // const transCats = transactions.map((tx) => tx.category);
    // const mergedCategories = Array.from(new Set([...localCats, ...transCats]));
    // // Step 3: If there are any new categories, update localStorage.
    // if (mergedCategories.length !== localCats.length) {
    //   localStorage.setItem("categoryOptions", JSON.stringify(mergedCategories));
    // }
    // // remove duplicates and null values
    // const mergedCategories0 = mergedCategories.filter(
    //   (cat) => cat && cat.trim().length > 0
    // );
    // console.log("Merged categories", mergedCategories0);

    // setCategoryOptions(mergedCategories0);
  }, [data]);

  useEffect(() => {
    // First try to load categoriesArray from localStorage
    const storedCategoriesArray = localStorage.getItem("categoriesArray");
    let initialCategories = [];

    if (storedCategoriesArray) {
      try {
        initialCategories = JSON.parse(storedCategoriesArray);
        setCategoriesArray(initialCategories);
      } catch (e) {
        console.error("Error parsing categoriesArray", e);
      }
    }

    // Always update with new transaction categories (regardless of stored data)
    if (title === "Transactions") {
      // Analyze transactions to identify types
      const txCategories = new Map();

      data.forEach((tx) => {
        if (tx && tx.category) {
          const type = Number(tx.credit) > 0 ? "credit" : "debit";
          txCategories.set(tx.category, type);
        }
      });

      // Update categoriesArray with transaction data
      setCategoriesArray((prevArray) => {
        const categoryMap = new Map(prevArray.map((cat) => [cat.name, cat]));

        // Add any new categories from transactions
        let hasNewCategories = false || storedCategoriesArray === null;
        for (const [name, type] of txCategories.entries()) {
          if (!categoryMap.has(name) && name && name.trim()) {
            categoryMap.set(name, { name, type });
            hasNewCategories = true;
          }
        }

        // Only update localStorage if we added new categories
        if (hasNewCategories) {
          const newArray = Array.from(categoryMap.values());
          localStorage.setItem("categoriesArray", JSON.stringify(newArray));
          return newArray;
        }

        return prevArray;
      });
    }
  }, [data, title]);
  const categoryOptions = useMemo(
    () => categoriesArray.map((cat) => cat.name),
    [categoriesArray]
  );

  // 3. Add a helper function to get a category's type
  const getCategoryType = (categoryName) => {
    const category = categoriesArray.find((cat) => cat.name === categoryName);
    return category ? category.type : null;
  };

  const getFilteredCategoriesByType = (transactionType) => {
    // If no type specified, return all categories (for backward compatibility)
    if (!transactionType) return categoryOptions;

    return categoriesArray
      .filter(
        (cat) => cat.type === transactionType || cat.name === "Self transfer"
      )
      .map((cat) => cat.name)
      .filter((name) =>
        name.toLowerCase().includes(categorySearchTerm.toLowerCase())
      );
  };

  // Get dynamic columns from first data item
  let columns = data.length > 0 ? Object.keys(data[0]) : [];
  columns = columns.filter((column) => !columnsToIgnore.includes(column));

  const hasEntity = columns.some(
    (column) =>
      column.toLowerCase() === "entity" || column.toLowerCase() === "ledger"
  );

  // Determine which columns are numeric
  const numericColumns = columns.filter((column) =>
    data.some((row) => {
      const value = String(row[column]);
      return !isNaN(parseFloat(value)) && !value.includes("-");
    })
  );

  const dateColumns = columns.filter((column) =>
    data.some((row) => {
      const value = String(row[column]);
      return (
        /^\d{2}[/-]\d{2}[/-]\d{4}$/.test(value) ||
        /^\d{4}[/-]\d{2}[/-]\d{2}$/.test(value)
      );
    })
  );
  const handleExcelFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const parsedData = XLSX.utils.sheet_to_json(sheet);

      // Extract modified categories and compare with existing data
      const updates = parsedData
        .map((row) => {
          const existingTransaction = filteredData.find(
            (tx) => tx.id === row.Id
          );
          if (!existingTransaction) return null;
          if (existingTransaction.category === row.Category) return null;

          if (categoryOptions.includes(row.Category)) {
            return {
              date: row.Date,
              credit: row.Credit,
              debit: row.Debit,
              description: row.Description,
              id: row.Id,
              oldCategory: existingTransaction.category,
              newCategory: row.Category,
            };
          } else {
            return {
              date: row.Date,
              credit: row.Credit,
              debit: row.Debit,
              description: row.Description,
              id: row.Id,
              oldCategory: existingTransaction.category,
              newCategory: row.Category,
              classification: row.Classification,
            };
          }
        })
        .filter(Boolean); // Remove nulls

      // Store updates and show confirmation modal
      setUploadedChanges(updates);
      setCategoryUpdateModalOpen(true);
    };

    reader.readAsArrayBuffer(file);
  };

  const applyUploadedCategoryChanges = async () => {
    // Suspense excel upload handle
    try {
      // Call API or Electron IPC to update database
      // await window.electron.updateSuspenseCategories(uploadedChanges);

      // TODO - Apply changes locally in the table

      const dataOnUi = filteredData.map((row) => ({ ...row }));
      uploadedChanges.forEach((change) => {
        const index = dataOnUi.findIndex((row) => row.id === change.id);
        if (index !== -1) {
          dataOnUi[index].category = change.newCategory;
        }
      });
      setFilteredData(dataOnUi);

      const updatedTransactions = uploadedChanges.map((change) => {
        const updatedTransaction = filteredData.find(
          (tx) => tx.id === change.id
        );
        if (updatedTransaction) {
          updatedTransaction.oldCategory = change.oldCategory;
          updatedTransaction.category = change.newCategory;
          updatedTransaction.classification = change.classification;
          updatedTransaction.reasoning = "";
          updatedTransaction.is_new = updatedTransaction.classification
            ? true
            : false;
        }
        return updatedTransaction;
      });

      const payload = convertArrayToObject(updatedTransactions);
      // console.log("Payload", payload);
      const response = await window.electron.editCategory(
        payload,
        caseId || reportData.caseId
      );
      setCategoryUpdateModalOpen(false);
      toast({
        title: "Categories Updated!",
        description: "Suspense transactions have been updated successfully.",
      });
      if (refreshFunction) refreshFunction();
    } catch (error) {
      console.error("Error updating categories:", error);
      toast({
        title: "Error",
        description: "Failed to update categories. Please try again.",
        variant: "destructive",
      });
    }
  };

  // When classification is complete, update either the bulk field or a single row change.
  const handleClassificationSubmit = () => {
    // handleCategoryClassification(newCategoryToClassify, selectedType);
    setShowClassificationModal(false);
    if (bulkCategoryModalOpen) {
      setSelectedBulkCategory(newCategoryToClassify);
      setCategorySearchTerm("");
      setPendingCategoryChange(null);
    } else if (pendingCategoryChange) {
      const transaction = filteredData.find(
        (tx) => tx.id === pendingCategoryChange.transactionId
      );
      const oldCategory = transaction ? transaction.category : "";
      setPendingCategoryChange({
        ...pendingCategoryChange,
        newCategory: newCategoryToClassify,
        oldCategory: oldCategory,
      });
      setCurrentTransaction(transaction);
      setReasoningModalOpen(true);
    }
    setNewCategoryToClassify("");
  };

  //Search Functionality
  const handleSearch = (searchValue) => {
    setSearchTerm(searchValue);

    // const dataToFilter =
    //   existingFilterData.length > 0 ? existingFilterData : data;
    const dataToFilter = filteredData.length > 0 ? filteredData : transactions;

    // Reset to original data if search value is empty
    if (searchValue === "") {
      setFilteredData(data);
      setCurrentPage(1);
      return;
    }

    // Always filter from the full data set for consistent search results
    const columnsToReplace = ["amount", "balance", "debit", "credit"];
    const filtered = dataToFilter.filter((row) =>
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
    setExistingFilterData(filtered);
    setCurrentPage(1);

    // Calculate totals for numeric columns from the new filtered data
    const totals = numericColumns.reduce((acc, column) => {
      const total = filtered.reduce((sum, row) => {
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
  };

  // --- Single Row Update: Use the entire row (which includes its id) ---
  const handleCategoryChange = (transaction, newCategory) => {
    const oldCategory = transaction.category;
    // Find similar transactions
    const similarTransactions1 = processSimilarCategory(
      filteredData,
      transaction.description
    );
    // remove already selected one
    const similarTransactions = similarTransactions1.filter(
      (t) => t.id !== transaction.id
    );

    // Set the similar transactions in state
    setSimilarCategoryTransactions(similarTransactions);

    setPendingCategoryChange({
      transactionId: transaction.id,
      newCategory,
      oldCategory,
      transaction,
    });
    setCurrentTransaction(transaction);
    setReasoningModalOpen(true);
  };

  const confirmCategoryChange = () => {
    if (!pendingCategoryChange) return;
    const transactionId = pendingCategoryChange.transactionId;

    // const updatedFilteredData = filteredData.map((tx) => {
    //   if (parseInt(tx.id) === parseInt(transactionId)) {

    //     let updatedTx = { ...tx, category: pendingCategoryChange.newCategory };
    //     if (
    //       pendingCategoryChange.newCategory === "Self transfer" ||
    //       selectedType === "Contra"
    //     ) {
    //       updatedTx = { ...updatedTx, voucher_type: "Contra" };
    //     }

    //     return updatedTx;
    //   }
    //   return tx;
    // });
    let updatedTransaction = null;
    setFilteredData((prevData) =>
      prevData.map((tx) => {
        if (parseInt(tx.id) === parseInt(transactionId)) {
          let updatedTx = {
            ...tx,
            category: pendingCategoryChange.newCategory,
          };
          if (
            pendingCategoryChange.newCategory === "Self transfer" ||
            selectedType === "Contra"
          ) {
            updatedTx = { ...updatedTx, voucher_type: "Contra" };
          }
          updatedTransaction = updatedTx;
          return updatedTx;
        }
        return tx;
      })
    );
    // const transaction = updatedFilteredData.find(
    //   (tx) => tx.id === transactionId
    // );
    let modifiedObject = {
      ...updatedTransaction,
      oldCategory: pendingCategoryChange.oldCategory,
      keyword: showKeywordInput ? reasoning : "",
    };
    if (
      pendingCategoryChange.newCategory === "Self transfer" ||
      selectedType === "Contra"
    ) {
      modifiedObject = { ...modifiedObject, voucher_type: "Contra" };
    }
    if (selectedCategorySimilarTransactions.size > 0) {
      modifiedObject = { ...modifiedObject, is_new: false };
      setModifiedData((prevData) => [...prevData, modifiedObject]);
      setSelectedBulkCategory();
      handleBulkCategoryChange("similarCategory");
    } else {
      let newClassification = selectedType;
      if (selectedType === "Contra") {
        modifiedObject.debit > 0
          ? (newClassification = "Contra Debit")
          : (newClassification = "Contra Credit");
      }
      if (selectedType) {
        modifiedObject = {
          ...modifiedObject,
          classification: newClassification,
          is_new: true,
        };
      } else {
        modifiedObject = { ...modifiedObject, is_new: false };
      }

      setModifiedData((prevData) => [...prevData, modifiedObject]);
    }
    //     // Add selected similar transactions to modified data
    //     selectedCategorySimilarTransactions.forEach((id) => {
    //       const transaction = filteredData.find((tx) => tx.id === id);
    //       if (transaction) {
    //         modifiedObjects.push({
    //           ...transaction,
    //           oldCategory: pendingCategoryChange.oldCategory,
    //           category: pendingCategoryChange.newCategory,
    //           keyword: showKeywordInput ? reasoning : "",
    //         });
    //       }
    // });

    setHasChanges(true);
    setReasoningModalOpen(false);
    setPendingCategoryChange(null);
    setReasoning("");
    setShowKeywordInput(false);
  };

  // --- Bulk Update: Find each row by its id ---
  const handleBulkCategoryChange = (source) => {
    // Create a shallow copy so we don’t mutate state directly.
    // const dataOnUi = filteredData.map((row) => ({ ...row }));
    const newModifiedData = [...modifiedData];
    const ids =
      source === "similarCategory"
        ? selectedCategorySimilarTransactions
        : globalSelectedRows;
    const newCategory =
      source === "similarCategory"
        ? pendingCategoryChange.newCategory
        : selectedBulkCategory === ""
        ? categorySearchTerm
        : selectedBulkCategory;
    // ids.forEach((id) => {
    //   const index = dataOnUi.findIndex((row) => row.id === id);
    //   if (index !== -1) {
    //     const oldCategory = dataOnUi[index].category;
    //     dataOnUi[index].category = newCategory;
    //     // If the new category is "Self transfer", update voucher_type
    //     if (newCategory === "Self transfer" || selectedType === "Contra") {
    //       dataOnUi[index].voucher_type = "Contra";
    //     }

    //     if (selectedType) {
    //       dataOnUi[index].classification = selectedType;
    //       dataOnUi[index].is_new = true;
    //     }
    //     newModifiedData.push({
    //       ...dataOnUi[index],
    //       oldCategory,
    //       reasoning: bulkReasoning,
    //     });
    //   }
    // });

    setFilteredData((prevFilteredData) =>
      prevFilteredData.map((row) => {
        if (ids.has(row.id)) {
          const oldCategory = row.category;
          let updatedRow = { ...row, category: newCategory };
          if (newCategory === "Self transfer" || selectedType === "Contra") {
            updatedRow.voucher_type = "Contra";
          }
          if (selectedType) {
            let newClassification = selectedType;
            if (selectedType === "Contra") {
              updatedRow.debit > 0
                ? (newClassification = "Contra Debit")
                : (newClassification = "Contra Credit");
            }
            updatedRow.classification = newClassification;
            updatedRow.is_new = true;
          }
          newModifiedData.push({
            ...updatedRow,
            category: newCategory,
            oldCategory,
            reasoning: bulkReasoning,
            is_new: selectedType ? true : false,
          });
          return updatedRow;
        }
        return row;
      })
    );

    // setFilteredData(dataOnUi);
    setModifiedData((prevData) => [...prevData, ...newModifiedData]);
    setHasChanges(true);
    setGlobalSelectedRows(new Set());
    setBulkCategoryModalOpen(false);
    setConfirmationModalOpen(false);
    setSelectedBulkCategory("");
    setBulkReasoning("");
  };

  // --- Now store selected rows as transaction IDs ---
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

  const toggleSelectAll = () => {
    const newGlobalSelected = new Set(globalSelectedRows);
    const allCurrentPageSelected = filteredData.every((row) =>
      newGlobalSelected.has(row.id)
    );
    if (allCurrentPageSelected) {
      filteredData.forEach((row) => {
        newGlobalSelected.delete(row.id);
      });
    } else {
      filteredData.forEach((row) => {
        newGlobalSelected.add(row.id);
      });
    }
    setGlobalSelectedRows(newGlobalSelected);
  };

  //   Filter functions

  const handleCategorySelect = (category) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((cat) => cat !== category)
        : [...prev, category]
    );
  };
  const allCategoryOptions = [...categoryOptions, ...pendingCategories];
  const filteredCategories = allCategoryOptions.filter((category) => {
    return category.toLowerCase().includes(categorySearchTerm.toLowerCase());
  });

  const handleSelectAll = () => {
    const visibleCategories = getFilteredUniqueValues(currentFilterColumn);
    const allSelected = visibleCategories.every((cat) =>
      selectedCategories.includes(cat)
    );
    setSelectedCategories(allSelected ? [] : visibleCategories);
  };

  const handleColumnFilter = () => {
    const dataToFilter = transactions;
    //   existingFilterData.length > 0 ? existingFilterData : data;
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
    const dataToFilter = transactions;
    // existingFilterData.length > 0 ? existingFilterData : data;
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

  // Improved date handling functions
  const handleDateFilter = (columnName, fromDate, toDate) => {
    const dataToFilter =
      existingFilterData.length > 0 ? existingFilterData : data;

    const parseDate = (dateStr) => {
      if (!dateStr) return null;

      // Handle date input format (yyyy-mm-dd)
      if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const date = new Date(dateStr);
        date.setHours(0, 0, 0, 0);
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

    const filtered = dataToFilter.filter((row) => {
      const rowDateStr = row[columnName];
      const rowDate = parseDate(rowDateStr);

      if (!rowDate) {
        console.warn("Invalid row date:", rowDateStr);
        return false;
      }

      const isInRange = rowDate >= from && rowDate <= to;

      return isInRange;
    });

    // console.log("Filtered results count:", filtered.length);
    setFilteredData(filtered);
    setExistingFilterData(filtered);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setFilteredData(data);
    setCurrentPage(1);
    setFromDate("");
    setToDate("");
    setMinValue("");
    setMaxValue("");
    setSelectedCategories([]);
    setCategorySearchTerm("");
    setExistingFilterData([]);
    setGlobalSelectedRows(new Set());
  };

  const getUniqueValues = (columnName) => {
    return [...new Set(transactions.map((row) => String(row[columnName])))];
  };

  const getFilteredUniqueValues = (columnName) => {
    const uniqueValues = getUniqueValues(columnName);
    if (!categorySearchTerm) return uniqueValues;
    return uniqueValues.filter((value) =>
      value.toLowerCase().includes(categorySearchTerm.toLowerCase())
    );
  };

  // ===== Helper functions for inline & batch "Entity" editing =====
  const handleEntityChange = (tid, newValue) => {
    setEditedEntities((prev) => ({ ...prev, [tid]: newValue }));
  };

  // const handleCategorySearch = (e) => {
  //   e.preventDefault();
  //   e.stopPropagation();
  //   setCategorySearchTerm(e.target.value);
  // };

  const convertArrayToObject = (array) => {
    return array.reduce((acc, transaction) => {
      const id = transaction.id;
      if (id) {
        acc[Number(id)] = transaction;
      }
      return acc;
    }, {});
  };

  const handleSaveChanges = async () => {
    try {
      setIsLoading(true);

      const payload = convertArrayToObject(modifiedData);
      const response = await window.electron.editCategory(
        payload,
        caseId || reportData.caseId
      );

      modifiedData.map((row) => {
        if (row.category === "Self transfer") {
          handleVoucherTypeChange(row, "Contra", "Self transfer");
        }
        if (row.voucher_type === "Contra") {
          handleVoucherTypeChange(row, "Contra2", row.category);
        }
      });

      // After successful save, update categoryOptions with pending categories
      if (pendingCategories.length > 0) {
        // Save categoriesArray to localStorage
        localStorage.setItem(
          "categoriesArray",
          JSON.stringify(categoriesArray)
        );

        // For backward compatibility with existing code
        // const updatedOptions = categoriesArray.map((cat) => cat.name);
        // localStorage.setItem("categoryOptions", JSON.stringify(updatedOptions));

        // Update context if needed
        updateReportData({
          ...reportData,
          // categoryOptions: updatedOptions,
          categoriesArray: categoriesArray,
        });

        // Clear pending
        setPendingCategories([]);
      }
      setHasChanges(false);
      toast({
        title: "Changes saved successfully",
        description: "All category updates have been saved",
      });
      if (refreshFunction) refreshFunction();
    } catch (error) {
      toast({
        title: "Error saving changes",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setSelectedType("");
    }
  };

  const entityUpdateIpc = async (payload) => {
    // TODO- call ipc here and show error success toast
    // console.log(payload);

    try {
      const response = await window.electron.editEntity(payload);
      // console.log({ entityUpdateIpc: response });
      if (response.success) {
        // console.log("Entity updated successfully");
        // Show a success toast
        toast({
          id: "entity-update-success",
          title: "Ledger Update",
          description: "Ledger updated successfully",
          type: "success",
          duration: 3000,
        });
      } else {
        // Show an error toast
        toast({
          id: "entity-update-error",
          title: "Ledger Update",
          description: "Ledger update failed",
          type: "error",
          duration: 3000,
        });
        // console.log("Ledger update failed");
      }
    } catch (err) {
      // console.log(err);
    }
  };

  const handleEntityUpdateConfirm = (row) => {
    const id = row.id;
    const newValue = editedEntities[id];
    // if (
    //   window.confirm(
    //     "Are you sure you want to update the Entity for this transaction?"
    //   )
    // ) {
    const payload = [{ entity: newValue, transactionId: row.id }];
    entityUpdateIpc(payload);

    // Update the local state so the UI immediately reflects the new value.
    setFilteredData((prevData) => {
      const updatedData = [...prevData];
      // Determine the correct key (e.g., "Entity" or "entity")
      const index = updatedData.findIndex((row) => row.id === id);
      updatedData[index] = {
        ...updatedData[index],
        entity: newValue,
        ledger: newValue,
      };

      return updatedData;
    });

    // Clear the edit state for this row.
    setEditedEntities((prev) => {
      const newState = { ...prev };
      delete newState[id];
      return newState;
    });
    // }
  };

  // Called when the user confirms a batch update from the modal.
  const handleBatchUpdate = () => {
    if (!batchEntityValue) return;

    const dataOnUi = filteredData.map((row) => ({ ...row }));
    // For each selected row, find the row in filteredData (using its global index)
    const payload = Array.from(globalSelectedRows).map((id) => {
      const index = dataOnUi.findIndex((row) => row.id === id);
      if (index !== -1) {
        dataOnUi[index] = {
          ...dataOnUi[index],
          ledger: batchEntityValue,
          entity: batchEntityValue,
        };
        // Update the local state so the UI immediately reflects the new value.
        setFilteredData(dataOnUi);
        return {
          // entity: batchEntityValue,
          entity: batchEntityValue,
          transactionId: dataOnUi[index].id,
        };
      } else {
        return null;
      }
    });
    // console.log("Payload aq", payload);
    entityUpdateIpc(payload);

    // Clear selections and close the modal.
    setGlobalSelectedRows(new Set());
    setBatchEntityValue("");
    setSearchTerm("");
    setBatchModalOpen(false);
    setSearchTerm("");
    if (refreshFunction) refreshFunction();
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

  const handleAddCategory = (newCategory, row) => {
    if (
      newCategory &&
      !categoryOptions.includes(newCategory) &&
      !pendingCategories.includes(newCategory)
    ) {
      // Determine the type based on the transaction
      let type = "debit"; // Default

      if (row) {
        type = Number(row.credit) > 0 ? "credit" : "debit";
      } else if (globalSelectedRows.size > 0) {
        // For bulk operation, use the first selected row's type
        const firstId = Array.from(globalSelectedRows)[0];
        const transaction = filteredData.find((tx) => tx.id === firstId);
        if (transaction) {
          type = Number(transaction.credit) > 0 ? "credit" : "debit";
        }
      }

      // Add to categoriesArray
      setCategoriesArray((prev) => [...prev, { name: newCategory, type }]);

      // Add to pending categories for backward compatibility
      setPendingCategories((prev) => [...prev, newCategory]);

      // Continue with existing logic
      setNewCategoryToClassify(newCategory);

      if (row) {
        setPendingCategoryChange({
          transactionId: row.id,
          newCategory,
          oldCategory: row.category,
          transaction: row,
        });
        setCurrentTransactionType(row.debit > 0 ? "debit" : "credit");
      }

      setShowClassificationModal(true);
      return true;
    }
    return false;
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

  const handleDownload = () => {
    let newTitle = title;

    const tmpName = reportData.customerName
      ? reportData.customerName
      : reportData.reportName;
    newTitle = `${tmpName} ${newTitle}`;

    exportToExcel(
      filteredData,
      (title = newTitle),
      false,
      ["suspense", "upi-dr", "upi-cr"].includes(source) ? categoryOptions : null
    );
  };

  const handleMailShare = async () => {
    let newTitle = title;
    const tmpName = reportData.customerName
      ? reportData.customerName
      : reportData.reportName;
    newTitle = `${tmpName} ${title}`;

    const fileName = await exportToExcel(
      data,
      `${newTitle}.xlsx`,
      true,
      ["suspense", "upi-dr", "upi-cr"].includes(source) ? categoryOptions : null
    );
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

    const fileName = await exportToExcel(
      data,
      `${newTitle}.xlsx`,
      true,
      ["suspense", "upi-dr", "upi-cr"].includes(source) ? categoryOptions : null
    );
    if (!fileName) return alert("File saving was canceled.");

    // Generate WhatsApp sharing link (without attachment, since it's not possible)
    const message = encodeURIComponent(
      `📁 Please find the attached Report: ${title}\n\n📌 Don't forget to manually attach the saved file before sending.`
    );
    const whatsappLink = `https://api.whatsapp.com/send?text=${message}`;

    // Open WhatsApp Web
    window.open(whatsappLink, "_blank");
  };

  // get transactions with same category and similar description
  // const processSimilarCategory = (transactions, descriptionToMatch) => {
  //   // Helper function to calculate string similarity
  //   const similarity = (str1, str2) => {
  //     if (!str1 || !str2) return 0;
  //     const s1 = str1.toLowerCase();
  //     const s2 = str2.toLowerCase();
  //     const match = [...s1].filter((char) => s2.includes(char)).length;
  //     return match / Math.max(s1.length, s2.length);
  //   };

  //   // Similarity threshold
  //   const threshold = 0.85;

  //   // Filter transactions with similar descriptions and same category
  //   const similarTransactions = transactions.filter((transaction) => {
  //     const descriptionSimilarity = similarity(
  //       transaction.description,
  //       descriptionToMatch
  //     );

  //     return descriptionSimilarity >= threshold;
  //   });

  //   // Sort by similarity score (most similar first)
  //   return similarTransactions.sort((a, b) => {
  //     const similarityA = similarity(a.description, descriptionToMatch);
  //     const similarityB = similarity(b.description, descriptionToMatch);
  //     return similarityB - similarityA;
  //   });
  // };

  const processSimilarCategory = (
    transactions,
    descriptionToMatch,
    threshold
  ) => {
    const similarity = (str1, str2) => {
      if (!str1 || !str2) return 0;
      const s1 = str1.toLowerCase();
      const s2 = str2.toLowerCase();
      const match = [...s1].filter((char) => s2.includes(char)).length;
      return match / Math.max(s1.length, s2.length);
    };

    const thresholdDecimal = threshold / 100;

    return transactions
      .filter(
        (transaction) =>
          similarity(transaction.description, descriptionToMatch) >=
          thresholdDecimal
      )
      .sort(
        (a, b) =>
          similarity(b.description, descriptionToMatch) -
          similarity(a.description, descriptionToMatch)
      );
  };

  useEffect(() => {
    if (currentTransaction) {
      setIsLoading(true);

      setTimeout(() => {
        // Simulate delay
        const similarTransactions = processSimilarCategory(
          filteredData,
          currentTransaction.description,
          sliderValue
        );
        setSimilarCategoryTransactions(similarTransactions);
        setIsLoading(false);
      }, 500);
    }
  }, [sliderValue, currentTransaction]);

  // get transactions with same entity and similar description
  const processSimilarEntity = (
    transactions,
    entityToMatch,
    descriptionToMatch
  ) => {
    // Helper function to calculate string similarity
    const similarity = (str1, str2) => {
      if (!str1 || !str2) return 0;
      const s1 = str1.toLowerCase();
      const s2 = str2.toLowerCase();
      const match = [...s1].filter((char) => s2.includes(char)).length;
      return match / Math.max(s1.length, s2.length);
    };

    // Similarity threshold
    const threshold = 0.85;

    // Filter transactions with similar descriptions and same category
    const similarTransactions = transactions.filter((transaction) => {
      const descriptionSimilarity = similarity(
        transaction.description,
        descriptionToMatch
      );

      // const isSameCategory = transaction.entity === entityToMatch;
      const isSameCategory =
        transaction.ledger === entityToMatch ||
        transaction.entity === entityToMatch;
      return descriptionSimilarity >= threshold && isSameCategory;
    });

    // Sort by similarity score (most similar first)
    return similarTransactions.sort((a, b) => {
      const similarityA = similarity(a.description, descriptionToMatch);
      const similarityB = similarity(b.description, descriptionToMatch);
      return similarityB - similarityA;
    });
  };

  const handleVoucherTypeChange = async (row, newVoucher, newCategory) => {
    // if (newVoucher === "Contra") {
    //   newCategory = "Self transfer";
    // }
    let updatedCategory;
    let updateVoucher = newVoucher;
    if (newVoucher === "Contra") {
      updatedCategory = "Self transfer";
    } else {
      updatedCategory = newCategory;
    }

    if (newVoucher === "Contra2") {
      updateVoucher = "Contra";
    }
    const updatedData = filteredData.map((tx) => {
      if (tx.id === row.id) {
        return {
          ...tx,
          voucher_type: updateVoucher,
          category: updatedCategory,
        };
      }
      return tx;
    });

    const response = await window.electron.editVoucherType([
      { id: row.id, voucher_type: updateVoucher, category: updatedCategory },
    ]);
    setFilteredData(updatedData);
  };

  const handleCategorySelectOpenChange = (id) => {
    // setCategorySelectDropdownOpen((prev) => ({ ...prev, [id]: open }));
    if (categorySelectDropdownOpen === id) {
      setCategorySelectDropdownOpen(null);
    } else {
      // Otherwise, open the clicked dropdown
      setCategorySelectDropdownOpen(id);
    }
  };

  const handlePreviewFile = (previewUrl) => {
    try {
      if (!previewUrl) {
        console.error("Error: No file path provided");
        return;
      }

      if (!previewUrl.includes(".pdf")) {
        toast({
          title: "Alert",
          description: "File not supported for preview",
          variant: "destructive",
          duration: 3000,
        });
        return;
      }

      window.electron.fetchPdfContent(previewUrl).then((base64) => {
        const blob = base64StringToBlob(base64, "application/pdf");
        const objectUrl = URL.createObjectURL(blob);
        setPdfBlob(objectUrl);
        setIsPdfModalOpen(true); // Set state to open a modal
        setIsLoading(false);
      });
    } catch (error) {
      console.error("Error opening PDF file:", error);
      setIsLoading(false);
      // Fallback to default browser behavior if electron API fails
      window.open(previewUrl);
    }
  };

  const base64StringToBlob = (base64, type) => {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return new Blob([bytes], { type: type });
  };

  const checkTransactionTypesConsistency = () => {
    if (globalSelectedRows.size === 0) return true;

    let hasDebit = false;
    let hasCredit = false;
    let firstType = null;
    let allSameType = true;

    // Check all selected transactions
    for (const id of globalSelectedRows) {
      const transaction = filteredData.find((tx) => tx.id === id);
      if (!transaction) continue;

      // Determine transaction type
      const isDebit = Number(transaction.debit) > 0;
      const isCredit = Number(transaction.credit) > 0;

      // Track types
      if (isDebit) hasDebit = true;
      if (isCredit) hasCredit = true;

      // Set the first type we encounter
      if (firstType === null) {
        firstType = isDebit ? "debit" : "credit";
      } else {
        // Compare current transaction type with first type
        const currentType = isDebit ? "debit" : "credit";
        if (currentType !== firstType) {
          allSameType = false;
        }
      }
    }

    return allSameType;
  };

  const openBulkCategoryModal = () => {
    const consistentTypes = checkTransactionTypesConsistency();

    if (!consistentTypes) {
      setTypeErrorMessage(
        "Please select transactions of the same type (all debit or all credit)"
      );
      setBulkCategoryModalOpen(true);
    } else {
      setTypeErrorMessage("");

      // Just check the first transaction's type since we know they're all consistent
      if (globalSelectedRows.size > 0) {
        const firstId = Array.from(globalSelectedRows)[0];
        const transaction = filteredData.find((tx) => tx.id === firstId);
        // Set transaction type based on first transaction
        setCurrentTransactionType(transaction?.debit > 0 ? "debit" : "credit");
      }
      setBulkCategoryModalOpen(true);
    }
  };

  return (
    // if source is equal to lifo or fifo then show the table
    <Card className="min-w-full max-w-[0]">
      <CardHeader className="w-full">
        <div className="flex flex-col md:flex-row justify-between gap-4">
          {/* Title and description */}
          <div className="space-y-2 whitespace-nowrap">
            <CardTitle className="dark:text-slate-300">
              {title || "Data Table"}
            </CardTitle>
            <CardDescription>
              {subtitle || "View and manage your data"}
            </CardDescription>
          </div>

          {/* Controls section */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search input */}
            <div className="relative min-w-[200px] md:w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                className="pl-10 w-full"
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>

            {/* Rows per page */}
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

            {/* Clear filters button */}
            <Button
              variant="outline"
              className="px-3 py-1.5 text-sm font-medium border border-gray-300 dark:border-gray-600 
                  bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 
                  transition-all rounded-md shadow-sm hover:shadow-md"
              onClick={clearFilters}
            >
              Clear Filters
            </Button>

            {/* Conditional preview button */}
            {source === "transactions" &&
              reportData?.individualId &&
              reportData?.individualId !== "combined" && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="p-2 rounded-md bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 
                      transition-all shadow-sm hover:shadow-md"
                      onClick={() => handlePreviewFile(reportData.filePath)}
                    >
                      <Eye className="w-4 h-4 text-blue-500" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Preview Statement</TooltipContent>
                </Tooltip>
              )}

            {/* Conditional upload button */}
            {["suspense", "upi-dr", "upi-cr"].includes(source) && (
              <>
                <Button
                  onClick={() => fileInputRef.current.click()}
                  variant="outline"
                  className="px-3 py-1.5 text-sm font-medium border border-gray-300 dark:border-gray-600 
                  bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 
                  transition-all rounded-md shadow-sm hover:shadow-md"
                >
                  Upload Modified Excel
                </Button>
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  ref={fileInputRef}
                  onChange={handleExcelFileUpload}
                  className="hidden"
                />
              </>
            )}

            {/* Download and share buttons */}
            <div className="flex gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
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
                    size="icon"
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

            {/* Bulk edit button */}
            {hasEntity && (
              <Button
                variant="default"
                className="min-w-[150px]"
                disabled={globalSelectedRows.size === 0}
                onClick={() => setBatchModalOpen(true)}
              >
                Bulk Edit Ledger Name
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="w-full overflow-x-auto">
          <Table className="w-full min-w-[800px]">
            <TableHeader>
              <TableRow>
                {(columns.includes("category") ||
                  columns.includes("entity")) && (
                  <TableHead className="w-10 sticky left-0 bg-white z-10">
                    <Checkbox
                      checked={
                        currentData.length > 0 &&
                        currentData.every((row) =>
                          globalSelectedRows.has(row.id)
                        )
                      }
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                )}

                {columns.map((column) => (
                  <TableHead
                    key={column}
                    className="whitespace-nowrap"
                    // className={source === "summary" ? "bg-gray-900 dark:bg-slate-800 text-white" : ""}
                  >
                    <div className="flex items-center gap-2 ">
                      {["ledger", "entity"].includes(column)
                        ? "Ledger / Party Name "
                        : column
                            .split("_") // Split by underscore
                            .map(
                              (word) =>
                                word.charAt(0).toUpperCase() +
                                word.slice(1).toLowerCase()
                            ) // Capitalize
                            .join(" ")}
                      {column.toLowerCase() !== "description" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => {
                            if (column.toLowerCase() === "date") {
                              setCurrentFilterColumn(column);
                              setCurrentDateColumn(column);
                              setDateFilterModalOpen(true);
                            } else if (
                              column.toLowerCase() === "credit" ||
                              column.toLowerCase() === "debit" ||
                              column.toLowerCase() === "balance"
                            ) {
                              setCurrentNumericColumn(column);
                              setCurrentDateColumn(column);
                              setNumericFilterModalOpen(true);
                              setDateFilterModalOpen(false);
                            } else if (dateColumns.includes(column)) {
                              setCurrentFilterColumn(column);
                              setCurrentDateColumn(column);
                              // setSelectedCategories([]);
                              setCategorySearchTerm("");
                              setFilterModalOpen(true);
                              setDateFilterModalOpen(true);
                            } else {
                              setCurrentFilterColumn(column);
                              setCurrentDateColumn(column);
                              // setSelectedCategories([]);
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
                  const isBalance =
                    row.description === "openingbalance" ||
                    row.description === "closingbalance";
                  return (
                    <TableRow
                      key={row.id}
                      // className={source === "summary" ? "even:bg-slate-200 even:dark:bg-slate-800 hover:bg-transparent even:hover:bg-slate-200" : ""}
                    >
                      {(columns.includes("category") ||
                        columns.includes("entity", "ledger")) && (
                        <TableCell className="w-10 sticky left-0 bg-white z-10">
                          <Checkbox
                            checked={globalSelectedRows.has(row.id)}
                            onCheckedChange={() => toggleRowSelection(row.id)}
                          />
                        </TableCell>
                      )}
                      {columns.map((column) => {
                        if (["ledger", "entity"].includes(column)) {
                          return (
                            <TableCell
                              key={column}
                              className="max-w-[200px] relative"
                            >
                              <div className="flex items-center">
                                <Input
                                  type="text"
                                  value={
                                    editedEntities[row.id] !== undefined
                                      ? editedEntities[row.id]
                                      : row[column]
                                  }
                                  onChange={(e) =>
                                    handleEntityChange(row.id, e.target.value)
                                  }
                                  className="w-full"
                                />
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
                        } else if (column.toLowerCase() === "category") {
                          return (
                            <TableCell
                              key={column}
                              className="min-w-[280px] group relative"
                            >
                              {isBalance ? (
                                <div className="truncate"></div>
                              ) : (
                                <div
                                  className="w-full relative"
                                  ref={commandRef}
                                >
                                  {/* Trigger button styled like a Select */}
                                  <div
                                    className="flex items-center justify-between w-full h-10 px-3 py-2 text-sm border rounded-md border-input bg-background cursor-pointer"
                                    onClick={() => {
                                      handleCategorySelectOpenChange(row.id);
                                    }}
                                  >
                                    <span
                                      className={
                                        row[column]
                                          ? ""
                                          : "text-muted-foreground"
                                      }
                                    >
                                      {row[column] || "Select category"}
                                    </span>
                                    <ChevronDown
                                      className={cn(
                                        "h-4 w-4 transition-transform",
                                        categorySelectDropdownOpen === row.id
                                          ? "transform rotate-180"
                                          : ""
                                      )}
                                    />
                                  </div>

                                  {/* Dropdown Command component */}
                                  {categorySelectDropdownOpen === row.id && (
                                    <div className="absolute z-50 w-full mt-1 min-w-[350px] ">
                                      <Command className="rounded-md border border-input bg-background shadow-md">
                                        <div className="flex items-center border-b ">
                                          <div className="relative flex items-center w-full category-dropdown-container">
                                            <CommandInput
                                              placeholder="Search or add categories..."
                                              value={categorySearchTerm}
                                              onValueChange={
                                                setCategorySearchTerm
                                              }
                                              className="flex border-none focus:ring-0 focus:outline-none w-full pr-16"
                                              autoFocus
                                            />
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              className="h-8 px-2 absolute right-2 top-1/2 transform -translate-y-1/2"
                                              onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                if (categorySearchTerm.trim()) {
                                                  // Pass the whole row for a single update
                                                  const added =
                                                    handleAddCategory(
                                                      categorySearchTerm.trim(),
                                                      row
                                                    );
                                                  if (added) {
                                                    setCategorySearchTerm("");
                                                    handleCategorySelectOpenChange(
                                                      null
                                                    );
                                                  }
                                                }
                                              }}
                                            >
                                              <Plus className="h-4 w-4 mr-1" />
                                              Add
                                            </Button>
                                          </div>
                                        </div>
                                        <CommandEmpty>
                                          <div className="text-center space-y-2 p-4">
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
                                        </CommandEmpty>
                                        <div className="max-h-[200px] overflow-y-auto">
                                          <CommandGroup>
                                            {getFilteredCategoriesByType(
                                              row.debit > 0 ? "debit" : "credit"
                                            ).map((category) => (
                                              <CommandItem
                                                key={category}
                                                onSelect={() => {
                                                  handleCategoryChange(
                                                    row,
                                                    category
                                                  );
                                                  setCategorySearchTerm("");
                                                  handleCategorySelectOpenChange(
                                                    null
                                                  );
                                                }}
                                                className="flex items-center category-dropdown-container"
                                              >
                                                <div className="flex-1">
                                                  <Check
                                                    className={cn(
                                                      "mr-2 h-4 w-4 inline",
                                                      row[column] === category
                                                        ? "opacity-100"
                                                        : "opacity-0"
                                                    )}
                                                  />
                                                  {category}
                                                </div>
                                              </CommandItem>
                                            ))}
                                          </CommandGroup>
                                        </div>
                                      </Command>
                                    </div>
                                  )}
                                </div>
                              )}
                            </TableCell>
                          );
                        } else if (column.toLowerCase() === "voucher_type") {
                          return (
                            <TableCell
                              key={column}
                              className="max-w-[200px] group relative"
                            >
                              {isBalance ? (
                                <div className="truncate"></div>
                              ) : (
                                <Select
                                  value={row[column]}
                                  onValueChange={(value) =>
                                    handleVoucherTypeChange(
                                      row,
                                      value,
                                      row.category
                                    )
                                  }
                                  className="w-full"
                                  disabled={globalSelectedRows.has(row.id)}
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue>{row[column]}</SelectValue>
                                  </SelectTrigger>
                                  <SelectContent>
                                    <div className="max-h-[200px] overflow-y-auto">
                                      {voucherOptions.length > 0 ? (
                                        voucherOptions.map((voucher) => (
                                          <SelectItem
                                            key={voucher}
                                            value={voucher}
                                          >
                                            {voucher}
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
                              )}
                            </TableCell>
                          );
                        } else if (column.toLowerCase() === "description") {
                          return (
                            <TableCell
                              key={column}
                              className="max-w-[200px] group relative"
                            >
                              <div className="truncate">
                                {formatValue(row[column])}
                              </div>
                              <div className="absolute left-0 top-10 hidden group-hover:block bg-black text-white text-sm rounded p-2 z-50 whitespace-normal min-w-[200px] max-w-[400px]">
                                {row[column]}
                              </div>
                            </TableCell>
                          );
                        } else {
                          return (
                            <TableCell key={column} className="max-w-[200px]">
                              <div>
                                {numericColumns.includes(column)
                                  ? row[column].toString().includes(".")
                                    ? parseFloat(row[column]).toFixed(2)
                                    : row[column]
                                  : row[column]}
                              </div>
                            </TableCell>
                          );
                        }
                      })}
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
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </CardContent>

      {/* Batch Edit Modal */}
      {batchModalOpen && (
        <Dialog open={batchModalOpen} onOpenChange={setBatchModalOpen}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Batch Update ledgers</DialogTitle>
              <p className="text-sm text-gray-600">
                Enter new Entity value for selected transactions:
              </p>
            </DialogHeader>
            <Input
              type="text"
              placeholder="New Entity value"
              value={batchEntityValue}
              onChange={(e) => setBatchEntityValue(e.target.value)}
              className="mb-4"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setBatchModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="default" onClick={handleBatchUpdate}>
                Confirm
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

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
                Apply Filter
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
                Apply Filter
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
      {/* Filter Modal for From Date to To Date  */}
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

      {/* Modal for Preview Pdf*/}
      {isPdfModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 w-4/5 h-4/5 flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">PDF Preview</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setIsPdfModalOpen(false);
                  URL.revokeObjectURL(pdfBlob); // Clean up the object URL
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-hidden">
              <iframe src={pdfBlob} className="w-full h-full border-0" />
            </div>
          </div>
        </div>
      )}

      {/* Bulk Category Update Modal */}
      <Dialog
        open={bulkCategoryModalOpen}
        onOpenChange={setBulkCategoryModalOpen}
      >
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Update Multiple Categories</DialogTitle>
            <DialogDescription>
              Select a new category for the {globalSelectedRows.size} selected
              transactions
            </DialogDescription>
          </DialogHeader>

          {typeErrorMessage && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
              <span className="block sm:inline">{typeErrorMessage}</span>
            </div>
          )}
          {!typeErrorMessage && (
            <div className="space-y-4">
              {/* Collapsible Command component */}
              <div className="relative w-full" ref={commandRef}>
                {/* Trigger button styled like a Select */}
                <div
                  className="flex items-center justify-between w-full h-10 px-3 py-2 text-sm border rounded-md border-input bg-background cursor-pointer"
                  onClick={() => setIsOpen(!isOpen)}
                >
                  <span
                    className={
                      selectedBulkCategory ? "" : "text-muted-foreground"
                    }
                  >
                    {selectedBulkCategory || "Select new category"}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform",
                      isOpen ? "transform rotate-180" : ""
                    )}
                  />
                </div>

                {/* Dropdown Command component */}
                {isOpen && (
                  <div className="absolute z-50 w-full mt-1">
                    <Command className="rounded-md border border-input bg-background shadow-md">
                      <div className="flex items-center border-b px-3">
                        <div className="relative flex items-center w-full category-dropdown-container">
                          <CommandInput
                            placeholder="Search or Add categories..."
                            value={categorySearchTerm}
                            onValueChange={setCategorySearchTerm}
                            className="flex border-none focus:ring-0 focus:outline-none w-full pr-16"
                            autoFocus
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2 absolute right-0 top-1/2 transform -translate-y-1/2"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (categorySearchTerm.trim()) {
                                const added = handleAddCategory(
                                  categorySearchTerm.trim()
                                );
                                if (added) {
                                  setSelectedBulkCategory(
                                    categorySearchTerm.trim()
                                  );
                                  setCategorySearchTerm("");
                                  setIsOpen(false);
                                }
                              }
                            }}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add
                          </Button>
                        </div>
                      </div>
                      <CommandEmpty>
                        <div className="text-center space-y-2 p-4">
                          <p className="text-md">
                            No matching categories found
                          </p>
                          <p className="text-sm mt-1">
                            Click the{" "}
                            <Plus className="h-3 w-3 inline-block mx-1" /> icon
                            above to add "{categorySearchTerm}" as a new
                            category
                          </p>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              const added = handleAddCategory(
                                categorySearchTerm.trim()
                              );
                              if (added) {
                                setSelectedBulkCategory(
                                  categorySearchTerm.trim()
                                );
                                setCategorySearchTerm("");
                                setIsOpen(false);
                              }
                            }}
                          ></Button>
                        </div>
                      </CommandEmpty>
                      <div className="max-h-64 overflow-y-auto">
                        <CommandGroup>
                          {getFilteredCategoriesByType(
                            currentTransactionType
                          ).map((category) => (
                            <CommandItem
                              key={category}
                              onSelect={() => {
                                setSelectedBulkCategory(category);
                                setCategorySearchTerm("");
                                setIsOpen(false);
                              }}
                              className="flex items-center category-dropdown-container"
                            >
                              <div className="flex-1">
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4 inline",
                                    selectedBulkCategory === category
                                      ? "opacity-100"
                                      : "opacity-0"
                                  )}
                                />
                                {category}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </div>
                    </Command>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex items-center space-x-2 mt-4">
                  <Checkbox
                    id="show-keywords"
                    checked={showKeywordInput}
                    onCheckedChange={setShowKeywordInput}
                  />
                  <Label htmlFor="show-keywords">
                    Add keywords for category change
                  </Label>
                </div>

                {showKeywordInput && (
                  <div className="space-y-2">
                    <Label>
                      What common keywords in these transactions made you choose
                      "{selectedBulkCategory}" as their category?
                    </Label>
                    <Input
                      value={reasoning}
                      onChange={(e) => setReasoning(e.target.value)}
                      placeholder="Enter Keyword..."
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setBulkCategoryModalOpen(false);
                setTypeErrorMessage("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={() => {
                setBulkCategoryModalOpen(false);
                // setConfirmationModalOpen(true);
                handleBulkCategoryChange();
              }}
              disabled={!selectedBulkCategory || typeErrorMessage}
            >
              Update Categories
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Modal */}
      {/* <Dialog
        open={confirmationModalOpen}
        onOpenChange={setConfirmationModalOpen}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Confirm Category Update</DialogTitle>
            <DialogDescription>
              Are you sure you want to update the category to "
              {selectedBulkCategory}" for {globalSelectedRows.size}{" "}
              transactions?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setConfirmationModalOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="default" onClick={handleBulkCategoryChange}>
              Confirm Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog> */}

      {/* Classification Modal */}
      <Dialog
        open={showClassificationModal}
        onOpenChange={() => setShowClassificationModal(false)}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Classify New Category</DialogTitle>
            <DialogDescription>
              Please classify "{newCategoryToClassify}" into one of the
              following types
            </DialogDescription>
          </DialogHeader>

          <RadioGroup
            value={selectedType}
            onValueChange={setSelectedType}
            className="space-y-3"
          >
            {currentTransactionType === "credit" && (
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Income" id="Income" />
                <Label htmlFor="Income">Income</Label>
              </div>
            )}
            {currentTransactionType === "debit" && (
              <div className="flex items-center space-x-2">
                <RadioGroupItem
                  value="Important Expenses / Payments"
                  id="important_expenses"
                />
                <Label htmlFor="important_expenses">Important Expenses</Label>
              </div>
            )}
            {currentTransactionType === "debit" && (
              <div className="flex items-center space-x-2">
                <RadioGroupItem
                  value="Other Expenses / Payments"
                  id="other_expenses"
                />
                <Label htmlFor="other_expenses">Other Expenses</Label>
              </div>
            )}
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="Contra" id="Contra" />
              <Label htmlFor="Contra">Contra</Label>
            </div>
          </RadioGroup>

          <DialogFooter>
            <Button
              variant="default"
              onClick={handleClassificationSubmit}
              disabled={!selectedType}
            >
              Save Classification
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reasoning Modal for Single Category Change */}
      <Dialog open={reasoningModalOpen} onOpenChange={setReasoningModalOpen}>
        <DialogContent className="max-w-[80%] max-h-[90vh] overflow-auto pb-0">
          <DialogHeader>
            <DialogTitle className="mb-2">
              Category Change Reasoning
            </DialogTitle>
            <DialogDescription>
              Transaction Details:
              {currentTransaction && (
                <div className="mt-2 p-3 bg-muted rounded-md">
                  <p>
                    <strong>Description:</strong>{" "}
                    {currentTransaction.description}
                  </p>
                  <p>
                    <strong>Category Change:</strong>{" "}
                    {pendingCategoryChange?.oldCategory} →{" "}
                    {pendingCategoryChange?.newCategory}
                  </p>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="show-keywords"
                checked={showKeywordInput}
                onCheckedChange={setShowKeywordInput}
              />
              <Label htmlFor="show-keywords">
                Add keywords for category change
              </Label>
            </div>

            {showKeywordInput && (
              <div className="space-y-2">
                <Label>
                  What keywords from the description made you change the
                  category from "{pendingCategoryChange?.oldCategory}" to "
                  {pendingCategoryChange?.newCategory}"?
                </Label>
                <Input
                  value={reasoning}
                  onChange={(e) => setReasoning(e.target.value)}
                  placeholder="Enter Keyword..."
                />
              </div>
            )}
          </div>
          {similarCategoryTransactions.length > 0 && (
            <div className="mt-6 p-4 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                    📌 Similar Transactions Detected
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    The following transactions have similar descriptions and
                    categories.
                    <br /> Select the ones you'd like to update alongside the
                    manually changed transaction.
                  </p>
                </div>
                <div className="flex flex-col ml-4">
                  <label className="text-sm font-medium text-gray-700">
                    Similarity Threshold: {sliderValue}%
                  </label>
                  <SliderDemo
                    defaultValue={[85]}
                    max={100}
                    step={1}
                    onChange={(value) => setSliderValue(value[0])}
                  />
                </div>
              </div>

              {/* Transactions Table */}
              <div className="overflow-x-auto">
                {isLoading ? (
                  <div className="flex items-center justify-center h-40">
                    <Loader2 className="animate-spin" />
                  </div>
                ) : similarCategoryTransactions.length > 0 ? (
                  <Table className="w-full border border-gray-300 dark:border-gray-700 rounded-md">
                    <TableHeader className="bg-gray-100 dark:bg-gray-800">
                      <TableRow>
                        <TableHead className="w-10 p-3 ">
                          <Checkbox
                            checked={
                              similarCategoryTransactions.length > 0 &&
                              similarCategoryTransactions.every((t) =>
                                selectedCategorySimilarTransactions.has(t.id)
                              )
                            }
                            onCheckedChange={() => {
                              const newSet = new Set(
                                selectedCategorySimilarTransactions
                              );
                              if (
                                similarCategoryTransactions.every((t) =>
                                  newSet.has(t.id)
                                )
                              ) {
                                similarCategoryTransactions.forEach((t) =>
                                  newSet.delete(t.id)
                                );
                              } else {
                                similarCategoryTransactions.forEach((t) =>
                                  newSet.add(t.id)
                                );
                              }
                              setSelectedCategorySimilarTransactions(newSet);
                            }}
                          />
                        </TableHead>
                        <TableHead className="p-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                          Date
                        </TableHead>
                        <TableHead className="p-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                          Description
                        </TableHead>
                        <TableHead className="p-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                          Credit
                        </TableHead>
                        <TableHead className="p-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                          Debit
                        </TableHead>
                        <TableHead className="p-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                          Category
                        </TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {similarCategoryTransactions.map((transaction, index) => (
                        <TableRow
                          key={transaction.id}
                          className={`transition-all ${
                            index % 2 === 0
                              ? "bg-white dark:bg-gray-900"
                              : "bg-gray-50 dark:bg-gray-800"
                          } hover:bg-gray-200 dark:hover:bg-gray-700`}
                        >
                          <TableCell className="p-3 ">
                            <Checkbox
                              checked={selectedCategorySimilarTransactions.has(
                                transaction.id
                              )}
                              onCheckedChange={() => {
                                const newSet = new Set(
                                  selectedCategorySimilarTransactions
                                );
                                if (newSet.has(transaction.id)) {
                                  newSet.delete(transaction.id);
                                } else {
                                  newSet.add(transaction.id);
                                }
                                setSelectedCategorySimilarTransactions(newSet);
                              }}
                            />
                          </TableCell>
                          <TableCell className="p-3">
                            {transaction.date}
                          </TableCell>
                          <TableCell className="p-3 max-w-[400px] overflow-hidden">
                            {transaction.description}
                          </TableCell>
                          <TableCell className="p-3">
                            {transaction.credit}
                          </TableCell>
                          <TableCell className="p-3">
                            {transaction.debit}
                          </TableCell>
                          <TableCell className="p-3">
                            {transaction.category}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-gray-500 text-center mt-4">
                    No similar transactions found.
                  </p>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="sticky bg-white  bottom-0 p-4">
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
            <Button
              variant="default"
              onClick={confirmCategoryChange}
              disabled={showKeywordInput && !reasoning}
            >
              Confirm Change
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
          <div className="flex justify-center gap-6 py-6">
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

      {/* Category Update Confirmation Modal */}
      <Dialog
        open={categoryUpdateModalOpen}
        onOpenChange={setCategoryUpdateModalOpen}
      >
        <DialogContent className="max-w-[80%]">
          <DialogHeader>
            <DialogTitle>Confirm Category Updates</DialogTitle>
            <DialogDescription>
              You are about to update the categories for{" "}
              {uploadedChanges.length} transactions. Please review the changes
              before proceeding.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[400px] overflow-y-auto border p-2 rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Credit</TableHead>
                  <TableHead>Debit</TableHead>
                  <TableHead className="whitespace-nowrap">
                    Old Category
                  </TableHead>
                  <TableHead className="whitespace-nowrap">
                    New Category
                  </TableHead>
                  <TableHead>Classification</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {uploadedChanges.map((change) => (
                  <TableRow key={change.id}>
                    <TableCell>{change.date}</TableCell>
                    <TableCell>{change.description}</TableCell>
                    <TableCell>{change.credit}</TableCell>
                    <TableCell>{change.debit}</TableCell>
                    <TableCell>{change.oldCategory}</TableCell>
                    <TableCell className="text-blue-600">
                      {change.newCategory}
                    </TableCell>
                    {change.classification && (
                      <TableCell className="text-blue-600">
                        {change.classification}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setUploadedChanges([]);
                setCategoryUpdateModalOpen(false);
                fileInputRef.current.value = "";
              }}
            >
              Cancel
            </Button>
            <Button variant="default" onClick={applyUploadedCategoryChanges}>
              Confirm Updates
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-white bg-opacity-80 backdrop-blur-sm flex items-center justify-center">
          <Loader2 className="animate-spin h-8 w-8 text-[#3498db]" />
        </div>
      )}

      {/* Fixed Bottom Actions Bar */}
      {(hasChanges || globalSelectedRows.size > 0) && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 shadow-lg flex justify-end gap-2 z-50">
          {globalSelectedRows.size > 0 && (
            <Button
              variant="secondary"
              // onClick={() => setBulkCategoryModalOpen(true)}
              onClick={openBulkCategoryModal}
            >
              Update Selected Categories ({globalSelectedRows.size})
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
    </Card>
  );
};

export default DataTable;
