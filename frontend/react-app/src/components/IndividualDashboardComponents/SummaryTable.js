import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Search, Loader2 } from "lucide-react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
// import {
//   Pagination,
//   PaginationContent,
//   PaginationEllipsis,
//   PaginationItem,
//   PaginationLink,
//   PaginationNext,
//   PaginationPrevious,
// } from "../ui/pagination";
import { Label } from "../ui/label";
import DataTable from "./TableData";
import { Spinner } from "../ui/spinner";

const SummaryTable = ({ data = [], source, title, subtitle }) => {
  // const [viewMode, setViewMode] = useState("paginated"); // "all" or "paginated"
  // const [currentPage, setCurrentPage] = useState(1);
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
  // const [rowsPerPage, setRowsPerPage] = useState(10);
  const [showAllRows, setShowAllRows] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [transactionData, setTransactionData] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [error, setError] = useState(null);
  const { caseId, individualId } = useParams();

  // Get dynamic columns from first data item
  const columns = data.length > 0 ? Object.keys(data[0]) : [];

  // Determine which columns are numeric
  const numericColumns = columns.filter((column) =>
    data.some((row) => {
      const value = String(row[column]);
      return !isNaN(parseFloat(value)) && !value.includes("-");
    })
  );

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        // console.log("Fetching transactions for statementId:", caseId);
        const data = await window.electron.getTransactions(
          caseId,
          parseInt(individualId)
        );
        setTransactionData(data);
        // console.log("Fetched summary transactions:", data.length);
      } catch (err) {
        setError("Failed to fetch transactions");
        console.error("Error fetching transactions:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTransactions();
  }, []);

  const filterTransactionsByCategory = (row) => {
    if (!row || !transactionData.length) {
      console.log("No row or transaction data:", {
        row,
        transactionLength: transactionData.length,
      });
      return [];
    }

    // Get the category value from the summary row
    const categoryColumn = Object.keys(row)[0]; // "Income / Receipts"
    const categoryValue = row[categoryColumn]; // "Cash Deposits"

    return transactionData
      .filter((transaction) => transaction.category === categoryValue)
      .map((transaction) => {
        const { id, statementId, type, ...rest } = transaction;
        return {
          ...rest,
          date:
            transaction.date instanceof Date
              ? transaction.date.toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })
              : transaction.date,
        };
      });
  };

  // Add a new sorting function
  const sortDataByTotal = (data) => {
    return [...data].sort((a, b) => {
      const totalColumn = Object.keys(a).find(
        (key) =>
          key.toLowerCase() === "total" || key.toLowerCase().includes("total")
      );
      if (!totalColumn) return 0;
      const totalA = parseFloat(String(a[totalColumn]).replace(/,/g, "")) || 0;
      const totalB = parseFloat(String(b[totalColumn]).replace(/,/g, "")) || 0;
      return totalB - totalA;
    });
  };

  useEffect(() => {
    const sortedData = sortDataByTotal(data);
    setFilteredData(sortedData);
  }, [data]);

  const handleRowClick = (row) => {
    setSelectedRow(row);
    const filtered = filterTransactionsByCategory(row);
    // console.log("Filtered transactions:", filtered);
    setFilteredTransactions(filtered);
  };

  const handleSearch = (searchValue) => {
    setSearchTerm(searchValue);
    if (searchValue === "") {
      setFilteredData(data);
      // setCurrentPage(1);
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
    // setCurrentPage(1);
  };

  const handleCategorySelect = (category) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((cat) => cat !== category)
        : [...prev, category]
    );
  };

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
    // setCurrentPage(1);
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
    // setCurrentPage(1);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setFilteredData(data);
    // setCurrentPage(1);
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

  // Pagination calculations
  // const showPagination = viewMode === "paginated" && !source?.includes("summary");
  // const totalPages = showPagination ? Math.ceil(filteredData.length / rowsPerPage) : 1;
  // const startIndex = showPagination ? (currentPage - 1) * rowsPerPage : 0;
  // const endIndex = showPagination ? startIndex + rowsPerPage : filteredData.length;
  // const currentData = filteredData.slice(startIndex, endIndex);

  // Generate page numbers for pagination
  // const getPageNumbers = () => {
  //   const pageNumbers = [];
  //   const maxVisiblePages = 5;

  //   if (totalPages <= maxVisiblePages) {
  //     for (let i = 1; i <= totalPages; i++) {
  //       pageNumbers.push(i);
  //     }
  //   } else {
  //     pageNumbers.push(1);
  //     if (currentPage > 2) {
  //       pageNumbers.push("ellipsis");
  //     }
  //     if (currentPage !== 1 && currentPage !== totalPages) {
  //       pageNumbers.push(currentPage);
  //     }
  //     if (currentPage < totalPages - 1) {
  //       pageNumbers.push("ellipsis");
  //     }
  //     pageNumbers.push(totalPages);
  //   }
  //   return pageNumbers;
  // };

  const currentData = filteredData;
  // Calculate totals for numeric columns
  const totals = numericColumns.reduce((acc, column) => {
    const total = filteredData.reduce((sum, row) => {
      const value = parseFloat(row[column]);
      return !isNaN(value) ? sum + value : sum;
    }, 0);
    return { ...acc, [column]: total.toFixed(2) };
  }, {});

  return (
    // if source is equal to lifo or fifo then show the table
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <CardTitle className="dark:text-slate-300">
              {title || "Data Table"}
            </CardTitle>
            <CardDescription>
              {subtitle || "View and manage your data"}
            </CardDescription>
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
              {/* <Button
          variant="outline"
          onClick={() => {
            setViewMode(viewMode === "paginated" ? "all" : "paginated");
            setCurrentPage(1); // Reset to first page when toggling view mode
          }}
          className="whitespace-nowrap"
        >
          {viewMode === "paginated" ? "Show All" : "Show Paginated"}
        </Button> */}
              <Button
                className="dark:bg-slate-300 dark:hover:bg-slate-200"
                variant="default"
                onClick={() => clearFilters()}
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {columns.length > 0 ? (
          <div className="relative overflow-x-auto">
            <div className="flex">
              {/* Fixed First Column */}
              <div className="sticky left-0 z-20 min-w-[300px] bg-white dark:bg-slate-950">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="bg-gray-300 dark:bg-slate-800 text-black opacity-80 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {columns[0].charAt(0).toUpperCase() +
                            columns[0].slice(1).toLowerCase()}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => {
                              setCurrentFilterColumn(columns[0]);
                              setSelectedCategories([]);
                              setCategorySearchTerm("");
                              setFilterModalOpen(true);
                            }}
                          >
                            ▼
                          </Button>
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentData.map((row, index) => (
                      <TableRow
                        key={index}
                        className="even:bg-slate-200 even:dark:bg-slate-800 hover:bg-transparent even:hover:bg-slate-200 cursor-pointer"
                        onClick={
                          source === "particulars"
                            ? undefined
                            : () => handleRowClick(row)
                        }
                      >
                        <TableCell className="max-w-[200px] whitespace-nowrap">
                          {row[columns[0]]}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Scrollable Middle Columns */}
              <div className="overflow-x-auto flex-1">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {columns.slice(1, -1).map((column) => (
                        <TableHead
                          key={column}
                          className="bg-gray-300 dark:bg-slate-800 text-black opacity-80 whitespace-nowrap"
                        >
                          <div className="flex items-center gap-2">
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
                    {currentData.map((row, index) => (
                      <TableRow
                        key={index}
                        className="even:bg-slate-200 even:dark:bg-slate-800 hover:bg-transparent even:hover:bg-slate-200 cursor-pointer"
                        onClick={
                          source === "particulars"
                            ? undefined
                            : () => handleRowClick(row)
                        }
                      >
                        {columns.slice(1, -1).map((column) => (
                          <TableCell
                            key={column}
                            className="max-w-[200px] group relative"
                          >
                            <div className="truncate">{row[column]}</div>
                            {column.toLowerCase() === "description" && (
                              <div className="absolute left-0 top-10 hidden group-hover:block bg-black text-white text-sm rounded p-2 z-50 whitespace-normal min-w-[200px] max-w-[400px]">
                                {row[column]}
                              </div>
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Fixed Last Column */}
              <div className="sticky right-0 z-20 bg-white dark:bg-slate-950">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="bg-gray-300 dark:bg-slate-800 text-black opacity-80 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {columns[columns.length - 1].charAt(0).toUpperCase() +
                            columns[columns.length - 1].slice(1).toLowerCase()}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => {
                              setCurrentNumericColumn(
                                columns[columns.length - 1]
                              );
                              setNumericFilterModalOpen(true);
                            }}
                          >
                            ▼
                          </Button>
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentData.map((row, index) => (
                      <TableRow
                        key={index}
                        className="even:bg-slate-200 even:dark:bg-slate-800 hover:bg-transparent even:hover:bg-slate-200 cursor-pointer"
                        onClick={
                          source === "particulars"
                            ? undefined
                            : () => handleRowClick(row)
                        }
                      >
                        <TableCell className="max-w-[200px] whitespace-nowrap">
                          {row[columns[columns.length - 1]]}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-[200px]">
            <Spinner />
          </div>
        )}

        {/* {showPagination  && totalPages > 1 && (
          <div className="mt-4 flex justify-center">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                  />
                </PaginationItem>
                {getPageNumbers().map((pageNum, index) => (
                  <PaginationItem key={index}>
                    {pageNum === "ellipsis" ? (
                      <PaginationEllipsis />
                    ) : (
                      <PaginationLink
                        onClick={() => setCurrentPage(pageNum)}
                        isActive={currentPage === pageNum}
                      >
                        {pageNum}
                      </PaginationLink>
                    )}
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
            )} */}
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
                Apply Filters
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
                Apply Filters
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-white bg-opacity-80 backdrop-blur-sm flex items-center justify-center">
          <Loader2 className="animate-spin h-8 w-8 text-[#3498db]" />
        </div>
      )}

      <Dialog
        open={!!selectedRow}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setSelectedRow(null);
            setFilteredTransactions([]);
          }
        }}
      >
        {selectedRow && filteredTransactions.length > 0 ? (
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2"></DialogTitle>
            </DialogHeader>
            <DataTable
              data={filteredTransactions}
              title={`Transactions Details: ${Object.values(selectedRow)[0]}`}
            />
          </DialogContent>
        ) : (
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader></DialogHeader>
            <div className="bg-gray-100 p-4 rounded-md w-full h-[10vh]">
              <p className="text-gray-800 text-center mt-3 font-medium text-base">
                No data Available for this category
              </p>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </Card>
  );
};

export default SummaryTable;
