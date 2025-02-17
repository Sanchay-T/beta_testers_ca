import React, { useEffect, useState } from "react";
import { Dialog, DialogContent } from "../ui/dialog";
import { useToast } from "../../hooks/use-toast";
import PdfMarker from "./PdfMarker";
import { useReportContext } from "../../contexts/ReportContext";

const PDFMarkerModal = ({
  isOpen,
  onClose,
  selectedFailedFile,
  source,
  setFailedDatasOfCurrentReport,
  failedDatasOfCurrentReport,
  onProcessingComplete, // Ensure we're properly handling this prop
}) => {
  const [initialConfigFormatted, setInitialConfigFormatted] = useState({
    lines: [],
  });
  const [pdfEditLoading, setPdfEditLoading] = useState(false);
  const { toast } = useToast();
  const { reportData } = useReportContext();
  const { reportName } = reportData;

  const handleSubmitEditPdf = async (modifiedSelectedFailedFile) => {
    // Set loading state
    setPdfEditLoading(true);

    try {
      // Call the API to update the statements
      const result = await window.electron.editPdf(
        [modifiedSelectedFailedFile],
        reportName
      );

      console.log("result11", result);
      if (result.success) {
        console.log("result success", result.success);
        toast({
          title: "Success",
          description: "All statements have been rectified.",
          variant: "success",
          className: "bg-white text-black opacity-100 shadow-lg",
        });

        // IMPORTANT: Call the onProcessingComplete callback to reset the button state
        if (typeof onProcessingComplete === "function") {
          onProcessingComplete();
        }
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

        // Even on error, we should reset the button state
        if (typeof onProcessingComplete === "function") {
          onProcessingComplete();
        }
      }
    } catch (error) {
      console.error("Error in handleSubmitEditPdf:", error);
      toast({
        title: "An error occurred",
        description: "Failed to process the PDF. Please try again.",
        variant: "destructive",
      });

      // On exception, also reset the button state
      if (typeof onProcessingComplete === "function") {
        onProcessingComplete();
      }
    } finally {
      // Always reset loading state
      setPdfEditLoading(false);
    }
  };

  const addColsToStatementData = (pdfPath, columns) => {
    if (!selectedFailedFile) return;
    if (selectedFailedFile.path && selectedFailedFile.path !== pdfPath) return;

    const updatedFile = {
      ...selectedFailedFile,
      rectifiedColumns: columns,
      resolved: true,
    };

    if (source === "indiviualDashboard") {
      // For individual dashboard, call the edit PDF function
      handleSubmitEditPdf(updatedFile);
    } else {
      // For other sources, update the failed data list
      setFailedDatasOfCurrentReport((prev) =>
        prev.map((item) =>
          item.path === selectedFailedFile.path ? updatedFile : item
        )
      );

      // Call onProcessingComplete if it's provided and we're not going through handleSubmitEditPdf
      if (typeof onProcessingComplete === "function") {
        onProcessingComplete();
      }
    }

    // Close the modal
    onClose();
  };

  useEffect(() => {
    if (selectedFailedFile?.columns) {
      setInitialConfigFormatted({
        lines: selectedFailedFile.columns.map((line) => ({ x: line })),
      });
    }
  }, [selectedFailedFile]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl h-[95vh] flex flex-col p-6 overflow-y-auto">
        {selectedFailedFile ? (
          <PdfMarker
            addColsToStatementData={addColsToStatementData}
            initialConfig={initialConfigFormatted}
            pdfPath={selectedFailedFile?.path}
          />
        ) : (
          <div className="text-center text-red-500">
            Error: PDF path not available
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PDFMarkerModal;
