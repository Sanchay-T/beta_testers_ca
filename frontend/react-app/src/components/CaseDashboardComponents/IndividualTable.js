import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Search } from "lucide-react";
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
import { Input } from "../ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "../ui/pagination";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import PDFMarkerModal from "../MainDashboardComponents/PdfMarkerModal";
import { toast } from "../../hooks/use-toast";
// import IndividualDashboard from "@/Pages/IndividualDashboard";
import { useReportContext } from "../../contexts/ReportContext";

const ITEMS_PER_PAGE = 10;

const IndividualTable = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [statements, setStatements] = useState([]);

  // Rerun pdf states
  const [isMarkerModalOpen, setIsMarkerModalOpen] = useState(false);
  const [selectedFailedFile, setSelectedFailedFile] = useState(null);
  const [pdfEditLoading, setPdfEditLoading] = useState(false);
  const [failedDatasOfCurrentReport, setFailedDatasOfCurrentReport] = useState(
    []
  );
  const navigate = useNavigate();
  const { reportData, updateReportData } = useReportContext();
  const { caseId, reportName } = reportData;

  useEffect(() => {
    const fetchStatements = async () => {
      setIsLoading(true);
      try {
        const result = await window.electron.getStatements(caseId);
        console.log({result})
        setStatements(result);
      } catch (error) {
        console.error("Error fetching statements:", error);
      } finally {
        setIsLoading(false);
      }
    };
    if (caseId) {
      fetchStatements();
    }
  }, [caseId]);

  const filteredData = statements.filter((item) => {
    const name = item.customerName || "";
    const accountNumber = item.accountNumber || "";
    const filePath = item.filePath || "";
    const individualId = item.id || "";

    return (
      name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      accountNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      filePath.toLowerCase().includes(searchTerm.toLowerCase()) ||
      individualId.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });
  const handleSaveMarkerData = (data) => {
    // Handle saving marker data here
    console.log("recent reports failed pdf handleSave data:", data);
    setIsMarkerModalOpen(false);
  };

  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentData = filteredData.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE
  );

  const handleRowClick = async (name, accountNumber, individualId) => {
    setIsLoading(true);
    try {
      navigate(`/individual-dashboard/${caseId}/${individualId}/defaultTab`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRectify = (filePath) => {
    try {
      const selectedFile = statements.find(
        (stmt) => stmt.filePath === filePath
      );
      if (!selectedFile) {
        console.error("File not found in statements list:", filePath);
        return;
      }

      const startDate =  new Date(selectedFile.startDate).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).replace(/\//g, "-")


      const endDate = new Date(selectedFile.endDate).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).replace(/\//g, "-")

      const tempSelectedFile = {
        bankName:selectedFile.bankName,
        caseId:selectedFile.caseId,
        createdAt:selectedFile.createdAt,
        customerName:selectedFile.customerName,
        path:selectedFile.filePath,
        id:selectedFile.id,
        passwords:selectedFile.password,
        startDate:startDate,
        endDate:endDate,
      }

      console.log("Selected file from DB:", tempSelectedFile);
      setSelectedFailedFile(tempSelectedFile);
      setIsMarkerModalOpen(true);
    } catch (error) {
      console.error("Error handling rectify:", error);
    }
  };

  // const handleModalClose = () => {
  //   setIsMarkerModalOpen(false);
  //   setSelectedFailedFile(null);
  // };

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
        pageNumbers.push("ellipsis");
        pageNumbers.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pageNumbers.push(1);
        pageNumbers.push("ellipsis");
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pageNumbers.push(i);
        }
      } else {
        pageNumbers.push(1);
        pageNumbers.push("ellipsis");
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pageNumbers.push(i);
        }
        pageNumbers.push("ellipsis");
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

  const handleCombinedDashboardClick = (caseId) => {
    setIsLoading(true);
    try {
      navigate(`/individual-dashboard/${caseId}/defaultTab`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-8 space-y-8">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Individual Records</CardTitle>
              <CardDescription className="py-3">
                Search and view individual records for this case
              </CardDescription>
            </div>
            <div className="relative flex items-center space-x-4">
            <Button onClick={() => handleCombinedDashboardClick(caseId)}>
                Combined Dashboard
              </Button>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search records..."
                  className="pl-10 w-[400px]"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No.</TableHead>
                <TableHead>File Name</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Account Number</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">
                    No matching results found
                  </TableCell>
                </TableRow>
              ) : (
                currentData.map((item, index) => {
                  const filePath = item.filePath || "";
                  const filename = filePath.split("\\").pop(); // Get filename from path
                  const filenameWithoutTimestamp = filename
                    ? filename.substring(filename.indexOf("-") + 1)
                    : "";

                  return (
                    <TableRow
                      key={index}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleRowClick(item.customerName, item.accountNumber, item.id)}
                    >
                      <TableCell>{startIndex + index + 1}</TableCell>
                      <TableCell>
                        <div className="truncate max-w-96" title={filenameWithoutTimestamp}>
                          {filenameWithoutTimestamp}
                        </div>
                      </TableCell>
                      <TableCell>{item.customerName}</TableCell>
                      <TableCell>{item.accountNumber}</TableCell>
                      <TableCell>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent row click
                            handleRectify(item.filePath);
                          }}
                        >
                          Re-run
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
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
                    {pageNumber === "ellipsis" ? (
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
        </CardContent>
      </Card>

      <PDFMarkerModal
        isOpen={isMarkerModalOpen}
        selectedFailedFile={selectedFailedFile}
        source={"indiviualDashboard"}
        setFailedDatasOfCurrentReport={setFailedDatasOfCurrentReport}
        failedDatasOfCurrentReport={failedDatasOfCurrentReport}
        onClose={()=>setIsMarkerModalOpen(false)}
      />

      {isLoading && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      )}
    </div>
  );
};

export default IndividualTable;
