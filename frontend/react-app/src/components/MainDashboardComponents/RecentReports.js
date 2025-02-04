import React, { useState, useEffect } from "react";
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
  Loader2, AlertTriangle, XCircle
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";

import PDFMarkerModal from "./PdfMarkerModal";

const RecentReportsComp = ({key,onReportGenerated}) => {
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

      if (result.success) {
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


  const handleAddPdfSubmit =  async (
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
          title: "Error",
          description: "Please enter a Case Name",
          variant: "destructive",
          duration: 3000,
        });
        return;
      }
      setCurrentCaseName(caseName);
  
      if (selectedFiles.length === 0) {
        toast({
          title: "Error",
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
          });
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
        if(showAnalsisButton || showRectifyButton) {
          setDialogOpen(true);
        }
        toast({
          title: "Error",
          description: showRectifyButton?"Some Statement/s failed, please check rectify them.":"Failed to add report",
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
            if(parsedData.paths.length===0) return null;

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
      console.log({processedFailedData,firstFailedEntry})
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
                  <TooltipProvider delayDuration={800}> {/* Reduces delay to 100ms */}

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
                        onClick={() => handleAddReport(report.name, report.id)}
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
                          <div className="py-4">
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
                            >
                              Delete
                            </Button>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
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
                          onClick={() => handleDetails(report.id, report.name)}
                        >
                          <Info className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                        </TooltipTrigger>
                      <TooltipContent>View Failed Statements</TooltipContent>
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
                                                {report.status === "Success" ? (
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
                                          {<p className="text-red-500 text-xs mt-1">
                                          {statement.respectiveReasonsForError.toLowerCase().includes("start and end date")? "Please Re-run this statement with correct dates.": "Please contact sales for assistance with this issue."}
                                          </p>}
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
