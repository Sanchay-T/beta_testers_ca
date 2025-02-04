import React, { useState, useEffect } from "react";
import { Search, Loader2, Save, Plus } from "lucide-react";
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
  DialogDescription,
  DialogFooter,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { useToast } from "../../hooks/use-toast";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";

const CategoryEditTable = ({
  data = [],
  categoryOptions,
  setCategoryOptions,
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
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [hasChanges, setHasChanges] = useState(false);
  const [currentData, setCurrentdata] = useState([]);
  const [modifiedData, setModifiedData] = useState([]);
  const [totalPages, setTotalPages] = useState(0);
  const [startIndex, setStartIndex] = useState(0);
  const [endIndex, setEndIndex] = useState(0);
  const [columnsToIgnore, setColumnsToIgnore] = useState(["id"]);
  const [showKeywordInput, setShowKeywordInput] = useState(false);

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

  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [showAllRows, setShowAllRows] = useState(false);

  // Helper: Format dates
  const formatValue = (value) => {
    if (value instanceof Date) return value.toLocaleDateString();
    return value;
  };

  useEffect(() => {
    const formattedData = data.map((row) => {
      const newRow = { ...row };
      Object.keys(row).forEach((key) => {
        newRow[key] = formatValue(row[key]);
      });
      return newRow;
    });

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

    setTransactions(formattedData);
    setFilteredData(formattedData);
  }, [data]);

  let columns = data.length > 0 ? Object.keys(data[0]) : [];
  columns = columns.filter((column) => !columnsToIgnore.includes(column));

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
      setFilteredData(transactions);
      setCurrentPage(1);
      return;
    }
    const columnsToReplace = ["amount", "balance", "debit", "credit"];
    const filtered = transactions.filter((row) =>
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
      setFilteredData(transactions);
    } else {
      const filtered = transactions.filter((row) =>
        selectedCategories.includes(String(row[currentFilterColumn]))
      );
      setFilteredData(filtered);
    }
    setCurrentPage(1);
    setFilterModalOpen(false);
  };

  const handleNumericFilter = (columnName, min, max) => {
    const filtered = transactions.filter((row) => {
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
    return [...new Set(transactions.map((row) => String(row[columnName])))];
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

  useEffect(() => {
    const totalPagesTemp = showAllRows
      ? 1
      : Math.ceil(filteredData.length / rowsPerPage);
    setTotalPages(totalPagesTemp);
    const startIndexTemp = showAllRows ? 0 : (currentPage - 1) * rowsPerPage;
    setStartIndex(startIndexTemp);
    const endIndexTemp = showAllRows
      ? filteredData.length
      : startIndexTemp + rowsPerPage;
    setEndIndex(endIndexTemp);
    setCurrentdata(filteredData.slice(startIndexTemp, endIndexTemp));
  }, [filteredData, currentPage, rowsPerPage, showAllRows]);

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
  

  return (
    <div className="relative min-h-screen flex flex-col">
      <Card className="flex-1 pb-14">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div className="space-y-2">
              <CardTitle>Edit Categories</CardTitle>
              <CardDescription>View and manage your categories</CardDescription>
            </div>
            <div className="relative flex items-center gap-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                className="pl-10 w-[400px]"
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
              />
              <select
                className="p-2 border rounded-md text-sm dark:bg-slate-800 dark:border-slate-700 w-[120px]"
                value={showAllRows ? "all" : rowsPerPage}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "all") {
                    setShowAllRows(true);
                    setCurrentPage(1);
                  } else {
                    setShowAllRows(false);
                    setRowsPerPage(Number(value));
                    setCurrentPage(1);
                  }
                }}
              >
                {/* <option value="5">5 rows</option> */}
                <option value="10">10 rows</option>
                <option value="20">20 rows</option>
                <option value="50">50 rows</option>
                {/* <option value="100">100 rows</option> */}
                {/* <option value="all">Show all</option> */}
              </select>
              <Button variant="default" onClick={clearFilters}>
                Clear Filters
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto min-w-[900px]">
          <div className="relative">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center flex gap-2 items-center">
                    <div className="flex items-center gap-2">
                      <p className="whitespace-nowrap">Select All</p>
                    </div>
                    <Checkbox
                      checked={
                        currentData.length > 0 &&
                        currentData.every((row) => globalSelectedRows.has(row.id))
                      }
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  {columns.map((column) => (
                    <TableHead key={column}>
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        {column.charAt(0).toUpperCase() +
                          column.slice(1).toLowerCase()}
                        {column.toLowerCase() !== "description" && (
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
                    <TableCell
                      colSpan={columns.length + 1}
                      className="text-center"
                    >
                      No matching results found
                    </TableCell>
                  </TableRow>
                ) : (
                  currentData.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={globalSelectedRows.has(row.id)}
                          onCheckedChange={() => toggleRowSelection(row.id)}
                        />
                      </TableCell>
                      {columns.map((column) => (
                        <TableCell
                          key={column}
                          className="max-w-[200px] group relative"
                        >
                          {column.toLowerCase() === "category" ? (
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
                          ) : (
                            <div className="truncate">
                              {formatValue(row[column])}
                            </div>
                          )}
                          {column.toLowerCase() === "description" && (
                            <div className="absolute left-0 top-10 hidden group-hover:block bg-black text-white text-sm rounded p-2 z-50 whitespace-normal min-w-[200px] max-w-[400px]">
                              {formatValue(row[column])}
                            </div>
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
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
                        setCurrentPage((prev) =>
                          Math.min(prev + 1, totalPages)
                        )
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

        {/* Filter Modal */}
        {filterModalOpen && (
          <Dialog open={filterModalOpen} onOpenChange={setFilterModalOpen}>
            <DialogContent className="sm:max-w-[400px]">
              <DialogHeader>
                <DialogTitle>Filter {currentFilterColumn}</DialogTitle>
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
                    className="flex items-center gap-1 p-2 hover:bg-gray-50 rounded-md cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedCategories.includes(value)}
                      onCheckedChange={() => handleCategorySelect(value)}
                    />
                    <span className="text-gray-700">{value}</span>
                  </label>
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={handleSelectAll}>
                  Select All
                </Button>
                <Button
                  variant="default"
                  className="bg-black hover:bg-gray-800"
                  onClick={handleColumnFilter}
                >
                  Save changes
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Numeric Filter Modal */}
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
                  className="bg-black hover:bg-gray-800"
                  onClick={() => {
                    handleNumericFilter(
                      currentNumericColumn,
                      minValue,
                      maxValue
                    );
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
                <RadioGroupItem value="income" id="income" />
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

        {/* Loading Overlay */}
        {isLoading && (
          <div className="fixed inset-0 bg-white bg-opacity-80 backdrop-blur-sm flex items-center justify-center">
            <Loader2 className="animate-spin h-8 w-8 text-[#3498db]" />
          </div>
        )}
      </Card>

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
    </div>
  );
};

export default CategoryEditTable;
