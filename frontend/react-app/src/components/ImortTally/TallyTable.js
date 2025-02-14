import React, { useState, useEffect, useRef } from "react";
import { Search, Loader2, Check,Download,X,Save,Plus,MessageCircle,Mail, Share2 , UploadCloud} from "lucide-react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle,DialogFooter,DialogDescription } from "../ui/dialog";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { exportToExcel } from "../exportToExcel";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from "../ui/select";
  import { RadioGroup, RadioGroupItem } from "../ui/radio-group";

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
    "Self transfer"
  ];


const DataTable = ({ data = [], title, subtitle,caseId,source,handleUpload,companyName,setCompanyName}) => {
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
    const [isLoading, setIsLoading] = useState(false);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [columnsToIgnore, setColumnsToIgnore] = useState(["id","transactionId"]);
    const [categoryOptions, setCategoryOptions] = useState(categoryOptionsfixed);

  // Category states
    const [hasChanges, setHasChanges] = useState(false);
    const [modifiedData, setModifiedData] = useState([]);
    const [showKeywordInput, setShowKeywordInput] = useState(false);
    const [currentData, setCurrentdata] = useState([]);
    const [totalPages, setTotalPages] = useState(0);

    // States for entity updating
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
    const [isSearchInputFocused, setIsSearchInputFocused] = useState(false);
  
    // Reasoning modal state
    const [reasoningModalOpen, setReasoningModalOpen] = useState(false);
    const [currentTransaction, setCurrentTransaction] = useState(null);
    const [reasoning, setReasoning] = useState("");
    // We now store pending change by transaction id
    const [pendingCategoryChange, setPendingCategoryChange] = useState(null);
    const [bulkReasoning, setBulkReasoning] = useState("");

    const [selectedTransactions, setSelectedTransactions] = useState([]);
    const [bulkLedgerValue, setBulkLedgerValue] = useState("");
    const [ledgerField, setLedgerField] = useState("dr_ledger"); // "dr_ledger" or "cr_ledger"


    const isFirstLoad = useRef(true);

  // Helper: Format dates
  const formatValue = (value) => {
    if (value instanceof Date) return value.toLocaleDateString();
    return value;
  };

  
useEffect(() => {
  console.log("Data from unified - ",data);
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

    const storedCategories = localStorage.getItem("categoryOptions");
    let localCats = storedCategories ? JSON.parse(storedCategories) : null;
    if (!localCats) {
      localCats = categoryOptions;
      localStorage.setItem("categoryOptions", JSON.stringify(localCats));
    }

    const transCats = transactions.map((tx) => tx.category);
    const mergedCategories = Array.from(new Set([...localCats, ...transCats]));
    // Step 3: If there are any new categories, update localStorage.
    if (mergedCategories.length !== localCats.length) {
      localStorage.setItem("categoryOptions", JSON.stringify(mergedCategories));
    }
    setCategoryOptions(mergedCategories);

  }, [data]);


  // Get dynamic columns from first data item
  let columns = data.length > 0 ? Object.keys(data[0]) : [];
  columns = columns.filter((column) => !columnsToIgnore.includes(column));

  const hasEntity = columns.some(
    (column) => column.toLowerCase() === "entity"
  );

  // Determine which columns are numeric
  const numericColumns = columns.filter((column) =>
    data.some((row) => {
      const value = String(row[column]);
      return !isNaN(parseFloat(value)) && !value.includes("-");
    })
  );

  const handleCategoryClassification = (category, classificationType) => {
    console.log(`Category: ${category}, Type: ${classificationType}`);
    toast({
      title: "Category Classified",
      description: `${category} has been classified as ${classificationType.replace(
        "_",
        " "
      )}`,
    });
  };

    // When classification is complete, update either the bulk field or a single row change.
    const handleClassificationSubmit = () => {
        handleCategoryClassification(newCategoryToClassify, selectedType);
        console.log({selectedType})
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

  // --- Single Row Update: Use the entire row (which includes its id) ---
  const handleCategoryChange = (transaction, newCategory) => {
    const oldCategory = transaction.category;
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
    console.log("transactionId", transactionId, "pendingCategoryChange ",pendingCategoryChange);
    const updatedFilteredData = filteredData.map((tx) => {
      console.log("tx.id", tx.id, "transactionId", transactionId);
      if (parseInt(tx.id) === parseInt(transactionId)) {
        console.log("Transaction found")
        return { ...tx, category: pendingCategoryChange.newCategory };
      }
      return tx;
    });
    setFilteredData(updatedFilteredData);
    const transaction = updatedFilteredData.find((tx) => tx.id === transactionId);
    console.log("transaction aiyaz", transaction);
    let modifiedObject = {
      ...transaction,
      oldCategory: pendingCategoryChange.oldCategory,
      keyword: showKeywordInput ? reasoning : "",
    };
    console.log("modifiedObject", modifiedObject);
    if (selectedType) {
      modifiedObject = {
        ...modifiedObject,
        classification: selectedType,
        is_new: true,
      };
    } else {
      modifiedObject = { ...modifiedObject, is_new: false };
    }
    console.log("modifiedObject final", modifiedObject);
    setModifiedData([...modifiedData, modifiedObject]);
    setHasChanges(true);
    setReasoningModalOpen(false);
    setPendingCategoryChange(null);
    setReasoning("");
    setShowKeywordInput(false);
  };

    // --- Bulk Update: Find each row by its id ---
    const handleBulkCategoryChange = () => {
        // Create a shallow copy so we don’t mutate state directly.
        const dataOnUi = filteredData.map((row) => ({ ...row }));
        const newModifiedData = [...modifiedData];
        globalSelectedRows.forEach((id) => {
          const index = dataOnUi.findIndex((row) => row.id === id);
          if (index !== -1) {
            const oldCategory = dataOnUi[index].category;
            dataOnUi[index].category =
              selectedBulkCategory === "" ? categorySearchTerm : selectedBulkCategory;
              
              if(selectedType){
                dataOnUi[index].classification = selectedType;
                dataOnUi[index].is_new = true;
              }
            newModifiedData.push({
              ...dataOnUi[index],
              oldCategory,
              reasoning: bulkReasoning,

            });
          }
        });
        setFilteredData(dataOnUi);
        setModifiedData(newModifiedData);
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


//   Filter functions

  const handleCategorySelect = (category) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((cat) => cat !== category)
        : [...prev, category]
    );
  };

  const filteredCategories = categoryOptions.filter((category) =>
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
    if (selectedCategories.length === 0) {
      setFilteredData(data);
    } else {
      const filtered = data.filter((row) =>
        selectedCategories.includes(String(row[currentFilterColumn]))
      );
      setFilteredData(filtered);
    }
    setCurrentPage(1);
    setFilterModalOpen(false);
  };

  const handleNumericFilter = (columnName, min, max) => {
    const filtered = data.filter((row) => {
      const value = parseFloat(row[columnName]);
      if (isNaN(value)) return false;
      const meetsMin = min === "" || value >= parseFloat(min);
      const meetsMax = max === "" || value <= parseFloat(max);
      return meetsMin && meetsMax;
    });
    setFilteredData(filtered);
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


  // ===== Helper functions for inline & batch "Entity" editing =====
  const handleEntityChange = (tid, newValue) => {
    setEditedEntities((prev) => ({ ...prev, [tid]: newValue }));
  };

  const handleCategorySearch = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setCategorySearchTerm(e.target.value);
  };

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
      console.log("Modified Data", modifiedData);
      const payload = convertArrayToObject(modifiedData);
      console.log("Payload", payload);
      const response = await window.electron.editCategory(payload, caseId);
      setHasChanges(false);
      toast({
        title: "Changes saved successfully",
        description: "All category updates have been saved",
      });

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
    console.log(payload);

    try {
      const response = await window.electron.editEntity(payload);
      console.log({entityUpdateIpc:response});
      if(response.success) {
        console.log("Entity updated successfully");
        // Show a success toast
        toast({
          id: "entity-update-success",
          title: "Entity Update",
          description: "Entities updated successfully",
          type: "success",
          duration:3000
        });
      }else{
        // Show an error toast
        toast({
          id: "entity-update-error",
          title: "Entity Update",
          description: "Entity update failed",
          type: "error",
          duration:3000
          
        });
        console.log("Entity update failed");
      }
    }
    catch (err) {
      console.log(err);
    }
  }


  const handleEntityUpdateConfirm = (row) => {
    const id = row.id;
    const newValue = editedEntities[id];
    if (
      window.confirm(
        "Are you sure you want to update the Entity for this transaction?"
      )
    ) {

      const payload = [{ entity: newValue, transactionId: row.id }]
      entityUpdateIpc(payload);

      // Update the local state so the UI immediately reflects the new value.
    setFilteredData((prevData) => {
      const updatedData = [...prevData];
      // Determine the correct key (e.g., "Entity" or "entity")
      const index = updatedData.findIndex((row) => row.id === id);
      
      updatedData[index] = {
        ...updatedData[index],
        entity: newValue,
      };
      return updatedData;
    });

      // Clear the edit state for this row.
      setEditedEntities((prev) => {
        const newState = { ...prev };
        delete newState[id];
        return newState;
      });
    }
  };

  // Called when the user confirms a batch update from the modal.
  const handleBatchUpdate = () => {
    if (!batchEntityValue) return;
    if (
      window.confirm(
        "Are you sure you want to update the Entity for the selected transactions?"
      )
    ) {
      const dataOnUi = filteredData.map((row) => ({ ...row }));
      // For each selected row, find the row in filteredData (using its global index)
      const payload = Array.from(globalSelectedRows).map((id) => {
        const index = dataOnUi.findIndex((row) => row.id === id);
        if (index !== -1) {
          
          dataOnUi[index] = { ...dataOnUi[index], entity: batchEntityValue };
          // Update the local state so the UI immediately reflects the new value.
          setFilteredData(dataOnUi);
          // Replace this console.log with your backend call.
          return { entity: batchEntityValue, transactionId: dataOnUi[index].id }
        }else{
          return null;
        }
      });
      console.log("Payload aq", payload);
      entityUpdateIpc(payload)

      // Clear selections and close the modal.
      setGlobalSelectedRows(new Set());
      setBatchEntityValue("");
      setBatchModalOpen(false);
    }
  };

   useEffect(() => {
      const totalPagesTemp =Math.ceil(filteredData.length / rowsPerPage);
      setTotalPages(totalPagesTemp);
      const startIndexTemp =(currentPage - 1) * rowsPerPage;
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
    // Check if the new category is non-empty and not already in the options
    if (newCategory && !categoryOptions.includes(newCategory)) {
      
      // Set the category that needs classification
      setNewCategoryToClassify(newCategory);
      // Add the new category to your category options and sort them
      const updatedOptions = [...categoryOptions, newCategory].sort();
      setCategoryOptions(updatedOptions);
      localStorage.setItem("categoryOptions", JSON.stringify(updatedOptions));
      
      
      if (row) {
        // Single-row update flow: store the pending change using the transaction id.
        setPendingCategoryChange({
          transactionId: row.id,
          newCategory,
          oldCategory: row.category,
          transaction: row,
          isDebit:row.credit===0
        });
        setShowClassificationModal(true);
      } else {
        // Bulk update flow: simply show the classification modal.
        setShowClassificationModal(true);
      }
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

  const handleDownload = ()=>{
    exportToExcel(data,title);
  }


  const handleMailShare = async () => {
      const fileName = await exportToExcel(data, `${title}.xlsx`, true);
      if (!fileName) return alert("File saving was canceled.");
    
      // Generate mailto link (without attachment, since it's not possible)
      const subject = encodeURIComponent(`${title} Report`);
      const body = encodeURIComponent(`Please find the attached ${title} report.\n\n📌 Don't forget to manually attach the saved file before sending.`);
      const mailtoLink = `mailto:?subject=${subject}&body=${body}`;
  
    // Open mail client **only after the file is saved**
    window.location.href = mailtoLink;
  };
  

  const handleWhatsappShare = async () => {
    const fileName = await exportToExcel(data, `${title}.xlsx`, true);
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
    setFilteredData((prevData) => {
      return prevData.map((transaction) =>
        transaction.id === transactionId ? { ...transaction, [column]: value } : transaction
      );
    });
  
    setTransactions((prevTransactions) => {
      return prevTransactions.map((transaction) =>
        transaction.id === transactionId ? { ...transaction, [column]: value } : transaction
      );
    });
  };

  const handleUploadToTally = async () => {
  console.log("Upload to Tally transaction", transactions);
  handleUpload(transactions);

  }

  const handleLedgerChange = (transactionId, field, value) => {
    console.log("transactionId", transactionId, "field", field, "value", value);
    setTransactions((prevTransactions) =>
      prevTransactions.map((transaction) =>
        transaction.id === transactionId ? { ...transaction, [field]: value } : transaction
      )
    );

    setFilteredData((prevData) =>
      prevData.map((transaction) =>
        transaction.id === transactionId ? { ...transaction, [field]: value } : transaction
      )
    );
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
      prevTransactions.map((transaction) =>
        selectedTransactions.includes(transaction.id)
          ? { ...transaction, [ledgerField]: bulkLedgerValue }
          : transaction
      )
    );

    setFilteredData((prevData) =>
      prevData.map((transaction) =>
        selectedTransactions.includes(transaction.id)
          ? { ...transaction, [ledgerField]: bulkLedgerValue }
          : transaction
      )
    );
    setSelectedTransactions([]);
    setBulkLedgerValue("");
  };
  
  

  return (
    // if source is equal to lifo or fifo then show the table
    <Card className="min-w-full max-w-[0]">
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
              tabIndex="0"  // ✅ Ensure the input is focusable
              onChange={(e) => setCompanyName(e.target.value)}
              className="border rounded-md p-2 w-64 dark:bg-gray-800 dark:text-white"
                onFocus={(e) => e.target.select()} // ✅ Ensure it highlights the text when clicked
      
            />
          </div>
          <div className="flex gap-4 p-4 pb-0">
            <select onChange={(e) => setLedgerField(e.target.value)} className="border rounded-md p-2">
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
          className="px-6 py-3 text-base font-medium text-white bg-gray-900 dark:bg-gray-800 dark:hover:bg-gray-700 hover:bg-gray-700 transition-all duration-200 ease-in-out rounded-lg flex items-center gap-2 shadow-sm hover:shadow-md"
        >
          <UploadCloud className="w-5 h-5 text-white" />
          Upload to Tally
        </Button>
            {/* <CardTitle className="dark:text-slate-300">{title || "Data Table"}</CardTitle> */}
            {/* <CardDescription>{subtitle || "View and manage your data"}</CardDescription> */}
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
              <select
                className="p-2 border rounded-md text-sm dark:bg-slate-800 dark:border-slate-700 w-[120px]"
                value={rowsPerPage}
                onChange={(e) => {
                  const value = e.target.value;
                    setRowsPerPage(Number(value));
                    setCurrentPage(1);
                }}
              >
                {/* <option value="5">5 rows</option> */}
                <option value="10">10 rows</option>
                <option value="20">20 rows</option>
                <option value="50">50 rows</option>
                {/* <option value="100">100 rows</option> */}
                {/* <option value="all">Show all</option> */}
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
              <div className="flex gap-2">
                {/* Download Button */}
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

                {/* Share Button */}
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

              {hasEntity && (
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
        <div className="relative  overflow-x-auto">
          <Table className="w-full">
          <TableHeader className="bg-gray-200 dark:bg-gray-900">
          <TableRow>
               
                 {/* {(columns.includes("category") || columns.includes("entity") )&&  <TableHead className="w-10">
                    <Checkbox
                        checked={
                        currentData.length > 0 &&
                        currentData.every((row) => globalSelectedRows.has(row.id))
                        }
                        onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>} */}
              <TableHead className="w-10">
                <Checkbox
                        checked={
                          selectedTransactions.length === filteredData.length
                        }
                        onCheckedChange={toggleSelectAll}
                    />
                </TableHead>
                {columns.map((column) => (
                  <TableHead key={column} className={`whitespace-nowrap ${["bill_reference","dr_ledger","cr_ledger"].includes(column)&&"min-w-[180px]"} ${column==="narration"&&"min-w-[300px]"}`}
                  // className={source === "summary" ? "bg-gray-900 dark:bg-slate-800 text-white" : ""}
                  >

                    <div className="flex items-center gap-2">
                      {["dr_ledger","cr_ledger"].includes(column) && <p className="text-lg text-gray-500 dark:text-gray-400">
                        *
                      </p>}
                      {column
                        .split("_") // Split by underscore
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()) // Capitalize
                        .join(" ")}
                        
                      {["narration","bill_reference","effective_date","reference_number"].includes(column.toLowerCase())===false && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => {
                            if (numericColumns.includes(column)) {
                              setCurrentNumericColumn(column);
                              setNumericFilterModalOpen(true);
                            } else {
                              setCurrentFilterColumn(column);
                              setSelectedCategories([]);
                              setCategorySearchTerm("");
                              setFilterModalOpen(true);
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
                  <TableCell colSpan={hasEntity ? columns.length + 1 : columns.length} className="text-center">
                    No matching results found
                  </TableCell>
                </TableRow>
              ) : (
                currentData.map((row) => {
                  return <TableRow
                    key={row.id}
                    className={`${row.imported ? "bg-green-100 dark:bg-green-900 hover:bg-green-200 dark:hover:bg-green-800" : "hover:bg-gray-100 dark:hover:bg-gray-800"}`}
                    // className={source === "summary" ? "even:bg-slate-200 even:dark:bg-slate-800 hover:bg-transparent even:hover:bg-slate-200" : ""}
                  >
                    <TableCell>
                        <Checkbox
                        checked={
                          selectedTransactions.includes(row.id)
                        }
                        onCheckedChange={() => toggleTransactionSelection(row.id)}
                    />
                      </TableCell>
                    {columns.map((column) => {
                      
                      if (column.toLowerCase() === "entity") {
                        return (
                          <TableCell
                            key={column}
                            className="max-w-[00px] relative"
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
                                  handleEntityChange(
                                    row.id,
                                    e.target.value
                                  )
                                }
                                className="w-full"
                              />
                              {editedEntities[row.id] !== undefined &&
                                editedEntities[row.id] !== row[column] && (
                                  <Check
                                    className="ml-2 cursor-pointer text-green-500"
                                    onClick={() =>
                                      handleEntityUpdateConfirm(
                                        row
                                      )
                                    }
                                  />
                                )}
                            </div>
                          </TableCell>
                        );
                      }else if(column.toLowerCase() === "category"){
                        return (
                            <TableCell
                              key={column}
                              className="max-w-[200px] group relative"
                            >
                            <Select
                            value={row[column]}
                            onValueChange={(value) =>
                              handleCategoryChange(row, value)
                            }
                            className="w-full"
                            disabled={globalSelectedRows.has(row.id)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue>{row[column]}</SelectValue>
                            </SelectTrigger>
                            <SelectContent
                              onCloseAutoFocus={(e) => {
                                e.preventDefault();
                              }}
                            >
                              <div className="p-2 border-b flex gap-2">
                                <div className="relative flex-1">
                                  <Input
                                    placeholder="Search categories..."
                                    value={categorySearchTerm}
                                    onChange={(e) =>
                                      handleCategorySearch(e)
                                    }
                                    onFocus={() =>
                                      setIsSearchInputFocused(true)
                                    }
                                    onBlur={() =>
                                      setIsSearchInputFocused(false)
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
                                </Button>
                              </div>
                              <div className="max-h-[200px] overflow-y-auto">
                                {filteredCategories.length > 0 ? (
                                  filteredCategories.map((category) => (
                                    <SelectItem
                                      key={category}
                                      value={category}
                                    >
                                      {category}
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
                                      icon above to add "{categorySearchTerm}"
                                      as a new category
                                    </p>
                                  </div>
                                )}
                              </div>
                            </SelectContent>
                          </Select>
                          </TableCell>
                          
                        )
                      }
                       else if (column.toLowerCase() === "narration") {
                        return (
                          <TableCell
                            key={column}
                            className="max-w-[500px] group relative"
                          ><Input
                          type="text"
                          value={row[column] || ""}
                          onChange={(e) => handleInputChange(row.id, column, e.target.value)}
                          placeholder="Enter Narration"
                          className="w-full p-2 border border-gray-300  truncate rounded-md"
                        />
                            <div className="absolute right-24 top-12 hidden group-hover:block bg-black text-white text-sm rounded p-2 z-50 whitespace-normal min-w-[200px] ">
                              {row[column]}
                            </div>
                          </TableCell>
                        );

                      }else if(column.toLowerCase()==="effective_date"){
                        return <TableCell
                        key={column}
                        className="w-[250px] group relative"
                      > <Input
                        type="date"
                        value={row[column] ? row[column].split("T")[0] : ""}
                        onChange={(e) => handleInputChange(row.id, column, e.target.value) }
                        className="w-full p-2 border border-gray-300 rounded-md"
                      />
                      </TableCell>
                      }
                      else if(column.toLowerCase()==="bill_reference"){
                        return  <TableCell
                            key={column}
                            className="w-[250px] group relative"
                          ><Input
                        type="text"
                        value={row[column] || ""}
                        onChange={(e) => handleInputChange(row.id, column, e.target.value)}
                        placeholder="Enter Bill Reference"
                        className="w-full p-2 border border-gray-300 rounded-md"
                      />
                      </TableCell>
                      }   else if(column.toLowerCase()==="reference_number"){
                        return  <TableCell
                            key={column}
                            className="w-[250px] group relative"
                          ><Input
                        type="text"
                        value={row[column] || ""}
                        onChange={(e) => handleInputChange(row.id, column, e.target.value)}
                        placeholder="Enter Reference Number"
                        className="w-full p-2 border border-gray-300 rounded-md"
                      />

                      </TableCell>
                      } else if(column.toLowerCase()==="imported"){
                        return  <TableCell key={column} className="max-w-[200px]">
                        <div>{row[column]===true?"Success":row.failed_reason===""?"Not Uploaded Yet":"Failed"}</div>
                      </TableCell>
                      } else if(column.toLowerCase()==="dr_ledger"){
                        return <TableCell>
                       <input
                            type="text"
                            placeholder="Enter Dr-Ledger"
                            value={row[column] || ""}
                            onChange={(e) => handleLedgerChange(row.id, "dr_ledger", e.target.value)}
                            className="border rounded-md p-2 w-full dark:bg-gray-800 dark:text-white"
                          />
                      </TableCell>
                      }else if(column.toLowerCase()==="cr_ledger"){
                        return  <TableCell>
                       <input
                            type="text"
                            placeholder="Enter Cr-Ledger"
                            value={row[column] || ""}
                            onChange={(e) => handleLedgerChange(row.id, "cr_ledger", e.target.value)}
                            className="border rounded-md p-2 w-full dark:bg-gray-800 dark:text-white"
                          />
                      </TableCell>
                      }else {
                        return (
                          <TableCell key={column} className="max-w-[200px]">
                            <div>{row[column]}</div>
                          </TableCell>
                        );
                      }
                    })}
                  </TableRow>
                })
              )}
            </TableBody>
            <TableFooter>
                <TableRow>
                  <TableCell>Total</TableCell>
                  {columns.slice(0).map((column) => (
                    <TableCell key={column}>
                      {['credit', 'debit', 'balance','amount'].includes(column.toLowerCase()) ? totals[column] : ""}
                    </TableCell>
                  ))}
                </TableRow>
              </TableFooter>
          </Table>
        </div>

        {/* Pagination */}
        { totalPages > 1 && (
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

      {/* Batch Edit Modal */}
      {batchModalOpen && (
        <Dialog open={batchModalOpen} onOpenChange={setBatchModalOpen}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Batch Update Entities</DialogTitle>
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
      
                  <div className="space-y-4">
                    <Select
                      value={selectedBulkCategory}
                      onValueChange={setSelectedBulkCategory}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select new category" />
                      </SelectTrigger>
                      <SelectContent>
                        <div className="p-2 border-b flex gap-2">
                          <div className="relative flex-1">
                            <Input
                              placeholder="Search categories..."
                              value={categorySearchTerm}
                              onChange={(e) => handleCategorySearch(e)}
                              onFocus={() =>
                                setIsSearchInputFocused(true)
                              }
                              onBlur={() =>
                                setIsSearchInputFocused(false)
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
                            className="px-2 h-10"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (categorySearchTerm.trim()) {
                                // In bulk mode we do not pass a row
                                const added = handleAddCategory(
                                  categorySearchTerm.trim()
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
                        <div className="overflow-y-auto">
                          {filteredCategories.length > 0 ? (
                            filteredCategories.map((category) => (
                              <SelectItem key={category} value={category}>
                                {category}
                              </SelectItem>
                            ))
                          ) : (
                            <div className="p-4 max-w-[300px] text-center text-muted-foreground">
                              <p className="text-md">No matching categories found</p>
                              <p className="text-sm mt-1">
                                Click the{" "}
                                <Plus className="h-3 w-3 inline-block mx-1" /> icon
                                above to add "{categorySearchTerm}" as a new category
                              </p>
                            </div>
                          )}
                        </div>
                      </SelectContent>
                    </Select>
      
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
      
                  <DialogFooter>
                    <Button
                      variant="ghost"
                      onClick={() => setBulkCategoryModalOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="default"
                      onClick={() => {
                        setBulkCategoryModalOpen(false);
                        setConfirmationModalOpen(true);
                      }}
                      disabled={!selectedBulkCategory}
                    >
                      Update Categories
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

   {/* Confirmation Modal */}
        <Dialog
          open={confirmationModalOpen}
          onOpenChange={setConfirmationModalOpen}
        >
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Confirm Category Update</DialogTitle>
              <DialogDescription>
                Are you sure you want to update the category to "
                {selectedBulkCategory}" for {globalSelectedRows.size} transactions?
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
        </Dialog>

            {/* Classification Modal */}
                <Dialog
                  open={showClassificationModal}
                  onOpenChange={() => setShowClassificationModal(false)}
                >
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
                      
                      {(!pendingCategoryChange?.isDebit || bulkCategoryModalOpen) && <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Income" id="income" />
                        <Label htmlFor="Income">Income</Label>
                      </div>}
                      {(pendingCategoryChange?.isDebit || bulkCategoryModalOpen)&&<div className="flex items-center space-x-2">
                        <RadioGroupItem value="Important Expenses / Payments" id="important_expenses" />
                        <Label htmlFor="important_expenses">Important Expenses</Label>
                      </div>}
                      {(pendingCategoryChange?.isDebit || bulkCategoryModalOpen)&&<div className="flex items-center space-x-2">
                        <RadioGroupItem value="Other Expenses / Payments" id="other_expenses" />
                        <Label htmlFor="other_expenses">Other Expenses</Label>
                      </div>}
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
          <DialogContent className="sm:max-w-[600px]">
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
                      {currentTransaction.Description}
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
                    What keywords from the description made you change the category from "{pendingCategoryChange?.oldCategory}" to "{pendingCategoryChange?.newCategory}"?
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
          <DialogTitle className="text-lg font-semibold text-gray-800 dark:text-white">Share This Report</DialogTitle>
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
              onClick={() => setBulkCategoryModalOpen(true)}
            >
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
    </Card>

    
  );
};

export default DataTable;
