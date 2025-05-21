import React from "react";
import {Download } from "lucide-react";
import { Button } from "../ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "../ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../ui/card";
import { useState, useEffect } from "react";
import { useToast } from "../../hooks/use-toast";
import { useLoading } from "../../contexts/LoadingContext";

// const reports = [
//   { date: "13-12-2024", name: "Report_ATS_unit_1_00008" },
//   { date: "13-12-2024", name: "Report_ATS_unit_1_00007" },
//   { date: "12-12-2024", name: "Report_ATS_unit_1_00003" },
//   { date: "12-12-2024", name: "Report_ATS_unit_1_00002" },
//   { date: "12-12-2024", name: "Report_ATS_unit_1_00001" },
//   { date: "12-12-2024", name: "Report_ATS_unit_1_00001" },
// ];

const Analytics = () => {
  const { toast } = useToast();
  const [recentReports, setRecentReports] = useState([]);
  const { setIsExcelLoading } = useLoading();

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const result = await window.electron.getRecentReports();
        console.log("Fetched reports:", result);

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
        // toast({ title: "Success", description: "Reports loaded successfully." });
      } catch (error) {
        toast({
          title: "Error",
          description: `Failed to load reports: ${error.message}`,
          variant: "destructive",
        });
      } finally {
      }
    };

    fetchReports();
  }, [toast]);


  // In your Analytics.jsx component
  const handleDownload = async (caseid) => {
    let file_cretaed = false;
    try {
      console.log("setting setisexcel true");
      setIsExcelLoading(true); // Start loading
 

      // Start the download process in the main process
      window.electron.download.excelReportDownload(caseid);

      let downloadedChunks = [];
      // let totalFileSize = 0;
      let downloadProgress = 0;

      // Listen for file chunks from the main process
      window.electron.download.onExcelDownloadChunk((chunk) => {
        downloadedChunks.push(chunk);
        downloadProgress += chunk.length;
        console.log(`Downloaded ${downloadProgress} bytes`);

        // Update progress if needed (could add a progress bar)
        // const progressPercentage = (downloadProgress / totalFileSize) * 100;
        // setProgress(progressPercentage);
      });

      // Listen for download completion
      window.electron.download.onExcelDownloadComplete((res) => {
        if(!file_cretaed){

        file_cretaed = true;
        const { message, fileName } = res;
        console.log("Download completed:", message);
        setIsExcelLoading(false); // End loading state


        const fileBlob = new Blob(downloadedChunks, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(fileBlob);

        // Trigger file download
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName
        link.click();

        // Clean up URL
        window.URL.revokeObjectURL(url);

        toast({
          title: 'Success',
          description: res.message || 'Excel file downloaded successfully',
        });
      }
      });

      // Handle download error
      window.electron.download.onExcelDownloadError((error) => {
        console.log("Error downloading file:", error);
        setIsExcelLoading(false);

        toast({
          title: 'Error',
          description: `Failed to download Excel file: ${error}`,
          variant: 'destructive',
        });
      });
    } catch (error) {
      setIsExcelLoading(false);
      toast({
        title: 'Error',
        description: `Failed to initiate download: ${error.message}`,
        variant: 'destructive',
      });
    }
  };



  return (
    <div className="w-full px-4 py-6 -space-y-2 mx-auto ">
      <Card className="border dark:border-gray-700 rounded-lg shadow-sm">
        <CardHeader className="px-4 pb-2">
          <CardTitle className="text-3xl font-bold text-zinc-800 dark:text-slate-300">
            Analytics
          </CardTitle>
          <CardDescription className="text-sm text-zinc-500 dark:text-[#7F8EA3]">
            Select a report to view or download
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          <Table className="border-collapse w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="w-36 text-sm font-medium text-zinc-600 text-center dark:text-[#7F8EA3]">
                  Date
                </TableHead>
                <TableHead className="flex-1 text-sm font-medium text-zinc-600 text-center dark:text-[#7F8EA3]">
                  Report Name
                </TableHead>
                <TableHead className="w-40 text-sm font-medium text-zinc-600 text-center dark:text-[#7F8EA3]">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentReports.map((report, index) => (
                <TableRow
                  key={index}
                  className="hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all duration-200 "
                >
                  <TableCell className="w-36 text-sm dark:text-slate-200 text-zinc-600 text-center">
                    {report.createdAt}
                  </TableCell>
                  <TableCell className="flex-1 text-sm text-zinc-700 text-center dark:text-slate-200">
                    {report.name}
                  </TableCell>
                  <TableCell className="w-40 text-center">
                    <div className="flex justify-center space-x-2">
                      {/* <Button
                        variant="secondary"
                        size="sm"
                        className="hover:bg-primary hover:text-primary-foreground transition-colors"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </Button> */}

                      <Button
                        key={report.id}
                        variant="outline"
                        size="sm"
                        className="hover:bg-primary hover:text-primary-foreground transition-colors"
                        onClick={() => handleDownload(report.id)}

                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download

                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Analytics;
