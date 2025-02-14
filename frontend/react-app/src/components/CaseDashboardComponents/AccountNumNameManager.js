import React from "react";
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
import { useState, useEffect } from "react";
import { Search } from "lucide-react";
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
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "../ui/pagination";
import { useReportContext } from "../../contexts/ReportContext";


const AccountNumNameManager = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [statements, setStatements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [modifiedStatements, setModifiedStatements] = useState(new Set()); // Track modified statements
  const itemsPerPage = 10;
  const { reportData, updateReportData } = useReportContext();
  const { caseId } = reportData;


  // Fetch statements when component mounts
  useEffect(() => {
    fetchStatements();
  }, [caseId]);

  const fetchStatements = async () => {
    try {
      setLoading(true);
      const data = await window.electron.getStatements(caseId);
      setStatements(data);
      setError(null);
      setModifiedStatements(new Set()); // Reset modified statements
    } catch (err) {
      setError("Failed to fetch statements");
      console.error("Error fetching statements:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleNameChange = (id, newName) => {
    setStatements((prevStatements) =>
      prevStatements.map((statement) =>
        statement.id === id
          ? { ...statement, customerName: newName }
          : statement
      )
    );
    setModifiedStatements((prev) => new Set(prev.add(id)));
  };

  const handleAccNumberChange = (id, newAccNumber) => {
    setStatements((prevStatements) =>
      prevStatements.map((statement) =>
        statement.id === id
          ? { ...statement, accountNumber: newAccNumber }
          : statement
      )
    );
    setModifiedStatements((prev) => new Set(prev.add(id)));
  };

  const handleSaveChanges = async () => {
    if (modifiedStatements.size === 0) {
      alert("No changes to save");
      return;
    }

    try {
      setIsSaving(true);
      let successCount = 0;
      let failCount = 0;

      // Save each modified statement
      for (const id of modifiedStatements) {
        const statement = statements.find((s) => s.id === id);
        if (!statement) continue;

        try {
          await window.electron.updateStatement({
            id: statement.id,
            customerName: statement.customerName,
            accountNumber: statement.accountNumber,
          });
          successCount++;
        } catch (err) {
          console.error(`Failed to update statement ${id}:`, err);
          failCount++;
        }
      }

      // Show summary alert
      if (successCount > 0) {
        alert(
          `Successfully updated ${successCount} statement${
            successCount !== 1 ? "s" : ""
          }${failCount > 0 ? `. Failed to update ${failCount}.` : ""}`
        );
      } else if (failCount > 0) {
        alert("Failed to save changes. Please try again.");
      }

      // Refresh the statements after saving
      await fetchStatements();
    } catch (err) {
      setError("Failed to save changes");
      console.error("Error saving changes:", err);
      alert("Failed to save changes. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Filter statements based on search query
  const filteredStatements = statements.filter(
    (statement) =>
      statement.customerName
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      statement.accountNumber
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      statement.filePath?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.ceil(filteredStatements.length / itemsPerPage);

  // Get current page statements
  const currentStatements = filteredStatements.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Generate page numbers
  const getPageNumbers = () => {
    const pageNumbers = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) {
          pageNumbers.push(i);
        }
        pageNumbers.push("...");
        pageNumbers.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pageNumbers.push(1);
        pageNumbers.push("...");
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pageNumbers.push(i);
        }
      } else {
        pageNumbers.push(1);
        pageNumbers.push("...");
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pageNumbers.push(i);
        }
        pageNumbers.push("...");
        pageNumbers.push(totalPages);
      }
    }
    return pageNumbers;
  };

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center items-center">
        <p>Loading statements...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 flex justify-center items-center">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Account Number & Name Manager</CardTitle>
              <CardDescription>
                Manage statement details for case #{caseId}
              </CardDescription>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search statements..."
                className="pl-10 w-[400px]"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No.</TableHead>
                <TableHead>File Location</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Account Number</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentStatements.map((statement, index) => (
                <TableRow
                  key={statement.id}
                  className={
                    modifiedStatements.has(statement.id) ? "bg-muted/50" : ""
                  }
                >
                  <TableCell>
                    {(currentPage - 1) * itemsPerPage + index + 1}
                  </TableCell>
                  <TableCell>
                    <div
                      className="truncate max-w-96"
                      title={statement.filePath}
                    >
                      {statement.filePath}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Input
                      value={statement.customerName || ""}
                      onChange={(e) =>
                        handleNameChange(statement.id, e.target.value)
                      }
                      className="max-w-52"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={statement.accountNumber || ""}
                      onChange={(e) =>
                        handleAccNumberChange(statement.id, e.target.value)
                      }
                      className="max-w-52"
                    />
                  </TableCell>
                  <TableCell>
                    {modifiedStatements.has(statement.id) && (
                      <span className="text-sm text-muted-foreground">
                        Modified
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="mt-4">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => handlePageChange(currentPage - 1)}
                    className={cn(
                      "cursor-pointer",
                      currentPage === 1 && "pointer-events-none opacity-50"
                    )}
                  />
                </PaginationItem>

                {getPageNumbers().map((pageNumber, index) => (
                  <PaginationItem key={index}>
                    {pageNumber === "..." ? (
                      <PaginationEllipsis />
                    ) : (
                      <PaginationLink
                        onClick={() => handlePageChange(pageNumber)}
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
                    onClick={() => handlePageChange(currentPage + 1)}
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

          <AlertDialog>
            <div className="flex justify-center">
              <AlertDialogTrigger asChild>
                <Button
                  variant="default"
                  className="mt-12"
                  disabled={modifiedStatements.size === 0 || isSaving}
                >
                  {isSaving ? "Saving..." : "Save Changes"}
                </Button>
              </AlertDialogTrigger>
            </div>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirm Changes</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to save changes to{" "}
                  {modifiedStatements.size} statement
                  {modifiedStatements.size !== 1 ? "s" : ""}? This action cannot
                  be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleSaveChanges}
                  disabled={isSaving}
                >
                  {isSaving ? "Saving..." : "Save Changes"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
};

export default AccountNumNameManager;
