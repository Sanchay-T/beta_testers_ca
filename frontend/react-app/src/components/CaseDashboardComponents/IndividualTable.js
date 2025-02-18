import React, { useState, useEffect, useRef } from "react";
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
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import PDFMarkerModal from "../MainDashboardComponents/PdfMarkerModal";
import { toast } from "../../hooks/use-toast";
import { useReportContext } from "../../contexts/ReportContext";

const IndividualTable = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [statements, setStatements] = useState([]);

  // Rerun pdf states
  const [isMarkerModalOpen, setIsMarkerModalOpen] = useState(false);
  const [selectedFailedFile, setSelectedFailedFile] = useState(null);
  const [pdfEditLoading, setPdfEditLoading] = useState(false);
  const [failedDatasOfCurrentReport, setFailedDatasOfCurrentReport] = useState(
    []
  );

  // Use a ref to store the file path being processed
  const processingFilePathRef = useRef(null);
  const [processingState, setProcessingState] = useState({});

  const navigate = useNavigate();
  const { reportData, updateReportData } = useReportContext();
  const { caseId, reportName } = reportData;

  const fetchStatements = async () => {
    setIsLoading(true);
    try {
      const result = await window.electron.getStatements(caseId);
      console.log({ result });
      setStatements(result);
    } catch (error) {
      console.error("Error fetching statements:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (caseId) {
      fetchStatements();
    }
  }, [caseId]);

  const filteredData = statements.filter((item) => {
    const name = item.customerName || "";
    const accountNumber = item.accountNumber || "";
    const filePath = item.filePath || "";
    return (
      name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      accountNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      filePath.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const currentData = filteredData;

  const handleSaveMarkerData = (data) => {
    // Handle saving marker data here
    console.log("recent reports failed pdf handleSave data:", data);
    setIsMarkerModalOpen(false);
  };

  const handleRowClick = async (name, accountNumber, individualId) => {
    setIsLoading(true);
    try {
      navigate(`/individual-dashboard/${caseId}/${individualId}/defaultTab`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRectify = async (filePath) => {
    // Update processing state for this specific file path
    setProcessingState((prev) => ({ ...prev, [filePath]: true }));
    processingFilePathRef.current = filePath;
    console.log("filePath", processingFilePathRef.current);

    try {
      const selectedFile = statements.find(
        (stmt) => stmt.filePath === filePath
      );
      if (!selectedFile) {
        console.error("File not found in statements list:", filePath);
        // Reset processing state if file not found
        setProcessingState((prev) => ({ ...prev, [filePath]: false }));
        processingFilePathRef.current = null;
        return;
      }

      const startDate = new Date(selectedFile.startDate)
        .toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
        .replace(/\//g, "-");

      const endDate = new Date(selectedFile.endDate)
        .toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
        .replace(/\//g, "-");

      const tempSelectedFile = {
        bankName: selectedFile.bankName,
        caseId: selectedFile.caseId,
        createdAt: selectedFile.createdAt,
        customerName: selectedFile.customerName,
        path: selectedFile.filePath,
        id: selectedFile.id,
        passwords: selectedFile.password,
        startDate: startDate,
        endDate: endDate,
      };

      setSelectedFailedFile(tempSelectedFile);
      setIsMarkerModalOpen(true);
    } catch (error) {
      console.error("Error handling rectify:", error);
      // Clear processing state for this file on error
      setProcessingState((prev) => ({ ...prev, [filePath]: false }));
      processingFilePathRef.current = null;
    }
  };

  // Handle modal close - clear processing state
  const handleModalClose = () => {
    setIsMarkerModalOpen(false);
    // Important: Reset processing state when modal is closed
    if (processingFilePathRef.current) {
      setProcessingState((prev) => ({
        ...prev,
        [processingFilePathRef.current]: false,
      }));
      processingFilePathRef.current = null;
    }
    console.log("processingFilePathRef.current", processingFilePathRef.current);
  };
  // Add this new function to handle completion
  const handleProcessingComplete = () => {
    // First, fetch the updated statements
    fetchStatements();

    // Then, reset the processing state for the current file being processed
    if (processingFilePathRef.current) {
      setProcessingState((prev) => ({
        ...prev,
        [processingFilePathRef.current]: false,
      }));
      processingFilePathRef.current = null;
    }
    console.log("handle", processingFilePathRef.current);
    setProcessingState(false);
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

                  // Check if this specific row is processing
                  const isProcessing = processingState[filePath];
                  console.log("is Processing", isProcessing);

                  return (
                    <TableRow
                      key={index}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() =>
                        handleRowClick(
                          item.customerName,
                          item.accountNumber,
                          item.id
                        )
                      }
                    >
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>
                        <div
                          className="truncate max-w-96"
                          title={filenameWithoutTimestamp}
                        >
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
                          disabled={isProcessing}
                        >
                          {isProcessing ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              <span>Processing...</span>
                            </>
                          ) : (
                            "Re-run"
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          {/* Removed Pagination Component */}
        </CardContent>
      </Card>

      <PDFMarkerModal
        isOpen={isMarkerModalOpen}
        selectedFailedFile={selectedFailedFile}
        source={"indiviualDashboard"}
        setFailedDatasOfCurrentReport={setFailedDatasOfCurrentReport}
        failedDatasOfCurrentReport={failedDatasOfCurrentReport}
        onClose={handleModalClose}
        onProcessingComplete={handleProcessingComplete}
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
