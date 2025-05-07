import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Search, Download } from "lucide-react";
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
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
} from "../ui/alert-dialog";
import { Checkbox } from "../ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { generateFinancialReport } from "../ReportExcel";
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
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [selectedStatementId, setSelectedStatementId] = useState(null);

  const fetchStatements = async () => {
    setIsLoading(true);
    try {
      const result = await window.electron.getStatements(caseId);
      setStatements(result);

      // Update the report data with the file path of statements
      updateReportData({ filePath: result[0]?.filePath });
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
    // console.log("filePath", processingFilePathRef.current);

    try {
      const selectedFile = statements.find(
        (stmt) => stmt.filePath === filePath
      );
      // console.log({ selectedFile });
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
    // console.log("processingFilePathRef.current", processingFilePathRef.current);
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
    // console.log("handle", processingFilePathRef.current);
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

  const confirmDelete = (statementId) => {
    // console.log("Deleting statement ID:", statementId); // Debugging
    setSelectedStatementId(statementId);
    setIsDialogOpen(true);
  };

  const handleDeleteConfirmed = async () => {
    if (!selectedStatementId) {
      console.error("Error: No statement ID selected for deletion.");
      return;
    }

    try {
      // console.log("Deleting statement ID:", selectedStatementId); // Debugging
      const result = await window.electron.deleteStatement(selectedStatementId);

      // Remove from UI after successful deletion
      setStatements((prev) =>
        prev.filter((statement) => statement.id !== selectedStatementId)
      );

      toast({ title: "Statement deleted successfully", variant: "success" });
    } catch (error) {
      console.error("Error deleting statement:", error); // Log error
      toast({ title: "Failed to delete statement", variant: "destructive" });
    } finally {
      setIsDialogOpen(false);
      setIsChecked(false);
      setSelectedStatementId(null);
    }
  };

  const handleDownload = async (caseId, individualId) => {
    try {
      const success = await generateFinancialReport(caseId, individualId, null);

      if (success) {
      } else {
        console.error("Failed to generate the financial report.");
      }
    } catch (error) {
      console.error("Error in handleDownload:", error);
    }

    // const SummaryData = await window.electron.getSummary(caseid);
    // const summaryObject = JSON.parse(SummaryData[0].data);
    // const getStatements = await window.electron.getStatements(caseid);
    // const accountNumber = getStatements[0].accountNumber;
    // const customerName = getStatements[0].customerName;
    // const bankName = getStatements[0].bankName;

    // // Map the data to the required format
    // const mappedData = mapDataForExcelGenerator(
    //   accountNumber,
    //   customerName,
    //   bankName,
    //   summaryObject
    // );
    // SummaryExcel(mappedData);

    // const opportunityToEarnData =
    //   await window.electron.getOpportunityToEarnForExcel(caseid);
    // OpportunityToEarnExcel(opportunityToEarnData.data);

    // const EodData = await window.electron.getEodBalance(caseid);
    // const formattedEodData = EodformatData(EodData[0].data);
    // EodBalanceExcel(formattedEodData);

    // EodBalanceExcel(formattedEodData);

    // const cashwithdrawal =
    //   await window.electron.getTransactionsByCashWithdrawal(caseid);
    // CashWithdrawalExcel(cashwithdrawal);

    // const cashdeposit = await window.electron.getTransactionsByCashDeposit(
    //   caseid
    // );
    // CashDepositExcel(cashdeposit);

    // const ProbableEmi = await window.electron.getTransactionsByEmi(caseid);
    // ProbableEmiExcel(ProbableEmi);

    // const reversal = await window.electron.getTransactionsByReversal(caseid);
    // ReversalExcel(reversal);

    // const suspensecredit =
    //   await window.electron.getTransactionsBySuspenseCredit(caseid);
    // const transformData = processSuspenseData(suspensecredit);
    // SuspenseCreditExcel(transformData);

    // const suspensedebit = await window.electron.getTransactionsBySuspenseDebit(
    //   caseid
    // );
    // const transformData = processSuspenseData(suspensedebit);
    // SuspenseDebitExcel(transformData);

    // let file_cretaed = false;
    // try {
    //   setIsExcelLoading(true); // Start loading

    //   // Start the download process in the main process
    //   window.electron.download.excelReportDownload(caseid);

    //   let downloadedChunks = [];
    //   // let totalFileSize = 0;
    //   let downloadProgress = 0;

    //   // Listen for file chunks from the main process
    //   window.electron.download.onExcelDownloadChunk((chunk) => {
    //     downloadedChunks.push(chunk);
    //     downloadProgress += chunk.length;

    //     // Update progress if needed (could add a progress bar)
    //     // const progressPercentage = (downloadProgress / totalFileSize) * 100;
    //     // setProgress(progressPercentage);
    //   });

    //   // Listen for download completion
    //   window.electron.download.onExcelDownloadComplete((res) => {
    //     if (!file_cretaed) {
    //       file_cretaed = true;
    //       const { message, fileName } = res;
    //       setIsExcelLoading(false); // End loading state

    //       const fileBlob = new Blob(downloadedChunks, {
    //         type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    //       });
    //       const url = window.URL.createObjectURL(fileBlob);

    //       // Trigger file download
    //       const link = document.createElement("a");
    //       link.href = url;
    //       link.download = fileName;
    //       link.click();

    //       // Clean up URL
    //       window.URL.revokeObjectURL(url);

    //       toast({
    //         title: "Success",
    //         description: res.message || "Excel file downloaded successfully",
    //       });
    //     }
    //   });

    //   // Handle download error
    //   window.electron.download.onExcelDownloadError((error) => {
    //     setIsExcelLoading(false);

    //     toast({
    //       title: "Error",
    //       description: `Failed to download Excel file: ${error}`,
    //       variant: "destructive",
    //     });
    //   });
    // } catch (error) {
    //   setIsExcelLoading(false);
    //   toast({
    //     title: "Error",
    //     description: `Failed to initiate download: ${error.message}`,
    //     variant: "destructive",
    //   });
    // }
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
                      <TooltipProvider delayDuration={800}>
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
                        <TableCell className="flex gap-2">
                          <Tooltip>
                            <TooltipTrigger>
                              {console.log({ item })}
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation(); // Prevent row click
                                  handleDownload(caseId, item.id);
                                }}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              Download Report for this particular file
                            </TooltipContent>
                          </Tooltip>
                          <Button
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation(); // Prevent row click
                              if (item.filePath.includes(".pdf")) {
                                handleRectify(item.filePath);
                              } else {
                                toast({
                                  title: "Alert",
                                  description: "File not supported for rerun",
                                  variant: "destructive",
                                  duration: 3000,
                                });
                              }
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
                      </TooltipProvider>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          {/* Removed Pagination Component */}
        </CardContent>
      </Card>

      <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Statement</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="flex items-center space-x-2 mt-4">
            <Checkbox
              id="confirm-delete"
              checked={isChecked}
              onCheckedChange={setIsChecked}
              className="mb-5"
            />
            <label htmlFor="confirm-delete" className="text-sm">
              Are you sure you want to delete this report? This action cannot be
              undone.
            </label>
          </div>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleDeleteConfirmed} disabled={!isChecked}>
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
