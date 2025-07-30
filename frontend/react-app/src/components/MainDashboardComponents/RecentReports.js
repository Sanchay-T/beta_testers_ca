import React, { useState, useEffect, useRef, useMemo } from "react";
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
import { useNavigate, useParams } from "react-router-dom";
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
  RotateCw,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  AlertDialogAction,
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
  DialogFooter,
} from "../ui/dialog"; // Import shadcn/ui Dialog components
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { Checkbox } from "../ui/checkbox";
import { useReportContext } from "../../contexts/ReportContext";
import PDFMarkerModal from "./PdfMarkerModal";
import { useLoading } from "../../contexts/LoadingContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { exportToExcel } from "../exportToExcel";
import * as XLSX from "xlsx";
import { generateFinancialReport } from "../ReportExcel";

const RecentReportsComp = ({ key, onReportGenerated }) => {
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
  const { reportData, updateReportData } = useReportContext();
  const fileInputRef = useRef(null);
  const [uploadedChanges, setUploadedChanges] = useState({});
  const [categoryUpdateModalOpen, setCategoryUpdateModalOpen] = useState(false);
  const [isRectifyAlertOpen, setIsRectifyAlertOpen] = useState(false);
  const [isHandleDetailsDialogOpen, setIsHandleDetailsDialogOpen] =
    useState(null);
  const { individualId } = useParams();
  const [warning, setWarning] = useState([]);
  const [missingMonthsList, setMissingMonthsList] = useState([]);
  const [successfulStatements, setSuccessfulStatements] = useState([]);
  const [dateRangeWarning, setDateRangeWarning] = useState(null);
  const [warningExpanded, setWarningExpanded] = useState(false);

  const hasScannedOrEncodedWarning = useMemo(() => {
    if (!Array.isArray(warning)) return false;

    return warning.some((msg) =>
      /image-only|scanned|non-text|encoded/i.test(msg)
    );
  }, [warning]);

  // extract balance-mismatch errors
  const balanceMismatchErrors = warning.filter((msg) =>
    msg.startsWith("Balance mismatch")
  );

  // everything else stays “red”
  const otherErrors = warning.filter(
    (msg) => !msg.startsWith("Balance mismatch")
  );

  const handleSubmitEditPdf = async () => {
    setPdfEditLoading(true);
    setFailedStatements([]);
    setSuccessfulStatements([]);
    const allRectified = failedDatasOfCurrentReport.every(
      (statement) => statement.resolved
    );

    // ✅ collect just the statements the user has fixed
    const statementsToRectify = failedDatasOfCurrentReport.filter(
      (s) => s.resolved
    );

    if (statementsToRectify.length === 0) {
      toast({
        title: "Nothing to rectify",
        description: "Please mark at least one PDF as resolved first.",
        variant: "destructive",
      });
      return setPdfEditLoading(false);
    }

    try {
      if (true) {
        // Call the API only for the chosen PDFs
        let result = await window.electron.editPdf(
          statementsToRectify,
          currentCaseName
        );

        // try {
        //   if (true) {
        //     // Call the API to update the statements
        //     let result = await window.electron.editPdf(
        //       failedDatasOfCurrentReport,
        //       currentCaseName
        //     );

        console.log({ electronResponse: result });

        if (
          result.data.missingMonthsList &&
          result.data.missingMonthsList.length > 0
        ) {
          setMissingMonthsList(result.data.missingMonthsList);
        }

        if (result.data.warning && result.data.warning.length > 0) {
          const nonEmptyWarnings = result.data.warning.filter((warn) => {
            return warn && warn.trim() !== ""; // Return true for non-empty warnings
          });
          const uniqueWarningsSet = new Set(nonEmptyWarnings);

          setWarning([...uniqueWarningsSet]);
        }
        setCurrentCaseId(result.data.caseId); // Store caseId

        if (
          result.success &&
          result?.data?.failedStatements?.bank_names?.length === 0
        ) {
          // setShowRectifyButton(true);
          const successfulFiles = result.data.successfulFiles.map(
            (file_path) => {
              // Get the filename from the path and remove the timestamp
              const filename = file_path.split("\\").pop(); // Get filename from path
              const filenameWithoutTimestamp = filename.substring(
                filename.indexOf("-") + 1
              ); // Remove everything before first hyphen
              return filenameWithoutTimestamp;
            }
          );
          setSuccessfulStatements(successfulFiles || []); // Store successful

          toast({
            title: "Success",
            description: "All statements have been rectified.",
            variant: "success",
            className: "bg-white text-black opacity-100 shadow-lg",
          });
          setPdfEditLoading(false);

          const updatedRecentReportsData = reportData.recentReportsData.map(
            (report) => {
              if (report.id === result.data.caseId) {
                return {
                  ...report,
                  name: currentCaseName,
                  status: "Success",
                };
              }
              return report;
            }
          );
          updateReportData({
            ...reportData, // Preserve other reportData properties

            recentReportsData: updatedRecentReportsData,
          });
        } else {
          const failedFiles = result?.data?.failedFiles?.map((file_path) => {
            // Get the filename from the path and remove the timestamp
            const filename = file_path.split("\\").pop(); // Get filename from path
            const filenameWithoutTimestamp = filename.substring(
              filename.indexOf("-") + 1
            ); // Remove everything before first hyphen
            return filenameWithoutTimestamp;
          });
          setFailedStatements(failedFiles || []); // Store failed

          // setShowRectifyButton(true);
          const successfulFiles = result.data.successfulFiles.map(
            (file_path) => {
              // Get the filename from the path and remove the timestamp
              const filename = file_path.split("\\").pop(); // Get filename from path
              const filenameWithoutTimestamp = filename.substring(
                filename.indexOf("-") + 1
              ); // Remove everything before first hyphen
              return filenameWithoutTimestamp;
            }
          );
          setSuccessfulStatements(successfulFiles || []); // Store successful

          toast({
            title: "Rectification Failed",
            description: (
              <div>
                <p className="mb-2">
                  Some statements could not be rectified. Please contact sales
                  for assistance.
                </p>
                <p>{result.data.errorMessage}</p>

                {/* <ul className="list-disc pl-4">
                {unrectifiedStatements.map((statement, index) => (
                  <li key={index} className="text-sm">
                    {statement.pdfName}: {statement.respectiveReasonsForError}
                  </li>
                ))}
              </ul> */}
              </div>
            ),
            variant: "destructive",
            duration: 6000,
          });
        }
        if (result.data.totalTransactions) {
          setShowAnalysisButton(true);
        }
      } else {
        toast({
          title: "Error",
          description: "Unable to rectify all statements.",
          variant: "destructive",
          duration: 5000,
        });
      }
    } catch (error) {
      console.error("Error during rectification:", error);
      // toast({
      //   title: "Error",
      //   description: `Failed to rectify statements: ${error.message}`,
      //   variant: "destructive",
      // });
    } finally {
      setPdfEditLoading(false);
      setDialogOpen(true); // Open the Dialog
      localStorage.removeItem("dashboardData");
    }
  };

  const handleRectify = () => {
    setDialogOpen(false);
  };

  const viewAnalysis = () => {
    navigate(`/case-dashboard/${currentCaseId}/defaultTab`);
  };
  const fetchReports = async () => {
    setIsLoading(true);
    try {
      const result = await window.electron.getRecentReports();
      console.log({ reportsGotFromBackend: result });
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

      updateReportData({ recentReportsData: formattedReports });
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
  useEffect(() => {
    if (reportData.recentReportsData.length === 0) {
      fetchReports();
    }
  }, []);

  // Filter reports based on search query
  const filteredReports = reportData.recentReportsData.filter(
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
      Deleted: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
      Processing:
        "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
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

  const handleDeleteReport = async (reportId) => {
    try {
      await window.electron.deleteReport(reportId);

      // const updatedReports = reportData.recentReportsData.filter(
      //   (report) => report.id !== reportId
      // );
      // updateReportData({ recentReportsData: updatedReports });
      const updatedReports = reportData.recentReportsData.map((report) =>
        report.id === reportId
          ? { ...report, deleted: 1, status: "Deleted" }
          : report
      );
      updateReportData({
        ...reportData,
        recentReportsData: updatedReports,
      });
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
    } finally {
      localStorage.removeItem("dashboardData");
    }
  };

  const handleView = (caseId) => {
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
    setFailedStatements([]);
    setSuccessfulStatements([]);
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

      const result = await window.electron.generateReportIpc(
        {
          files: filesWithContent,
        },
        caseName,
        false,
        "add-pdf"
      );
      console.log({ electronResponse: result });

      if (
        result.data.missingMonthsList &&
        result.data.missingMonthsList.length > 0
      ) {
        setMissingMonthsList(result.data.missingMonthsList);
      }
      if (result.data.warning && result.data.warning.length > 0) {
        const formatted = result.data.warning.filter((w) => w && w.trim());

        // regex to find your date-overlap error
        const re =
          /The period for Bank:[^)]+\((\d{2}-\d{2}-\d{4}) to (\d{2}-\d{2}-\d{4})\)[^()]*\((\d{2}-\d{2}-\d{4}) to (\d{2}-\d{2}-\d{4})\)/;

        // split into dateErrors vs. rest
        let drWarn = null;
        const rest = formatted.filter((msg) => {
          const m = msg.match(re);
          if (m) {
            const [, fetchedStart, fetchedEnd, userStart, userEnd] = m;
            drWarn = { fetchedStart, fetchedEnd, userStart, userEnd };
            return false; // remove from “rest”
          }
          return true; // keep everything else
        });

        setDateRangeWarning(drWarn); // either an object or null
        setWarning(Array.from(new Set(rest))); // your existing red/amber logic
      }

      setCurrentCaseId(result.data.caseId); // Store caseId
      if (result.success) {
        // clearInterval(progressIntervalRef.current);
        // setProgress(100);
        // toast.dismiss(newToastId);
        console.log("Report generated successfully:", result.data);

        if (result.data.failedFiles.length > 0) {
          setShowRectifyButton(true);
          const failedFiles = result.data.failedFiles.map((file_path) => {
            // Get the filename from the path and remove the timestamp
            const filename = file_path.split("\\").pop(); // Get filename from path
            const filenameWithoutTimestamp = filename.substring(
              filename.indexOf("-") + 1
            ); // Remove everything before first hyphen
            return filenameWithoutTimestamp;
          });
          setFailedStatements(failedFiles || []); // Store failed

          // setShowRectifyButton(true);
          const successfulFiles = result.data.successfulFiles.map(
            (file_path) => {
              // Get the filename from the path and remove the timestamp
              const filename = file_path.split("\\").pop(); // Get filename from path
              const filenameWithoutTimestamp = filename.substring(
                filename.indexOf("-") + 1
              ); // Remove everything before first hyphen
              return filenameWithoutTimestamp;
            }
          );
          setSuccessfulStatements(successfulFiles || []); // Store successful

          toast({
            title: "Failed",
            description: `${caseName} report had some issues!`,
            duration: 3000,
            variant: "destructive",
          });
        } else {
          // setShowRectifyButton(true);
          const successfulFiles = result.data.successfulFiles.map(
            (file_path) => {
              // Get the filename from the path and remove the timestamp
              const filename = file_path.split("\\").pop(); // Get filename from path
              const filenameWithoutTimestamp = filename.substring(
                filename.indexOf("-") + 1
              ); // Remove everything before first hyphen
              return filenameWithoutTimestamp;
            }
          );
          setSuccessfulStatements(successfulFiles || []); // Store successful
        }

        if (result.data.totalTransactions) {
          toast({
            title: "Success",
            description: `${caseName} report generated successfully!`,
            duration: 3000,
            variant: "success",
          });
          setShowAnalysisButton(true);
        }

        // setFailedStatements(result.pdf_paths_not_extracted || []); // Store failed

        setDialogOpen(true); // Open the Dialog

        setSelectedFiles([]);
        setFileDetails([]);

        // Handle Scanned and encoded files
        console.log({ aiyaz: result.data.failedStatements });
        const failedStatementsFromBackend = result.data.failedStatements || [];
        console.log({ tyope: typeof failedStatementsFromBackend });

        const paths = failedStatementsFromBackend.paths || [];
        const reasons =
          failedStatementsFromBackend.respective_reasons_for_error || [];
        const bankNames = failedStatementsFromBackend.bank_names || [];
        const passwords = failedStatementsFromBackend.passwords || [];
        const startDates = failedStatementsFromBackend.start_dates || [];
        const endDates = failedStatementsFromBackend.end_dates || [];

        // Helper: Match OCR-triggering reasons
        const isOcrCandidate = (reason = "") => {
          const r = reason.toLowerCase();
          return (
            r.includes("image-only") ||
            r.includes("scanned") ||
            r.includes("non-text") ||
            r.includes("encoded")
          );
        };

        // ✅ Filter out null or undefined pdfs and match OCR-triggering reasons
        const eligibleIndexes = reasons
          .map((reason, idx) =>
            isOcrCandidate(reason) && paths[idx] ? idx : null
          )
          .filter((i) => i !== null);
        console.log({ eligibleIndexes });
        const scannedOCRFiles = eligibleIndexes.map((i) => ({
          bankName: bankNames[i],
          pdf_paths: paths[i],
          passwords: passwords[i],
          start_date: startDates[i],
          end_date: endDates[i],
          ca_id: result.data.caseId,
          is_ocr: true,
        }));

        // If any OCR-worthy files found
        if (eligibleIndexes.length > 0) {
          const newData = {
            id: result.data.caseId,
            name: caseName,
            userId: null,
            status: "Processing",
            pages: null,
            createdAt: new Date().toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            }),
            // statements: null,
          };

          updateReportData({
            recentReportsData: [newData, ...reportData.recentReportsData],
          });

          toast({
            id: newToastId,
            title: "Running OCR",
            description: (
              <div className="mt-2 w-full flex items-center gap-2">
                <div className="flex items-center gap-4">
                  <CircularProgress className="w-full" />
                </div>
                <p className="text-sm text-gray-500">
                  Processing scanned/encoded PDFs…
                </p>
              </div>
            ),
            variant: "default",
            duration: Infinity,
          });
          // toast({
          //   title: "OCR Triggered",
          //   description: `Detected scanned or encoded PDFs.`,
          //   variant: "default",
          //   duration: 5000,
          // });

          console.log({
            files: scannedOCRFiles,
            caseName,
            is_ocr: true,
            soure: "add-pdf",
          });
          try {
            const ocrResult = await window.electron.generateReportIpc(
              { files: scannedOCRFiles },
              caseName,
              "add-pdf"
            );

            setFailedStatements([]);
            setSuccessfulStatements([]);
            setShowRectifyButton(false);
            setShowAnalysisButton(false);
            setMissingMonthsList([]);
            setWarning([]);

            console.log("OCR Result:", ocrResult);

            if (
              ocrResult.data.missingMonthsList &&
              ocrResult.data.missingMonthsList.length > 0
            ) {
              setMissingMonthsList(ocrResult.data.missingMonthsList);
            }

            if (ocrResult.data.warning && ocrResult.data.warning.length > 0) {
              const formattedWarnings = ocrResult.data.warning.filter(
                (warn) => {
                  return warn && warn.trim() !== ""; // Return true for non-empty warnings
                }
              );

              const uniqueWarnings = Array.from(new Set(formattedWarnings)); // Remove duplicates
              setWarning(uniqueWarnings);
            }

            // setCurrentCaseId(ocrResult.data.caseId); // Store caseId
            console.log({ ocrResult });
            if (ocrResult.success) {
              setDialogOpen(true); // Open the Dialog
              toast.dismiss(newToastId);

              console.log("ocrResult generated successfully:", ocrResult.data);
              if (ocrResult.data.failedFiles.length > 0) {
                setShowRectifyButton(true);
                const failedFiles = ocrResult.data.failedFiles.map(
                  (file_path) => {
                    // Get the filename from the path and remove the timestamp
                    const filename = file_path.split("\\").pop(); // Get filename from path
                    const filenameWithoutTimestamp = filename.substring(
                      filename.indexOf("-") + 1
                    ); // Remove everything before first hyphen
                    return filenameWithoutTimestamp;
                  }
                );
                setFailedStatements(failedFiles || []); // Store failed

                const newData = {
                  id: ocrResult.data.caseId,
                  name: caseName,
                  userId: null,
                  status: "Failed",
                  pages: null,
                  createdAt: new Date().toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  }),
                  statements: null,
                };

                // setShowRectifyButton(true);
                const successfulFiles = ocrResult.data.successfulFiles.map(
                  (file_path) => {
                    // Get the filename from the path and remove the timestamp
                    const filename = file_path.split("\\").pop(); // Get filename from path
                    const filenameWithoutTimestamp = filename.substring(
                      filename.indexOf("-") + 1
                    ); // Remove everything before first hyphen
                    return filenameWithoutTimestamp;
                  }
                );
                setSuccessfulStatements(successfulFiles || []); // Store successful

                updateReportData({
                  recentReportsData: [newData, ...reportData.recentReportsData],
                });
              } else {
                // setShowRectifyButton(true);
                const successfulFiles = ocrResult.data.successfulFiles.map(
                  (file_path) => {
                    // Get the filename from the path and remove the timestamp
                    const filename = file_path.split("\\").pop(); // Get filename from path
                    const filenameWithoutTimestamp = filename.substring(
                      filename.indexOf("-") + 1
                    ); // Remove everything before first hyphen
                    return filenameWithoutTimestamp;
                  }
                );
                setSuccessfulStatements(successfulFiles || []); // Store successful

                const newData = {
                  id: ocrResult.data.caseId,
                  name: caseName,
                  userId: null,
                  status: "Success",
                  pages: null,
                  createdAt: new Date().toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  }),
                  // statements: null,
                };

                updateReportData({
                  recentReportsData: [newData, ...reportData.recentReportsData],
                });
              }

              if (ocrResult.data.totalTransactions) {
                toast({
                  title: "Success",
                  description: `${caseName} report generated successfully!`,
                  duration: Infinity,
                  variant: "success",
                });
              }

              if (ocrResult.data.totalTransactions > 0) {
                setShowAnalysisButton(true);
              }

              // setFailedStatements(ocrResult.pdf_paths_not_extracted || []); // Store failed
              setSelectedFiles([]);
              setFileDetails([]);

              clearInterval(progressIntervalRef.current);
              setProgress(100);
              toast.dismiss(newToastId);

              // open dialog and everything

              setLoading(false);
              localStorage.removeItem("dashboardData");
              // refreshPage();
              progressIntervalRef.current = null;

              // Trigger a page refresh
              // refreshPage();
            } else {
              const errorMessage = result.error
                ? typeof result.error === "object"
                  ? JSON.stringify(result.error, null, 2)
                  : result.error
                : "Unknown error occurred";

              throw new Error(errorMessage);
            }

            // toast({
            //   title: "OCR Completed",
            //   variant: "success",
            // });
          } catch (ocrErr) {
            toast({
              title: "OCR Failed",
              description: "OCR retry failed for scanned/encoded PDFs.",
              variant: "destructive",
            });
            console.error("OCR error:", ocrErr);
          }
        }
        clearInterval(progressIntervalRef.current);
        setProgress(100);
        toast.dismiss(newToastId);

        // open dialog and everything

        setLoading(false);
        localStorage.removeItem("dashboardData");
        // refreshPage();
        progressIntervalRef.current = null;

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
      localStorage.removeItem("dashboardData");
    }
  };
  const toggleEdit = (id, caseName) => {
    setIsCategoryEditOpen(!isCategoryEditOpen);
    setCurrentCaseId(id);
    setCurrentCaseName(caseName);
  };
  const handleAddReport = (caseName, caseID) => {
    setCurrentCaseName(caseName);
    setCurrentCaseId(caseID);
    setIsAddPdfModalOpen(true);
  };

  const closeModal = () => {
    setIsAddPdfModalOpen(false);
  };

  // Function to handle opening the modal and fetching the failed statements
  const handleDetails = async (reportId, reportName) => {
    setIsLoading(true);
    setCurrentCaseName(reportName);

    try {
      const failedStatements = await window.electron.getFailedStatements(
        reportId
      );

      if (!Array.isArray(failedStatements) || failedStatements.length === 0) {
        // console.warn("No failed statements found for this report.");
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
      if (processedFailedData.length === 0) {
        console.warn("No valid failed statement data found after processing.");
        setFailedDatasOfCurrentReport([]);
        setShowRectifyButton(false);
        return;
      }
      // Extract first valid failed statement (assuming one caseId per report)
      const firstFailedEntry = processedFailedData[0];
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

      // Remove duplicate entries using pdfName
      const uniqueFailedDataOfReport = tempFailedDataOfReport.filter(
        (item, index, self) =>
          index === self.findIndex((t) => t.pdfName === item.pdfName)
      );

      setIsHandleDetailsDialogOpen(reportId);
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
      updateReportData({
        triggerRectify: { caseId: null, caseName: null },
      });
    }
  };

  useEffect(() => {
    if (
      reportData.triggerRectify.caseId &&
      reportData.triggerRectify.caseName
    ) {
      handleDetails(
        reportData?.triggerRectify?.caseId,
        reportData?.triggerRectify?.caseName
      );
    }
  }, [reportData.triggerRectify]);

  const handleDownload = async (caseid, status, caseName) => {
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

    try {
      const success = await generateFinancialReport(caseid, false, caseName);

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

  const processSuspenseData = (transactions) => {
    return transactions.map((transaction) => ({
      date: new Date(transaction.date).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
      description: transaction.description,
      credit:
        transaction.type.toLowerCase() === "credit" ? transaction.amount : 0,
      debit:
        transaction.type.toLowerCase() === "debit" ? transaction.amount : 0,
      balance: transaction.balance,
      category: transaction.category,
      id: transaction.id,
    }));
  };

  const fetchSuspenseData = async (caseId) => {
    try {
      const suspenseTransactionaAll =
        await window.electron.getTransactionsBySuspense(caseId, null);

      const transformedSuspenseData = processSuspenseData(
        suspenseTransactionaAll
      );

      return transformedSuspenseData;

      // Initially select all months
    } catch (error) {
      console.error("Error fetching suspense transactions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuspenseDownload = async (caseId, caseName) => {
    const suspenseData = await fetchSuspenseData(caseId);

    let newTitle = `${caseName} Suspense Transactions.xlsx`;

    exportToExcel(suspenseData, newTitle, false, reportData.categoryOptions);
  };
  const handleSummaryDownload = async (caseid, status, reportName) => {
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

    let isCombinedDashboard =
      individualId === undefined ||
      individualId === "undefined" ||
      individualId === null ||
      individualId === "combined";

    try {
      // console.log("Downloading summary report for case:", caseid);
      let success = false;
      console.log("reportData", reportName);

      const fileName = reportName;
      console.log("fileName", fileName);
      if (isCombinedDashboard) {
        console.log("fileName", fileName);
        success = await generateFinancialReport(caseid, null, fileName, true);
      } else {
        const fileName = reportName;
        console.log("individualId", individualId);
        console.log("fileName", fileName);
        success = await generateFinancialReport(
          caseid,
          individualId,
          fileName,
          true
        ); // Pass true for summaryOnly
      }
      // const success = await generateFinancialReport(caseid, fileName, true); // Pass true for summaryOnly
      console.log("success", success);

      if (success) {
        // console.log("Summary report downloaded successfully.");
        toast({
          title: "Success",
          description: "Summary Excel file downloaded successfully",
        });
      } else {
        console.error("Failed to generate the summary report.");
        toast({
          title: "Error",
          description: "Failed to download Summary Excel file.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error in handleDownloadSummary:", error);
      toast({
        title: "Error",
        description: `Failed to initiate summary download: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const handleExcelFileUpload = async (event, caseId) => {
    const file = event.target.files[0];
    if (!file) return;

    const suspenseData = await fetchSuspenseData(caseId);

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
          const existingTransaction = suspenseData.find(
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
        .filter(Boolean); // Remove nulls

      // Store updates and show confirmation modal
      setUploadedChanges({ updates, suspenseData, caseId });
      setCategoryUpdateModalOpen(true);
    };

    reader.readAsArrayBuffer(file);
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

  const applyUploadedCategoryChanges = async () => {
    // Suspense excel upload handle
    try {
      const suspenseTransactions = uploadedChanges.suspenseData;
      const uploadedData = uploadedChanges.updates;

      // Call API or Electron IPC to update database
      // await window.electron.updateSuspenseCategories(uploadedChanges);

      // TODO - Apply changes locally in the table

      const updatedTransactions = uploadedData.map((change) => {
        const updatedTransaction = suspenseTransactions.find(
          (tx) => tx.id === change.id
        );
        if (updatedTransaction) {
          updatedTransaction.oldCategory = change.oldCategory;
          updatedTransaction.category = change.newCategory;
          updatedTransaction.reasoning = "";
        }
        return updatedTransaction;
      });

      const payload = convertArrayToObject(updatedTransactions);
      const response = await window.electron.editCategory(
        payload,
        uploadedChanges.caseId
      );
      // console.log({ response });
      setCategoryUpdateModalOpen(false);
      setUploadedChanges({});
      toast({
        title: "Categories Updated!",
        description: "Suspense transactions have been updated successfully.",
      });
      // if (refreshFunction) refreshFunction();
    } catch (error) {
      console.error("Error updating categories:", error);
      toast({
        title: "Error",
        description: "Failed to update categories. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleUploadClick = (reportId) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xlsx, .xls";
    input.onchange = (e) => handleExcelFileUpload(e, reportId);
    input.click();
  };

  const isHandleDetailsOpenForThisId = (id) => {
    if (!id) return null;

    return isHandleDetailsDialogOpen === id;
  };

  const handleChangeForHandleDetails = (id) => {
    if (isHandleDetailsDialogOpen === id) {
      setIsHandleDetailsDialogOpen(null);
    } else {
      setIsHandleDetailsDialogOpen(id);
    }
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
        caseName={currentCaseName}
      />

      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Recent Reports</CardTitle>
            <CardDescription className="py-3">
              A list of recent reports
            </CardDescription>
          </div>
          <div className="relative flex gap-x-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search reports..."
              className="pl-10 w-[400px]"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Button
              onClick={fetchReports}
              variant="outline"
              className="flex items-center gap-2"
            >
              <RotateCw className="w-4 h-4" />
            </Button>
          </div>
          {/* add refresh button */}
        </div>
      </CardHeader>
      <CardContent>
        {reportData.recentReportsData.length > 0 ? (
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
              {currentReports.map((report, index) => {
                const isDeleted = report.deleted === 1;

                return (
                  <TableRow
                    key={report.id}
                    className={cn(
                      isDeleted && "opacity-50 pointer-events-none"
                    )}
                  >
                    <TooltipProvider delayDuration={800}>
                      {" "}
                      {/* Reduces delay to 100ms */}
                      <TableCell>{report.createdAt}</TableCell>
                      <TableCell>
                        {/* For deleted reports show only first 3 chars */}
                        {isDeleted
                          ? report.name.slice(0, 3) + "***"
                          : report.name}
                        {/* {isDeleted && (
                          <Badge variant="destructive" className="ml-2">
                            Deleted
                          </Badge>
                        )} */}
                      </TableCell>
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
                                onClick={() =>
                                  toggleEdit(report.id, report.name)
                                }
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
                                <AlertDialogTitle>
                                  Delete Report
                                </AlertDialogTitle>
                              </AlertDialogHeader>
                              <div className="py-4 flex gap-3 items-center">
                                <Checkbox
                                  id="delete-report"
                                  checked={isChecked}
                                  onCheckedChange={(checked) =>
                                    setIsChecked(checked)
                                  }
                                  className="mb-5"
                                ></Checkbox>
                                <label
                                  htmlFor="delete-report"
                                  className="select-none"
                                >
                                  Are you sure you want to delete this report?
                                  This action cannot be undone.
                                </label>
                              </div>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction asChild>
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
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>

                          <DropdownMenu>
                            <Tooltip>
                              <DropdownMenuTrigger asChild>
                                <TooltipTrigger asChild>
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
                                </TooltipTrigger>
                              </DropdownMenuTrigger>
                              <TooltipContent>
                                {report.status === "Pending"
                                  ? "Download not available while processing"
                                  : "Download Excel"}
                              </TooltipContent>
                            </Tooltip>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                className="cursor-pointer"
                                onClick={() =>
                                  handleDownload(
                                    report.id,
                                    report.status,
                                    report.name
                                  )
                                }
                              >
                                Download Report
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="cursor-pointer"
                                onClick={() =>
                                  handleSuspenseDownload(report.id, report.name)
                                }
                              >
                                Download Suspense
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="cursor-pointer"
                                onClick={() =>
                                  handleSummaryDownload(
                                    report.id,
                                    report.status,
                                    report.name
                                  )
                                }
                              >
                                Download Summary
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>

                          {/* Upload Button */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => handleUploadClick(report.id)}
                                className={cn(
                                  "h-8 w-8",
                                  report.status === "In Progress" &&
                                    "opacity-50 cursor-not-allowed"
                                )}
                                disabled={report.status === "In Progress"}
                              >
                                <Upload className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              Upload Modified Suspense
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                      <TableCell>
                        <AlertDialog
                          open={isHandleDetailsOpenForThisId(report.id)}
                          onOpenChange={() =>
                            handleChangeForHandleDetails(report.id)
                          }
                        >
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
                            <TooltipContent>Info</TooltipContent>
                          </Tooltip>
                          <AlertDialogContent className="max-w-2xl bg-white shadow-lg border-0 dark:bg-slate-950">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-xl font-medium text-black bg-black/[0.03] -mx-6 -mt-6 p-4 border-b border-black/10 dark:bg-slate-900 dark:text-slate-300">
                                Report Details
                              </AlertDialogTitle>
                            </AlertDialogHeader>
                            <div className="p-6 overflow-auto max-h-[400px]">
                              {!failedDatasOfCurrentReport ? (
                                <div className="text-center py-4">
                                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
                                  <p className="text-gray-600 mt-2">
                                    Loading report details...
                                  </p>
                                </div>
                              ) : failedDatasOfCurrentReport.length === 0 &&
                                !report.hasFailedStatements ? (
                                <div className="text-center py-4">
                                  <div className="text-green-600 font-semibold mb-2">
                                    Report Processed Successfully
                                  </div>
                                  <CheckCircle className="w-8 h-8 text-green-600 mx-auto" />
                                </div>
                              ) : (
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
                                          key={`statement-${
                                            statement.id || index
                                          }`}
                                          className="mb-4 border-b pb-4 last:border-b-0"
                                        >
                                          <h3 className="font-semibold mb-2">
                                            Failed Statement {index + 1}
                                          </h3>
                                          <div className="flex gap-2 items-center">
                                            <p className="flex-[4.5]">
                                              <strong>File Name:</strong>{" "}
                                              {statement.pdfName
                                                ? statement.pdfName.substring(
                                                    statement.pdfName.indexOf(
                                                      "-"
                                                    ) + 1
                                                  )
                                                : ""}
                                            </p>
                                            {/* {!hasError && ( */}
                                            {
                                              <div className="flex-1">
                                                {report.status === "Success" ||
                                                isDone ? (
                                                  <Button
                                                    size="sm"
                                                    disabled
                                                    className="w-full bg-green-600 hover:bg-green-700 text-white transition-colors"
                                                  >
                                                    <CheckCircle className="w-4 h-4 mr-2" />
                                                    Done
                                                  </Button>
                                                ) : (
                                                  <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    className="w-full hover:bg-primary hover:text-primary-foreground transition-colors"
                                                    onClick={() => {
                                                      setIsMarkerModalOpen(
                                                        true
                                                      );
                                                      setSelectedFailedFile(
                                                        statement
                                                      );
                                                    }}
                                                  >
                                                    Rectify
                                                  </Button>
                                                )}
                                              </div>
                                            }
                                          </div>
                                          {console.log("aiyaz", {
                                            hasError,
                                            isDone,
                                          })}
                                          {hasError &&
                                            report.status !== "Success" &&
                                            (() => {
                                              const msg =
                                                statement.respectiveReasonsForError ||
                                                "";
                                              // match your date-range error
                                              const re =
                                                /The period for Bank:[^()]+\((\d{2}-\d{2}-\d{4}) to (\d{2}-\d{2}-\d{4})\)[^()]*\((\d{2}-\d{2}-\d{4}) to (\d{2}-\d{2}-\d{4})\)/;
                                              const m = msg.match(re);

                                              return (
                                                <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md">
                                                  <div className="flex items-center gap-2">
                                                    <XCircle className="w-5 h-5 text-red-500" />
                                                    <span className="font-semibold text-red-700">
                                                      Error
                                                    </span>
                                                  </div>

                                                  {m ? (
                                                    // date-range case: nested bullets
                                                    <ul className="list-disc list-inside mt-2 space-y-1 text-red-600">
                                                      <li className="font-medium">
                                                        Inccorect Date Entered:
                                                      </li>
                                                      <ul className="list-disc list-inside ml-6 space-y-1">
                                                        <li>
                                                          User Input: {m[3]} – 
                                                          {m[4]}
                                                        </li>
                                                        <li>
                                                          Correct: {m[1]} – 
                                                          {m[2]}
                                                        </li>
                                                        <li>
                                                          Please Verify and
                                                          Reupload With Correct
                                                          Date.
                                                        </li>
                                                      </ul>
                                                    </ul>
                                                  ) : (
                                                    // all other errors: single paragraph
                                                    <p className="mt-2 text-red-600 text-sm">
                                                      {msg}
                                                    </p>
                                                  )}

                                                  {/* your existing “please rerun” vs “contact sales” hint */}
                                                  <p className="mt-2 text-red-500 text-xs">
                                                    {msg
                                                      .toLowerCase()
                                                      .includes(
                                                        "start and end date"
                                                      )
                                                      ? "Please re-run this statement with correct dates."
                                                      : ""}
                                                  </p>
                                                </div>
                                              );
                                            })()}
                                        </div>
                                      );
                                    })}
                                </div>
                              )}
                            </div>
                            <AlertDialogFooter className="border-t border-black/10 pt-6">
                              {/* {failedDatasOfCurrentReport?.length > 0 &&
                              !report.resolved && (
                                <div className="flex justify-center">
                                  {report.status === "Success" &&
                                  failedDatasOfCurrentReport.every(
                                    (st) => st.resolved
                                  ) ? (
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
                              )} */}
                              {failedDatasOfCurrentReport?.length > 0 &&
                                !report.hasFailedStatements &&
                                report.status === "Failed" && (
                                  <div className="flex justify-center">
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
                                  </div>
                                )}
                              <AlertDialogCancel
                                onClick={() =>
                                  setIsHandleDetailsDialogOpen(null)
                                }
                                className="px-8 bg-black text-white hover:bg-black/90 hover:text-white dark:bg-white dark:text-black"
                              >
                                Close
                              </AlertDialogCancel>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TooltipProvider>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : isLoading ? (
          <div className="flex justify-center items-center w-full text-grey-600 opacity-70 font-semibold">
            <Loader2 />
          </div>
        ) : reportData.recentReportsData.length === 0 ? (
          <div className="flex justify-center items-center w-full text-grey-600 opacity-70 font-semibold">
            No Reports Found
          </div>
        ) : null}
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
          <div className="bg-white rounded-lg shadow-lg max-w-7xl w-full p-6 max-h-[90%] overflow-y-auto">
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
              {uploadedChanges?.updates?.length} transactions. Please review the
              changes before proceeding.
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {uploadedChanges?.updates?.map((change) => (
                  <TableRow key={change.id}>
                    <TableCell>{change.date}</TableCell>
                    <TableCell>{change.description}</TableCell>
                    <TableCell>{change.credit}</TableCell>
                    <TableCell>{change.debit}</TableCell>
                    <TableCell>{change.oldCategory}</TableCell>
                    <TableCell className="text-blue-600">
                      {change.newCategory}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
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

      {/* Dialog for successful report generation */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen} className="">
        <DialogContent className="max-h-[90vh] overflow-y-auto pb-0 border-none shadow-none">
          <DialogHeader>
            {successfulStatements.length > 0 ? (
              <DialogTitle>
                Report {currentCaseName} Generated Successfully!
              </DialogTitle>
            ) : (
              <DialogTitle className="flex items-end gap-x-2 items-center">
                <AlertTriangle className="text-yellow-500 w-6 h-6" />
                Some statement had errors.
              </DialogTitle>
            )}
            <DialogDescription className="flex items-end gap-x-4 pt-4">
              {/* {failedStatements.length === 0 && (
                      <div className="flex items-center gap-x-4">
                        <CheckCircle className="text-green-500 w-6 h-6 mt-2" />
                        <p>Your report has been generated successfully.</p>
                      </div>
                    )} */}
            </DialogDescription>
          </DialogHeader>

          {(failedStatements.length > 0 || successfulStatements.length > 0) && (
            <div className="mb-2">
              <ul className="list-disc pl-5">
                {failedStatements.map((statement, index) => (
                  <li key={index} className="text-red-400">
                    {statement}
                  </li>
                ))}
                {successfulStatements.map((statement, index) => (
                  <li key={index} className="text-green-700">
                    {statement}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {hasScannedOrEncodedWarning && (
            <div className="mb-4 mt-2">
              <h3 className="text-md font-semibold flex items-center gap-x-2 mb-2">
                <AlertCircle className="text-blue-500 w-5 h-5" />
                OCR Processing Started
              </h3>
              <Card className="p-3 bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700">
                <p className="text-blue-700 dark:text-blue-300 text-sm">
                  We detected one or more scanned or encoded PDFs. We're
                  processing them using OCR in the background. Please allow
                  approximately 1 minute per page. You'll receive a notification
                  once it's ready.
                </p>
              </Card>
            </div>
          )}
          {/* Display Missing Months Section */}
          {missingMonthsList.length > 0 && (
            <div className="mb-4 mt-2">
              <h3 className="text-md font-semibold flex items-center gap-x-2 mb-2">
                <AlertCircle className="text-amber-500 w-5 h-5" />
                Missing Months
              </h3>
              <Card className="p-3 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
                <ul className="space-y-1">
                  {missingMonthsList.map((month, index) => (
                    <li
                      key={index}
                      className="text-amber-700 dark:text-amber-400 flex items-center"
                    >
                      <ChevronRight className="w-4 h-4 mr-1 flex-shrink-0" />
                      <span>{month}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-amber-700 dark:text-amber-400 mt-3">
                  These months are missing from your statements. You may want to
                  add them for a complete analysis.
                </p>
              </Card>
            </div>
          )}

          {/* ——— Other errors in red ——— */}
          {(otherErrors.length > 0 || dateRangeWarning) && (
            <Card className="p-3 bg-red-50 …">
              <h3 className="flex gap-2 mb-4 font-semibold">
                <AlertCircle className="" /> Warning
              </h3>
              <ul className="space-y-1">
                {otherErrors.map((msg, i) => (
                  <li key={i} className="text-red-700 flex items-start">
                    • <span className="ml-1 break-words">{msg}</span>
                  </li>
                ))}

                {dateRangeWarning && (
                  <li className="mt-2 text-red-700">
                    <p className="font-semibold">Date range mismatch:</p>
                    <ul className="list-disc list-inside ml-6 space-y-1">
                      <li>
                        User Input: {dateRangeWarning.userStart}–
                        {dateRangeWarning.userEnd}
                      </li>
                      <li>
                        Available: {dateRangeWarning.fetchedStart}–
                        {dateRangeWarning.fetchedEnd}
                      </li>
                    </ul>
                  </li>
                )}
              </ul>
            </Card>
          )}

          {/* ——— Balance-mismatch in amber, collapsible ——— */}
          {balanceMismatchErrors.length > 0 && (
            <div className="mb-4 mt-2">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setWarningExpanded(!warningExpanded)}
              >
                <h3 className="text-md font-semibold flex items-center gap-x-2">
                  <AlertCircle className="text-amber-500 w-5 h-5" />
                  Balance mismatch details
                </h3>
                <ChevronRight
                  className={cn(
                    "transition-transform text-amber-500 w-5 h-5",
                    warningExpanded ? "rotate-90" : ""
                  )}
                />
              </div>

              {warningExpanded && (
                <Card className="p-3 bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800 mt-2">
                  <ul className="space-y-1">
                    {balanceMismatchErrors.map((msg, idx) => (
                      <li
                        key={idx}
                        className="text-amber-700 dark:text-amber-400 flex items-start"
                      >
                        • <span className="ml-1 break-all">{msg}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>
          )}

          <div className="flex gap-4 sticky w-full p-4  bottom-0 bg-white">
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
