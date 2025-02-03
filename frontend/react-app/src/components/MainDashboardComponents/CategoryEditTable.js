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
  caseId
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

  // New states for multiple selection
  const [selectedRows, setSelectedRows] = useState([]);
  const [bulkCategoryModalOpen, setBulkCategoryModalOpen] = useState(false);
  const [selectedBulkCategory, setSelectedBulkCategory] = useState("");
  const [confirmationModalOpen, setConfirmationModalOpen] = useState(false);
  const [globalSelectedRows, setGlobalSelectedRows] = useState(new Set());

  // New states for classification modal
  const [selectedType, setSelectedType] = useState("");
  const [showClassificationModal, setShowClassificationModal] = useState(false);
  const [newCategoryToClassify, setNewCategoryToClassify] = useState("");
  const [isSearchInputFocused, setIsSearchInputFocused] = useState(false);

  // Add new state for reasoning dialog
  const [reasoningModalOpen, setReasoningModalOpen] = useState(false);
  const [currentTransaction, setCurrentTransaction] = useState(null);
  const [reasoning, setReasoning] = useState("");
  const [pendingCategoryChange, setPendingCategoryChange] = useState(null);
  const [bulkReasoning, setBulkReasoning] = useState("");

  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [showAllRows, setShowAllRows] = useState(false);

  // Add this helper function to format dates
  const formatValue = (value) => {
    if (value instanceof Date) {
      return value.toLocaleDateString();
    }
    return value;
  };

  useEffect(() => {
    // console.log({dataFromEditCategoryTable:data})
    // Format any Date objects in the data when it's first received
    const formattedData = data.map((row, index) => {
      const newRow = {
        ...row 
      };
      
      // Format each value
      Object.keys(row).forEach((key) => {
        newRow[key] = formatValue(row[key]);
      });

      return newRow;
    });
    // also add a id field to each transaction which resembles real row id of that transaction


    setTransactions(formattedData);
    setFilteredData(formattedData);
  }, [data]);

  // useEffect(() => {
  //   setTransactions(data);
  //   setFilteredData(data);
  // }, [data]);

  // Get dynamic columns from first data item
  let columns = data.length > 0 ? Object.keys(data[0]) : [];
  columns = columns.filter((column) => !columnsToIgnore.includes(column));

  // Determine which columns are numeric
  const numericColumns = columns.filter((column) =>
    data.some((row) => {
      const value = String(row[column]);
      return !isNaN(parseFloat(value)) && !value.includes("-");
    })
  );
  const handleCategoryClassification = (category, classificationType) => {
    // Here you can store the classification mapping
    // You might want to save this to your backend or state management system
    console.log(`Category: ${category}, Type: ${classificationType}`);

    toast({
      title: "Category Classified",
      description: `${category} has been classified as ${classificationType.replace(
        "_",
        " "
      )}`,
    });
  };

  const handleClassificationSubmit = () => {
    handleCategoryClassification(newCategoryToClassify, selectedType);
    setShowClassificationModal(false);

    // Set the pending category change
    const oldCategory =
      currentData[pendingCategoryChange?.rowIndex]?.category || "";
    setPendingCategoryChange({
      ...pendingCategoryChange,
      newCategory: newCategoryToClassify,
      oldCategory: oldCategory,
    });

    // Set the current transaction for the reasoning modal
    setCurrentTransaction(currentData[pendingCategoryChange?.rowIndex]);

    setSelectedBulkCategory(newCategoryToClassify);

    // Show the reasoning modal
    if(bulkCategoryModalOpen){
      // handleBulkCategoryChange();
    }else{

      setReasoningModalOpen(true);
    }
    // setSelectedType(""); // Reset for next use
  };

  const handleSearch = (searchValue) => {
    setSearchTerm(searchValue);
    if (searchValue === "") {
      setFilteredData(transactions);
      setCurrentPage(1);
      return;
    }

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

  const handleCategoryChange = (rowIndex, newCategory) => {
    const dataOnUi = [...currentData];
    const oldCategory = dataOnUi[rowIndex].category;

    // Store pending change and show reasoning dialog
    setPendingCategoryChange({
      rowIndex,
      newCategory,
      oldCategory,
      transaction: dataOnUi[rowIndex],
    });
    setCurrentTransaction(dataOnUi[rowIndex]);
    setReasoningModalOpen(true);
  };

  const confirmCategoryChange = () => {
    if (!pendingCategoryChange) return;

    const { rowIndex, newCategory, oldCategory } = pendingCategoryChange;
    const dataOnUi = [...currentData];
    dataOnUi[rowIndex].category = newCategory;
    setCurrentdata(dataOnUi);
    console.log({selectedType})
    if(selectedType){
      const modifiedObject = {
        ...dataOnUi[rowIndex],
        oldCategory,
        classification:selectedType,
        is_new:true,
        keyword: showKeywordInput ? reasoning : "", // Only include reasoning if checkbox was checked
      };
      setModifiedData([...modifiedData, modifiedObject]);
      setSelectedType(""); // Reset for next use
    }
    else{
    const modifiedObject = {
      ...dataOnUi[rowIndex],
      oldCategory,
      is_new:false,
      keyword: showKeywordInput ? reasoning : "", // Only include reasoning if checkbox was checked
    };
    setModifiedData([...modifiedData, modifiedObject]);
  }
    setHasChanges(true);

    // Reset states
    setReasoningModalOpen(false);
    setPendingCategoryChange(null);
    setReasoning("");
    setShowKeywordInput(false); // Reset checkbox state
  };

  // New function to handle bulk category change
  // Modify bulk category update to work with global selection
  const handleBulkCategoryChange = () => {
    const dataOnUi = [...filteredData];
    const newModifiedData = [...modifiedData];

    globalSelectedRows.forEach((globalIndex) => {
      const oldCategory = dataOnUi[globalIndex].category;
      dataOnUi[globalIndex].category = selectedBulkCategory===""?  categorySearchTerm :selectedBulkCategory 

      const modifiedObject = {
        ...dataOnUi[globalIndex],
        oldCategory,
        reasoning: bulkReasoning,
      };

      console.log({aiyaz:modifiedObject})
      newModifiedData.push(modifiedObject);
    });

    setFilteredData(dataOnUi);
    setModifiedData(newModifiedData);
    setHasChanges(true);
    setGlobalSelectedRows(new Set());
    setBulkCategoryModalOpen(false);
    setConfirmationModalOpen(false);
    setSelectedBulkCategory("");
    setBulkReasoning("");

    // toast({
    //   title: "Categories updated",
    //   description: `Updated ${globalSelectedRows.size} transactions`,
    // });
  };

  // Function to handle row selection
  const toggleRowSelection = (index) => {
    const globalIndex = startIndex + index;
    setGlobalSelectedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(globalIndex)) {
        newSet.delete(globalIndex);
      } else {
        newSet.add(globalIndex);
      }
      return newSet;
    });
  };

  // Modify toggleSelectAll for current page
  const toggleSelectAll = () => {
    const newGlobalSelected = new Set(globalSelectedRows);
    const allCurrentPageSelected = filteredData.every((_, index) =>
      newGlobalSelected.has(startIndex + index)
    );

    if (allCurrentPageSelected) {
      // Unselect all items on current page
      filteredData.forEach((_, index) => {
        newGlobalSelected.delete(startIndex + index);
      });
    } else {
      // Select all items on current page
      filteredData.forEach((_, index) => {
        newGlobalSelected.add(startIndex + index);
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
  // Filter categories based on search term
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
    setSelectedRows([]);
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
    e.stopPropagation(); // Prevent event bubbling
    setCategorySearchTerm(e.target.value);
  };

  console.log("category search term", categorySearchTerm);
  console.log("selected Categories", selectedCategories);

  // Function to add new category
  const handleAddCategory = (newCategory, rowIndex) => {
    if (newCategory && !categoryOptions.includes(newCategory)) {
      setNewCategoryToClassify(newCategory);
      // Store the row index with the pending change
      setPendingCategoryChange({
        rowIndex,
        newCategory: newCategory,
        oldCategory: currentData[rowIndex]?.category || "",
      });
      setShowClassificationModal(true);
      const updatedOptions = [...categoryOptions, newCategory].sort();
      setCategoryOptions(updatedOptions);
      return true;
    }
    return false;
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

  const convertArrayToObject = (array) => {
    console.log({insideCategoryEditTable:array})
    return array.reduce((acc, transaction) => {
      // Use realid if present, otherwise use transactionId
      const id = transaction.id;
      
      // Only add to accumulator if we have a valid id
      if (id) {
          acc[Number(id)] = transaction;
      }
      return acc;
    }, {});
  };

  const handleSaveChanges = async () => {
    try {
      setIsLoading(true);

      console.log({ "Form Submitted": modifiedData });
      const payload = convertArrayToObject(modifiedData)
      console.log("sending request ",payload)
      const reposonse = await window.electron.editCategory(payload,caseId);
      console.log({reposonse})

      setHasChanges(false);
      toast({
        title: "Changes saved successfully",
        description: "All category updates have been saved",
      });
      //  refresh this component only
      
    } catch (error) {
      toast({
        title: "Error saving changes",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
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
                <option value="5">5 rows</option>
                <option value="10">10 rows</option>
                <option value="20">20 rows</option>
                <option value="50">50 rows</option>
                <option value="100">100 rows</option>
                <option value="all">Show all</option>
              </select>
              <Button variant="default" onClick={() => clearFilters()}>
                Clear Filters
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center flex gap-2 items-center">
                    <div className="flex items-center gap-2">
                      <p className={"whitespace-nowrap"}>Select All</p>
                    </div>
                    <Checkbox
                      checked={
                        currentData.length > 0 &&
                        currentData.every((_, index) =>
                          globalSelectedRows.has(startIndex + index)
                        )
                      }
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  {columns.map((column) => (
                    <TableHead key={column}>
                      <div className="flex items-center gap-2 whitespace-nowrap ">
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
                  currentData.map((row, index) => (
                    <TableRow
                      key={index}
                      className={cn(
                        selectedRows.includes(index) && "bg-muted/50"
                      )}
                    >
                      <TableCell className="text-center">
                        <Checkbox
                          checked={globalSelectedRows.has(startIndex + index)}
                          onCheckedChange={() => toggleRowSelection(index)}
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
                                handleCategoryChange(index, value)
                              }
                              className="w-full"
                              disabled={globalSelectedRows.has(
                                startIndex + index
                              )}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue>{row[column]}</SelectValue>
                              </SelectTrigger>
                              <SelectContent
                                onCloseAutoFocus={(e) => {
                                  // Prevent the default focus behavior
                                  e.preventDefault();
                                }}
                              >
                                <div className="p-2 border-b flex gap-2">
                                  <div className="relative flex-1">
                                    <Input
                                      placeholder="Search categories..."
                                      value={categorySearchTerm}
                                      onChange={(e) => handleCategorySearch(e)}
                                      // Add these handlers
                                      onFocus={() =>
                                        setIsSearchInputFocused(true)
                                      }
                                      onBlur={() =>
                                        setIsSearchInputFocused(false)
                                      }
                                      // Prevent the select's keyboard navigation from interfering
                                      onKeyDown={(e) => {
                                        e.stopPropagation();
                                      }}
                                      // Prevent any click events from bubbling up to the Select
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
                                        const added = handleAddCategory(
                                          categorySearchTerm.trim(),
                                          index // Pass the row index
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

        {/* category Filter Modal */}
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

        {/* Bulk category Update Modal */}
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
                          // Add these handlers
                          onFocus={() =>
                            setIsSearchInputFocused(true)
                          }
                          onBlur={() =>
                            setIsSearchInputFocused(false)
                          }
                          // Prevent the select's keyboard navigation from interfering
                          onKeyDown={(e) => {
                            e.stopPropagation();
                          }}
                          // Prevent any click events from bubbling up to the Select
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
                            const added = handleAddCategory(
                              categorySearchTerm.trim(),
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
        </Dialog>

        {/* Classification modal */}
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
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="income" id="income" />
                <Label htmlFor="income">Income</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem
                  value="Important Expenses"
                  id="important_expenses"
                />
                <Label htmlFor="important_expenses">Important Expenses</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Other Expenses" id="other_expenses" />
                <Label htmlFor="other_expenses">Other Expenses</Label>
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

            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => {
                  setReasoningModalOpen(false);
                  setPendingCategoryChange(null);
                  setReasoning("");
                  setShowKeywordInput(false); // Reset checkbox state
                }}
              >
                Cancel
              </Button>
              <Button
                variant="default"
                onClick={confirmCategoryChange}
                disabled={showKeywordInput && !reasoning} // Only disable if checkbox is checked and no reasoning provided
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

      {/* Fixed bottom actions bar */}
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
