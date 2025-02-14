import React, { useState, useEffect, useRef } from "react";
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
import { useToast } from "../../hooks/use-toast";
import { Badge } from "../ui/badge";
import { cn } from "../../lib/utils";
import { useNavigate } from "react-router-dom";
import {
  Eye,
  Plus,
  Trash2,
  Info,
  Search,
  Edit2,
  X,
  CheckCircle,
  Loader2,
  AlertTriangle,
  XCircle,
  Download,
  Upload,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
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
import CategoryEditModal from "./CategoryEditModal";
import GenerateReportForm from "../Elements/ReportForm";
import { CircularProgress } from "../ui/circularprogress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog"; // Import shadcn/ui Dialog components
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { Checkbox } from "../ui/checkbox";

import PDFMarkerModal from "./PdfMarkerModal";
import { useLoading } from "../../contexts/LoadingContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { exportToExcel } from "../../components/exportToExcel";
import * as XLSX from "xlsx";

const RecentReportsComp = ({
  data = [],
  key,
  onReportGenerated,
  refreshFunction,
  caseId,
}) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isCategoryEditOpen, setIsCategoryEditOpen] = useState(false);
  const [isAddPdfModalOpen, setIsAddPdfModalOpen] = useState(false);
  const itemsPerPage = 10;
  const [currentCaseName, setCurrentCaseName] = useState("");
  const [currentCaseId, setCurrentCaseId] = useState("");
  const [recentReports, setRecentReports] = useState([]);
  const [failedDatasOfCurrentReport, setFailedDatasOfCurrentReport] = useState(
    []
  );
  const [selectedFailedFile, setSelectedFailedFile] = useState(null);
  const [isMarkerModalOpen, setIsMarkerModalOpen] = useState(false);
  const [pdfEditLoading, setPdfEditLoading] = useState(false);

  const [reportToDelete, setReportToDelete] = useState(null);
  const [showAnalsisButton, setShowAnalysisButton] = useState(false); // State to show Analysis button

  const [showRectifyButton, setShowRectifyButton] = useState(false); // State to show Rectify button
  const [failedStatements, setFailedStatements] = useState([]); // State to store failed statements
  const [dialogOpen, setDialogOpen] = useState(false); // State to control Dialog visibility
  const [isChecked, setIsChecked] = useState(false);
  const { setIsExcelLoading } = useLoading();
  const [filteredData, setFilteredData] = useState(data);
  const [uploadedChanges, setUploadedChanges] = useState([]);
  const [categoryUpdateModalOpen, setCategoryUpdateModalOpen] = useState(false);
  const fileInputRef = useRef(null);

  const handleSubmitEditPdf = async () => {
    setPdfEditLoading(true);
    const allRectified = failedDatasOfCurrentReport.every(
      (statement) => statement.resolved
    );

    if (allRectified) {
      // Call the API to update the statements
      const result = await window.electron.editPdf(
        failedDatasOfCurrentReport,
        currentCaseName
      );
      console.log("result", result);

      if (result.success && result.data.failedStatements.length === 0) {
        toast({
          title: "Success",
          description: "All statements have been rectified.",
          variant: "success",
          className: "bg-white text-black opacity-100 shadow-lg",
        });
        setPdfEditLoading(false);
      } else {
        // If the rectification failed, show error message and reasons
        const unrectifiedStatements = failedDatasOfCurrentReport.filter(
          (statement) => statement.respectiveReasonsForError
        );

        toast({
          title: "Rectification Failed",
          description: (
            <div>
              <p className="mb-2">
                Some statements could not be rectified. Please contact sales for
                assistance.
              </p>
              <ul className="list-disc pl-4">
                {unrectifiedStatements.map((statement, index) => (
                  <li key={index} className="text-sm">
                    {statement.pdfName}: {statement.respectiveReasonsForError}
                  </li>
                ))}
              </ul>
            </div>
          ),
          variant: "destructive",
          duration: 6000,
        });
      }
    } else {
      toast({
        title: "Contact Sales",
        description:
          "Unable to rectify all statements. Please contact our sales team for assistance.",
        variant: "destructive",
        duration: 5000,
      });
    }
    setPdfEditLoading(false);
  };

  const handleRectify = () => {
    setDialogOpen(false);
    console.log("Rectify clicked ", currentCaseId, currentCaseName);
  };

  const viewAnalysis = () => {
    console.log("View Analysis clicked - ", currentCaseId);
    navigate(`/case-dashboard/${currentCaseId}/defaultTab`);
  };

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const result = await window.electron.getRecentReports();
        console.log({ recentReports: result });
        const formattedReports = result
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .map((report) => ({
            ...report,
            createdAt: new Date(report.createdAt).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            }),
            statements: report.statements.map((statement) => ({
              ...statement,
              createdAt: new Date(statement.createdAt).toLocaleDateString(
                "en-GB",
                {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                }
              ),
            })),
          }));

        setRecentReports(formattedReports);
      } catch (error) {
        toast({
          title: "Error",
          description: `Failed to load reports: ${error.message}`,
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    console.log({ setShowRectifyButton, setFailedStatements, setDialogOpen });

    fetchReports();
  }, []);

  // Filter reports based on search query
  const filteredReports = recentReports.filter(
    (report) =>
      report.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.ceil(filteredReports.length / itemsPerPage);
  const currentReports = filteredReports.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pageNumbers = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      // Show all pages if total pages are less than or equal to maxVisiblePages
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      // Always show first page
      pageNumbers.push(1);

      // Show current page and surrounding pages
      if (currentPage > 2) {
        pageNumbers.push("ellipsis");
      }

      if (currentPage !== 1 && currentPage !== totalPages) {
        pageNumbers.push(currentPage);
      }

      if (currentPage < totalPages - 1) {
        pageNumbers.push("ellipsis");
      }

      // Always show last page
      pageNumbers.push(totalPages);
    }

    return pageNumbers;
  };

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const StatusBadge = ({ status }) => {
    const variants = {
      Success:
        "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
      "In Progress":
        "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
      Failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
    };

    return (
      <Badge
        variant="outline"
        className={cn("px-2.5 py-0.5 text-xs font-semibold", variants[status])}
      >
        {status}
      </Badge>
    );
  };

  // const handleAddReport = () => {
  //     console.log('Clicked on add report');
  // };

  const handleDeleteReport = async (reportId) => {
    try {
      await window.electron.deleteReport(reportId);
      setRecentReports((prev) =>
        prev.filter((report) => report.id !== reportId)
      );

      toast({
        title: "Success",
        description: "Report deleted successfully.",
        variant: "success",
        className: "bg-white text-black opacity-100 shadow-lg",
      });
      setIsChecked(false);
    } catch (error) {
      console.error("Error deleting report:", error);
      toast({
        title: "Error",
        description: `Failed to delete the report: ${
          error.message || "Unknown error"
        }`,
        variant: "destructive",
      });
    }
  };

  const handleView = (caseId) => {
    console.log("clicked handle view for caseId - ", caseId);
    setIsLoading(true);
    navigate(`/case-dashboard/${caseId}/defaultTab`);
    setIsLoading(false);
  };

  // const handleAddPdfSubmit = async (
  //   setProgress,
  //   setLoading,
  //   setToastId,
  //   selectedFiles,
  //   fileDetails,
  //   setSelectedFiles,
  //   setFileDetails,
  //   toast,
  //   progressIntervalRef,
  //   simulateProgress,
  //   convertDateFormat,
  //   caseName
  // ) => {

  //   if (caseName === "") {
  //     toast({
  //       title: "Error",
  //       description: "Please enter a Case Name",
  //       variant: "destructive",
  //       duration: 3000,
  //     });
  //     return;
  //   }

  //   if (selectedFiles.length === 0) {
  //     toast({
  //       title: "Error",
  //       description: "Please select at least one file",
  //       variant: "destructive",
  //       duration: 3000,
  //     });
  //     return;
  //   }
  //   setLoading(true);
  //   const newToastId = toast({
  //     title: "Initializing Report Generation",
  //     description: (
  //       <div className="mt-2 w-full flex items-center gap-2">
  //         <div className="flex items-center gap-4">
  //           <CircularProgress className="w-full" />
  //           {/* <CircularProgress value={0} className="w-full" /> */}
  //           {/* <span className="text-sm font-medium">0%</span> */}
  //         </div>
  //         <p className="text-sm text-gray-500">Preparing to process files...</p>
  //       </div>
  //     ),
  //     duration: Infinity,
  //   });
  //   setToastId(newToastId);

  //   progressIntervalRef.current = simulateProgress();

  //   try {
  //     const filesWithContent = await Promise.all(
  //       selectedFiles.map(async (file, index) => {
  //         const fileContent = await new Promise((resolve, reject) => {
  //           const reader = new FileReader();
  //           reader.onload = () => resolve(reader.result);
  //           reader.onerror = reject;
  //           reader.readAsBinaryString(file);
  //         });

  //         const detail = fileDetails[index];

  //         return {
  //           fileContent,
  //           pdf_paths: file.name,
  //           bankName: detail.bankName,
  //           passwords: detail.password || "",
  //           start_date: convertDateFormat(detail.start_date), // Convert date format
  //           end_date: convertDateFormat(detail.end_date), // Convert date format
  //           ca_id: "test",
  //         };
  //       })
  //     );

  //     const result = await window.electron.addPdfIpc(
  //       {
  //         files: filesWithContent,
  //       },
  //       currentCaseId
  //     );

  //     if (result.success) {
  //       clearInterval(progressIntervalRef.current);
  //       setProgress(100);
  //       toast.dismiss(newToastId);
  //       toast({
  //         title: "Success",
  //         description: "Report generated successfully!",
  //         duration: 3000,
  //       });

  //       // const newCaseId = generateNewCaseId();
  //       // setCaseId(newCaseId);

  //       setSelectedFiles([]);
  //       setFileDetails([]);
  //       setIsAddPdfModalOpen(false);
  //     } else {
  //       throw new Error(result.error);
  //     }
  //   } catch (error) {
  //     console.error("Report generation failed:", error);
  //     clearInterval(progressIntervalRef.current);
  //     toast.dismiss(newToastId);
  //     setProgress(0);
  //     toast({
  //       title: "Error",
  //       description: error.message || "Failed to generate report",
  //       variant: "destructive",
  //       duration: 5000,
  //     });
  //   } finally {
  //     setLoading(false);
  //     progressIntervalRef.current = null;
  //   }
  // };

  const handleAddPdfSubmit = async (
    setProgress,
    setLoading,
    setToastId,
    selectedFiles,
    fileDetails,
    setSelectedFiles,
    setFileDetails,
    toast,
    progressIntervalRef,
    simulateProgress,
    convertDateFormat,
    caseName
  ) => {
    if (caseName === "") {
      toast({
        title: "Alert",
        description: "Please enter a Case Name",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }
    setCurrentCaseName(caseName);

    if (selectedFiles.length === 0) {
      toast({
        title: "Alert",
        description: "Please select at least one file",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    setLoading(true);
    const newToastId = toast({
      title: "Initializing Report Generation",
      description: (
        <div className="mt-2 w-full flex items-center gap-2">
          <div className="flex items-center gap-4">
            <CircularProgress className="w-full" />
          </div>
          <p className="text-sm text-gray-500">Preparing to process files...</p>
        </div>
      ),
      duration: Infinity,
    });
    setToastId(newToastId);

    progressIntervalRef.current = simulateProgress();

    try {
      const filesWithContent = await Promise.all(
        selectedFiles.map(async (file, index) => {
          const fileContent = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsBinaryString(file);
          });

          const detail = fileDetails[index];

          return {
            fileContent,
            pdf_paths: file.name,
            bankName: detail.bankName,
            passwords: detail.password || "",
            start_date: convertDateFormat(detail.start_date), // Convert date format
            end_date: convertDateFormat(detail.end_date), // Convert date format
            ca_id: currentCaseId,
          };
        })
      );

      console.log({ caseName, filesWithContent });

      console.log({ caseName, filesWithContent });

      const result = await window.electron.generateReportIpc(
        {
          files: filesWithContent,
        },
        caseName,
        "add-pdf"
      );

      console.log("Report generation result:", result.data);
      setCurrentCaseId(result.data.caseId); // Store caseId

      if (result.success) {
        clearInterval(progressIntervalRef.current);
        setProgress(100);
        toast.dismiss(newToastId);
        toast({
          title: "Success",
          description: "Report generated successfully!",
          duration: 3000,
          variant: "success",
        });

        console.log("Report generation result:", result.data);
        if (result.data.failedFiles.length > 0) {
          setShowRectifyButton(true);
          const failedFiles = result.data.failedFiles.map((file_path) => {
            return file_path.split("\\").pop();
          });
          setFailedStatements(failedFiles || []); // Store failed
        }

        if (result.data.totalTransactions) setShowAnalysisButton(true);

        // setFailedStatements(result.pdf_paths_not_extracted || []); // Store failed

        setDialogOpen(true); // Open the Dialog

        setSelectedFiles([]);
        setFileDetails([]);

        // Trigger a page refresh
      } else {
        const errorMessage = result.error
          ? typeof result.error === "object"
            ? JSON.stringify(result.error, null, 2)
            : result.error
          : "Unknown error occurred";

        throw new Error(errorMessage);
      }
    } catch (error) {
      console.log("Report generation failed:", { error: error.stack });

      if (typeof error === "object" && error !== null) {
        console.error("Detailed error:", JSON.stringify(error, null, 2));
      }

      if (error && error.message) {
        console.error("Error message:", error.message);
      }

      if (error && error.stack) {
        console.error("Error stack trace:", error.stack);
      }

      clearInterval(progressIntervalRef.current);
      toast.dismiss(newToastId);
      setProgress(0);
      if (showAnalsisButton || showRectifyButton) {
        setDialogOpen(true);
      }
      toast({
        title: "Error",
        description: showRectifyButton
          ? "Some Statement/s failed, please check rectify them."
          : "Failed to add report",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setLoading(false);
      progressIntervalRef.current = null;
      setIsAddPdfModalOpen(false);
    }
  };
  const toggleEdit = (id) => {
    setIsCategoryEditOpen(!isCategoryEditOpen);
    setCurrentCaseId(id);
  };
  const handleAddReport = (caseName, caseID) => {
    setCurrentCaseName(caseName);
    setCurrentCaseId(caseID);
    setIsAddPdfModalOpen(true);
  };

  const closeModal = () => {
    setIsAddPdfModalOpen(false);
  };

  const handleSaveMarkerData = (data) => {
    // Handle saving marker data here
    console.log("recent reports failed pdf handleSave data:", data);
    setIsMarkerModalOpen(false);
  };
  // Function to handle opening the modal and fetching the failed statements
  const handleDetails = async (reportId, reportName) => {
    setIsLoading(true);
    setCurrentCaseName(reportName);

    console.log("Opening rectify modal for caseId:", reportId, reportName);

    try {
      const failedStatements = await window.electron.getFailedStatements(
        reportId
      );

      console.log("Raw failedStatements from DB:", failedStatements);

      if (!Array.isArray(failedStatements) || failedStatements.length === 0) {
        console.warn("No failed statements found for this report.");
        setFailedDatasOfCurrentReport([]); // Ensure UI doesn't break
        return;
      }

      // Process failed statements with extensive error checking
      const processedFailedData = failedStatements
        .map((item) => {
          if (!item || !item.data) {
            console.warn("Skipping invalid failed statement record:", item);
            return null;
          }

          try {
            const parsedData = JSON.parse(item.data);
            // console.log("Parsed failed statement data:", parsedData);
            if (parsedData.paths.length === 0) return null;

            return {
              ...item,
              parsedContent: {
                paths: Array.isArray(parsedData.paths) ? parsedData.paths : [],
                passwords: Array.isArray(parsedData.passwords)
                  ? parsedData.passwords
                  : [],
                startDates: Array.isArray(parsedData.start_dates)
                  ? parsedData.start_dates
                  : [],
                endDates: Array.isArray(parsedData.end_dates)
                  ? parsedData.end_dates
                  : [],
                bankNames: Array.isArray(parsedData.bank_names)
                  ? parsedData.bank_names
                  : [],
                columns: Array.isArray(parsedData.respective_list_of_columns)
                  ? parsedData.respective_list_of_columns
                  : [],
                respectiveReasonsForError: Array.isArray(
                  parsedData.respective_reasons_for_error
                )
                  ? parsedData.respective_reasons_for_error
                  : [],
              },
            };
          } catch (parseError) {
            console.error("Failed to parse failed statement JSON:", parseError);
            return null;
          }
        })
        .filter((item) => item !== null); // Remove invalid entries

      if (processedFailedData.length === 0) {
        console.warn("No valid failed statement data found after processing.");
        setFailedDatasOfCurrentReport([]);
        return;
      }

      // Extract first valid failed statement (assuming one caseId per report)
      const firstFailedEntry = processedFailedData[0];
      console.log({ processedFailedData, firstFailedEntry });
      if (!firstFailedEntry?.parsedContent?.paths?.length) {
        console.warn("No valid failed PDF paths found.");
        setFailedDatasOfCurrentReport([]);
        return;
      }

      const tempFailedDataOfReport = firstFailedEntry.parsedContent.paths.map(
        (pdfPath, index) => ({
          caseId: firstFailedEntry.caseId,
          id: firstFailedEntry.id,
          columns: firstFailedEntry.parsedContent.columns[index] || "",
          endDate: firstFailedEntry.parsedContent.endDates[index] || "",
          bankName: firstFailedEntry.parsedContent.bankNames[index] || "",
          startDate: firstFailedEntry.parsedContent.startDates[index] || "",
          path: pdfPath,
          password: firstFailedEntry.parsedContent.passwords[index] || "",
          resolved: false,
          pdfName: pdfPath.split("\\").pop(),
          respectiveReasonsForError:
            firstFailedEntry.parsedContent.respectiveReasonsForError?.[index] ||
            "",
        })
      );

      console.log("Processed failed data for UI:", tempFailedDataOfReport);

      // Remove duplicate entries using pdfName
      const uniqueFailedDataOfReport = tempFailedDataOfReport.filter(
        (item, index, self) =>
          index === self.findIndex((t) => t.pdfName === item.pdfName)
      );

      setFailedDatasOfCurrentReport(uniqueFailedDataOfReport);
    } catch (error) {
      console.error("Error fetching failed statements:", error);

      toast({
        title: "Error",
        description: `Failed to load details: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  const getMonthKey = (dateString) => {
    const date = new Date(dateString);
    return `${date.toLocaleString("en-GB", {
      month: "short",
    })}-${date.getFullYear()}`;
  };

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
    "Suspense",
  ];
  const handleDownload = async (
    caseid,
    status,
    source = "report",
    data = [],
    title = "Report",
    customerName = "Unknown",
    categoryOptions = categoryOptionsfixed
  ) => {
    if (status === "Pending") {
      toast({
        title: "Cannot Download",
        description:
          "Report is still being processed. Please wait until it's complete.",
        variant: "warning",
        duration: 3000,
      });
      return;
    }

    const reportName = customerName ? `${customerName}_${caseid}` : caseid;
    let file_created = false;

    try {
      setIsExcelLoading(true);

      // Handle suspense transactions
      if (source === "suspense") {
        let transactionsData = data;

        if (!data || data.length === 0) {
          const fetchedSuspenseTransactions =
            await window.electron.getTransactionsBySuspense(caseid);

          if (
            !fetchedSuspenseTransactions ||
            fetchedSuspenseTransactions.length === 0
          ) {
            throw new Error("No suspense transactions available for download.");
          }

          transactionsData = fetchedSuspenseTransactions;
        }

        // Process the data and export directly for suspense
        const processedData = processData(transactionsData);
        const fileName = `${reportName}_suspense.xlsx`;

        await exportToExcel(
          processedData,
          fileName,
          false,
          categoryOptionsfixed
        );

        toast({
          title: "Success",
          description: `Suspense Excel file "${fileName}" downloaded successfully.`,
        });

        setIsExcelLoading(false);
        return;
      }

      // Handle regular report downloads using electron system
      console.log("Starting report download...");
      const processedData = processData(data);

      // Initiate electron download
      window.electron.download.excelReportDownload(caseid);

      let downloadedChunks = [];
      let downloadProgress = 0;

      // Handle download chunks
      window.electron.download.onExcelDownloadChunk((chunk) => {
        if (chunk) {
          downloadedChunks.push(new Uint8Array(chunk));
          downloadProgress += chunk.length;
          console.log(`Downloaded ${downloadProgress} bytes`);
        }
      });

      // Handle download completion
      window.electron.download.onExcelDownloadComplete((res) => {
        if (!file_created) {
          file_created = true;
          const { message, fileName = `${reportName}.xlsx` } = res;
          console.log("Download completed:", message);

          if (downloadedChunks.length === 0) {
            toast({
              title: "Error",
              description: "No data received for the Excel file.",
              variant: "destructive",
            });
            return;
          }

          // Merge downloaded chunks
          const mergedChunks = downloadedChunks.reduce((acc, chunk) => {
            const temp = new Uint8Array(acc.length + chunk.length);
            temp.set(acc, 0);
            temp.set(chunk, acc.length);
            return temp;
          }, new Uint8Array());

          // Create and download the file
          const fileBlob = new Blob([mergedChunks], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          });

          const url = window.URL.createObjectURL(fileBlob);
          const link = document.createElement("a");
          link.href = url;
          link.download = fileName;
          link.click();
          window.URL.revokeObjectURL(url);

          toast({
            title: "Success",
            description: `Excel file "${fileName}" downloaded successfully.`,
          });
        }
        setIsExcelLoading(false);
      });

      // Handle download errors
      window.electron.download.onExcelDownloadError((error) => {
        console.error("Error downloading file:", error);
        setIsExcelLoading(false);
        toast({
          title: "Error",
          description: `Failed to download Excel file: ${error}`,
          variant: "destructive",
        });
      });
    } catch (error) {
      console.error("Download error:", error);
      setIsExcelLoading(false);
      toast({
        title: "Error",
        description: `Failed to download: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  // Enhanced processData function with better data validation
  const processData = (transactions) => {
    return transactions.map((transaction) => {
      const date = new Date(transaction.date);
      return {
        date: formatDate(date),
        description: transaction.description || "",
        credit:
          transaction.type?.toLowerCase() === "credit"
            ? Number(transaction.amount) || 0
            : 0,
        debit:
          transaction.type?.toLowerCase() === "debit"
            ? Number(transaction.amount) || 0
            : 0,
        balance: Number(transaction.balance) || 0,
        category: transaction.category || "",
        id: transaction.id,
        monthKey: getMonthKey(transaction.date),
      };
    });
  };

  // Helper function to ensure dates are properly formatted
  const formatDate = (date) => {
    if (!(date instanceof Date) || isNaN(date)) {
      return "";
    }
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const handleExcelFileUpload = async (event) => {
    if (
      !event.target ||
      !event.target.files ||
      event.target.files.length === 0
    ) {
      console.error("No file selected.");
      return;
    }

    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      if (!sheet) {
        console.error("No sheet found in the uploaded file.");
        return;
      }

      const parsedData = XLSX.utils.sheet_to_json(sheet);

      console.log("Uploaded Suspense Data: ", parsedData);

      const updates = parsedData
        .map((row) => {
          const existingTransaction = filteredData.find(
            (tx) => tx.id === row.Id
          );
          if (!existingTransaction) return null;
          if (existingTransaction.category === row.Category) return null;

          return {
            date: row.Date,
            credit: row.Credit,
            debit: row.Debit,
            description: row.Description,
            id: row.Id,
            oldCategory: existingTransaction.category,
            newCategory: row.Category,
          };
        })
        .filter(Boolean);

      setUploadedChanges(updates);
      setCategoryUpdateModalOpen(true);
    };

    reader.readAsArrayBuffer(file);
  };

  return (
    <Card>
      <PDFMarkerModal
        isOpen={isMarkerModalOpen}
        onClose={() => setIsMarkerModalOpen(false)}
        // onSave={handleSaveMarkerData}
        selectedFailedFile={selectedFailedFile}
        setFailedDatasOfCurrentReport={setFailedDatasOfCurrentReport}
      />
      <CategoryEditModal
        open={isCategoryEditOpen}
        onOpenChange={toggleEdit}
        caseId={currentCaseId}
      />

      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Recent Reports</CardTitle>
            <CardDescription className="py-3">
              A list of recent reports from all projects
            </CardDescription>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search reports..."
              className="pl-10 w-[400px]"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {recentReports.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow className="align-">
                <TableHead>Date</TableHead>
                <TableHead>Report Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
                <TableHead>Details</TableHead>
                {/* <TableHead>Details</TableHead> */}
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentReports.map((report, index) => (
                <TableRow key={report.id}>
                  <TooltipProvider delayDuration={800}>
                    {" "}
                    {/* Reduces delay to 100ms */}
                    <TableCell>{report.createdAt}</TableCell>
                    <TableCell>{report.name}</TableCell>
                    <TableCell>
                      <StatusBadge status={report.status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleView(report.id)}
                              className="h-8 w-8"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>View Report</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() =>
                                handleAddReport(report.name, report.id)
                              }
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Add Statements</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => toggleEdit(report.id)}
                              className="h-8 w-8"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit Categories</TooltipContent>
                        </Tooltip>

                        <AlertDialog>
                          <Tooltip key={report.id}>
                            <TooltipTrigger asChild>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => setReportToDelete(report.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                            </TooltipTrigger>
                            <TooltipContent>Delete Report</TooltipContent>
                          </Tooltip>
                          <AlertDialogContent className="bg-white dark:bg-slate-950">
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Report</AlertDialogTitle>
                            </AlertDialogHeader>
                            <div className="py-4 flex gap-3 items-center">
                              <Checkbox
                                checked={isChecked}
                                onCheckedChange={(checked) =>
                                  setIsChecked(checked)
                                }
                                className="mb-5"
                              ></Checkbox>
                              Are you sure you want to delete this report? This
                              action cannot be undone.
                            </div>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <Button
                                variant="destructive"
                                onClick={() => {
                                  handleDeleteReport(report.id);
                                  setReportToDelete(null);
                                }}
                                disabled={!isChecked}
                              >
                                Delete
                              </Button>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        {/* #Download Button */}
                        <Tooltip>
                          <DropdownMenu>
                            <TooltipTrigger asChild>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className={cn(
                                    "h-8 w-8",
                                    report.status === "In Progress" &&
                                      "opacity-50 cursor-not-allowed"
                                  )}
                                  disabled={report.status === "In Progress"}
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                            </TooltipTrigger>
                            <TooltipContent>Download</TooltipContent>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                className="cursor-pointer"
                                onClick={() =>
                                  handleDownload(report.id, report.status)
                                }
                              >
                                Download Report
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="cursor-pointer"
                                onClick={() =>
                                  handleDownload(
                                    report.id, // case ID
                                    report.status, // Status
                                    "suspense", // Source (suspense)
                                    report.suspense || [], // Suspense data (if available)
                                    "Suspense Report",
                                    report.name || "Unknown",
                                    report.categoryOptions || []
                                  )
                                }
                              >
                                Download Suspense
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </Tooltip>
                        {/* #Download Button */}

                        {/* Upload Button */}
                        <Tooltip>
                          <DropdownMenu>
                            <TooltipTrigger asChild>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className={cn(
                                    "h-8 w-8",
                                    report.status === "In Progress" &&
                                      "opacity-50 cursor-not-allowed"
                                  )}
                                  disabled={report.status === "In Progress"}
                                >
                                  <Upload className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                            </TooltipTrigger>
                            <TooltipContent>Upload</TooltipContent>

                            {/* Move input outside DropdownMenu but keep it hidden */}
                            <input
                              type="file"
                              accept=".xlsx, .xls"
                              style={{ display: "none" }}
                              ref={fileInputRef}
                              onChange={handleExcelFileUpload}
                            />

                            {/* Dropdown Content must wrap DropdownMenuItem */}
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                className="cursor-pointer"
                                onClick={() => fileInputRef.current.click()} // Trigger file input
                              >
                                Upload Suspense
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </Tooltip>

                        {/* Upload Button */}
                      </div>
                    </TableCell>
                    <TableCell>
                      <AlertDialog>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-black/5"
                                onClick={() =>
                                  handleDetails(report.id, report.name)
                                }
                              >
                                <Info className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                          </TooltipTrigger>
                          <TooltipContent>
                            View Failed Statements
                          </TooltipContent>
                        </Tooltip>
                        <AlertDialogContent className="max-w-2xl bg-white shadow-lg border-0 dark:bg-slate-950">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-xl font-medium text-black bg-black/[0.03] -mx-6 -mt-6 p-4 border-b border-black/10 dark:bg-slate-900 dark:text-slate-300">
                              Report Details
                            </AlertDialogTitle>
                          </AlertDialogHeader>
                          <div className="p-6 overflow-auto max-h-[400px]">
                            {failedDatasOfCurrentReport &&
                            failedDatasOfCurrentReport.length > 0 ? (
                              <div>
                                {[...failedDatasOfCurrentReport]
                                  .sort((a, b) => {
                                    const aHasError = Boolean(
                                      a.respectiveReasonsForError
                                    );
                                    const bHasError = Boolean(
                                      b.respectiveReasonsForError
                                    );
                                    return aHasError === bHasError
                                      ? 0
                                      : aHasError
                                      ? 1
                                      : -1;
                                  })
                                  .map((statement, index) => {
                                    const isDone = statement.resolved;
                                    const hasError = Boolean(
                                      statement.respectiveReasonsForError
                                    );

                                    return (
                                      <div
                                        key={index}
                                        className="mb-4 border-b pb-4"
                                      >
                                        <h3 className="font-semibold mb-2">
                                          Failed Statement {index + 1}
                                        </h3>
                                        <div className="flex gap-2 items-center">
                                          <p className="flex-[4.5]">
                                            <strong>File Name:</strong>{" "}
                                            {statement.pdfName}
                                          </p>
                                          {/* Only show button if there's no error and the statement isn't done */}
                                          {!hasError && (
                                            <>
                                              {isDone ? (
                                                <Button
                                                  size="sm"
                                                  disabled
                                                  className="flex-1 bg-green-600 hover:bg-green-700 text-white transition-colors"
                                                >
                                                  <CheckCircle className="w-4 h-4 mr-2" />
                                                  Done
                                                </Button>
                                              ) : (
                                                <Button
                                                  variant="secondary"
                                                  size="sm"
                                                  disabled={
                                                    report.status === "Success"
                                                  }
                                                  className={`${
                                                    report.status === "Success"
                                                      ? "bg-green-600 hover:bg-green-700 text-white"
                                                      : "flex-1 hover:bg-primary hover:text-primary-foreground transition-colors"
                                                  }`}
                                                  onClick={() => {
                                                    setIsMarkerModalOpen(true);
                                                    setSelectedFailedFile(
                                                      statement
                                                    );
                                                  }}
                                                >
                                                  {report.status ===
                                                  "Success" ? (
                                                    <CheckCircle className="w-4 h-4 mr-2" />
                                                  ) : (
                                                    ""
                                                  )}
                                                  Rectify
                                                </Button>
                                              )}
                                            </>
                                          )}
                                        </div>
                                        {hasError && (
                                          <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md">
                                            <p className="text-red-600 text-sm">
                                              <strong>Error:</strong>{" "}
                                              {
                                                statement.respectiveReasonsForError
                                              }
                                            </p>
                                            {
                                              <p className="text-red-500 text-xs mt-1">
                                                {statement.respectiveReasonsForError
                                                  .toLowerCase()
                                                  .includes(
                                                    "start and end date"
                                                  )
                                                  ? "Please Re-run this statement with correct dates."
                                                  : "Please contact sales for assistance with this issue."}
                                              </p>
                                            }
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                              </div>
                            ) : (
                              <div className="text-center text-green-600 font-semibold">
                                Report Processed Successfully
                              </div>
                            )}
                          </div>
                          <AlertDialogFooter className="border-t border-black/10 pt-6">
                            {/* create a submit button */}
                            {failedDatasOfCurrentReport &&
                              failedDatasOfCurrentReport.length > 0 && (
                                <div className="flex justify-center ">
                                  {report.status === "Success" ? (
                                    ""
                                  ) : (
                                    <Button
                                      type="submit"
                                      disabled={pdfEditLoading}
                                      onClick={handleSubmitEditPdf}
                                      className="relative inline-flex items-center px-4 py-2"
                                    >
                                      {pdfEditLoading ? (
                                        <>
                                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                          <span>Processing...</span>
                                        </>
                                      ) : (
                                        "Submit"
                                      )}
                                    </Button>
                                  )}
                                </div>
                              )}

                            <AlertDialogCancel className="px-8 bg-black text-white hover:bg-black/90 hover:text-white dark:bg-white dark:text-black">
                              Close
                            </AlertDialogCancel>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TooltipProvider>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center text-grey-600 opacity-70 font-semibold">
            No Reports Found
          </div>
        )}
        {totalPages > 1 && (
          <div className="mt-6">
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
        )}
      </CardContent>
      {/* Modal for GenerateReportForm & its changes */}
      {isAddPdfModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-5xl w-full p-6">
            <header className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">
                Add Additional Statements
              </h2>
              <button
                onClick={closeModal}
                className="text-2xl text-gray-500 hover:text-gray-700"
              >
                <X />
              </button>
            </header>
            <div className="mt-4">
              <GenerateReportForm
                currentCaseName={currentCaseName}
                handleReportSubmit={handleAddPdfSubmit}
              />
            </div>
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report Generated Successfully!</DialogTitle>
            <DialogDescription className="flex items-end gap-x-4 pt-4 ">
              {console.log(
                "failedStatements from alert box ",
                failedStatements
              )}
              {failedStatements.length === 0 ? (
                <div className="flex items-center gap-x-4">
                  <CheckCircle className="text-green-500 w-6 h-6 mt-2" />
                  <p>Your report has been generated successfully.</p>
                </div>
              ) : failedStatements.length > 0 ? (
                <div className="flex items-end gap-x-4">
                  <AlertTriangle className="text-yellow-500 w-6 h-6 mt-2" />
                  <p>Below Statements had some errors.</p>
                </div>
              ) : (
                <XCircle className="text-red-500 w-6 h-6 mt-2" />
              )}
            </DialogDescription>
          </DialogHeader>
          {failedStatements.length > 0 && (
            <div className="mb-4">
              <ul className="list-disc pl-5">
                {failedStatements.map((statement, index) => (
                  <li key={index}>{statement}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex gap-4">
            {showAnalsisButton && (
              <Button onClick={() => viewAnalysis()} className="flex-1">
                View Analysis
              </Button>
            )}

            {showRectifyButton && (
              <Button onClick={handleRectify} className="flex-1">
                Rectify Now
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default RecentReportsComp;