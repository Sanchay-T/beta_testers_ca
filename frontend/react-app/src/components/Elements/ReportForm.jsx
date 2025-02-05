import React, { useState, useRef, useEffect } from "react";
import {
  Upload,
  ChevronDown,
  Search,
  Plus,
  FileText,
  X,
  Eye,
  Loader2,
} from "lucide-react";
import { Button } from "../ui/button";
import { useToast } from "../../hooks/use-toast";
import { CircularProgress } from "../ui/circularprogress";
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
  SelectItem,
} from "../ui/select";
import { Input } from "../ui/input";

const GenerateReportForm = ({
  currentCaseName = null,
  handleReportSubmit,
  onReportGenerated
}) => {
  const [unit, setUnit] = useState("Unit 1");
  const [units, setUnits] = useState(["Unit 1", "Unit 2"]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [serialNumber, setSerialNumber] = useState("00009");
  const [caseName, setCaseName] = useState("");
  const [lastCaseNumber, setLastCaseNumber] = useState(9); // Track the last used number
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [fileDetails, setFileDetails] = useState([]);
  const dropdownRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const caseIdRef = useRef(null);
  const [forAts, setForAts] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const [progress, setProgress] = useState(0);
  const [toastId, setToastId] = useState(null);
  const progressIntervalRef = useRef(null);
  // console.log("Case Name: ", currentCaseName);
  const [financialYear, setFinancialYear] = useState("");
  const [availableYears, setAvailableYears] = useState([]);
  const [isSearchInputFocused, setIsSearchInputFocused] = useState(false);
  const [bankSearchTerm, setBankSearchTerm] = useState("");
  const [filteredBanks, setFilteredBanks] = useState([]);
  //Bank Names
  const bankNames = [
    "Axis Bank",
    "Bank of Baroda",
    "HDFC Bank",
    "ICICI Bank",
    "IDBI Bank",
    "IDFC First Bank",
    "Indian Overseas Bank",
    "IndusInd Bank",
    "Kotak Mahindra Bank",
    "Punjab National Bank",
    "State Bank of India",
    "NKGSB",
    "TJSB BANK",
    "Union Bank of India",
    "Standard Chartered Bank",
    "Yes Bank",
    "Bank of India",
    "Bank of Maharashtra",
    "Canara Bank",
    "COSMOS CO-OP BANK",
    "DCB Bank",
    "Federal Bank",
    "Indian Bank",
    "SHAMRAO VITTAL CO-OP BANK",
    "The Thane District Central Cooperative Bank",
    "Central Bank of India",
    "Karnataka Bank",
    "RBL Bank",
    "SCB",
    "Saraswat bank",
    "UCO Bank",
    "BASSEIN CATHOLIC BANK",
    "HSBC",
    "MUNICIPAL CO-OP BANK",
    "VASAI VIKAS SHAKARI BANK LTD",
    "NAGPUR NAGARIK SAHAKARI BANK LTD NNSB",
    "THE JALGAON PEOPLES CO-OP BANK LTD",
    "THE CHEMBUR NAGARIK SAHAKARI BANK LTD",
    "BANDHAN BANK",
    "THE PANDHARPUR URBAN CO-OP BANK LTD",
    "AU SMALL FINANCE BANK (AU)",
    "ABHYUDAYA CO-OP BANK LTD",
    "GP PARSIK SAHAKARI BANK LTD",
    "SOUTH INDIAN BANK",
    "DHANLAXMI BANK LTD",
    "THANE BHARAT SAHAKARI BANK LTD",
    "KARUR BANK",
    "BHARAT",
    "CBI",
    "SURAT",
    "JANKALYAN",
    "Other"
  ];

  // Add this useEffect after your other useEffect declarations
  useEffect(() => {
    setFilteredBanks(
      bankNames.filter((bank) =>
        bank.toLowerCase().includes(bankSearchTerm.toLowerCase())
      )
    );
  }, [bankSearchTerm]);

  // Modify the handleFileDetailChange function to convert bank names to lowercase when sending to backend
  const handleFileDetailChange = (index, field, value) => {
    setFileDetails((prev) => {
      const updated = prev.map((detail, i) => {
        if (i === index) {
          let processedValue = value;
          if (field === "bankName") {
            // Store the value in lowercase when it's a bank name
            processedValue = value.toLowerCase();
          }
          const updatedDetail = { ...detail, [field]: processedValue };
          console.log(`Updated ${field} for file ${index}:`, {
            previous: detail[field],
            new: processedValue,
            fullDetail: updatedDetail,
          });
          return updatedDetail;
        }
        return detail;
      });

      console.log("Updated fileDetails:", updated);
      return updated;
    });
  };

  const getFinancialYearDates = (fyString) => {
    if (!fyString) return { startDate: "", endDate: "" };

    const [startYear, endYear] = fyString
      .split("-")
      .map((year) => parseInt(year));
    const startDate = `${startYear}-04-01`; // April 1st of start year
    const endDate = `${endYear}-03-31`; // March 31st of end year

    return { startDate, endDate };
  };

  // Modified financial year change handler
  const handleFinancialYearChange = (selectedYear) => {
    setFinancialYear(selectedYear);

    if (!selectedYear) {
      // If no year is selected, clear the dates
      setFileDetails((prevDetails) =>
        prevDetails.map((detail) => ({
          ...detail,
          start_date: "",
          end_date: "",
        }))
      );
      return;
    }

    // Get dates for the selected financial year
    const { startDate, endDate } = getFinancialYearDates(selectedYear);

    // Update all file details with new dates
    setFileDetails((prevDetails) =>
      prevDetails.map((detail) => ({
        ...detail,
        start_date: startDate,
        end_date: endDate,
      }))
    );
  };

  useEffect(() => {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    const currentFY = currentMonth < 3 ? currentYear - 1 : currentYear;

    const years = [];
    for (let i = 0; i < 5; i++) {
      const startYear = currentFY - i;
      const endYear = startYear + 1;
      years.push(`${startYear}-${endYear}`);
    }

    setAvailableYears(years);
    // Don't set a default financial year, let user select
  }, []);

  // Rest of your component code remains the same, but replace the financial year Select component with:
  const renderFinancialYearSelect = () => (
    <Select value={financialYear} onValueChange={handleFinancialYearChange}>
      <SelectTrigger className="w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500 transition-all">
        <SelectValue placeholder="Select Financial Year" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="placeholder">Select Financial Year</SelectItem>
        {availableYears.map((year) => (
          <SelectItem key={year} value={year}>
            {year}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  // Load the last case number from localStorage on component mount
  useEffect(() => {
    const savedLastNumber = localStorage.getItem("lastCaseNumber");
    if (savedLastNumber) {
      setLastCaseNumber(parseInt(savedLastNumber));
    }
  }, []);

  // Generate new case ID when component mounts or after form submission
  const generateNewCaseId = () => {
    const newNumber = lastCaseNumber + 1;
    const paddedNumber = newNumber.toString().padStart(4, "0");
    setLastCaseNumber(newNumber);
    localStorage.setItem("lastCaseNumber", newNumber.toString());
    return `CASE_${paddedNumber}`;
  };

  // Set initial case ID
  // useEffect(() => {
  //   if (!caseId) {
  //     const newCaseId = generateNewCaseId();
  //     setCaseId(newCaseId);
  //   }
  // }, []);

  const filteredUnits = units.filter((u) =>
    u.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const validateDateRange = (startDate, endDate) => {
    if (!startDate || !endDate) return true;
    const start = new Date(startDate);
    const end = new Date(endDate);
    return start <= end;
  };

  const simulateProgress = () => {
    setProgress(0);
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          return prev;
        }
        const increment = Math.max(1, Math.floor((90 - prev) / 10));
        return Math.min(90, prev + increment);
      });
    }, 3000);
    return interval;
  };

  useEffect(() => {
    if (toastId && progress >= 0 && loading) {
      toast({
        id: toastId,
        title: "Generating Report",
        description: (
          <div className="mt-2 w-full flex items-center gap-2">
            <div className="flex items-center gap-4">
              {/* <CircularProgress value={progress} className="w-full" /> */}
              <Loader2 className="w-6 h-6 animate-spin" />

              {/* <span className="text-sm font-medium">{progress}%</span> */}
            </div>
            <p className="text-sm text-gray-500">
              {progress < 100
                ? "Processing your bank statements..."
                : "Report generated successfully!"}
            </p>
          </div>
        ),
        duration: progress >= 100 ? 3000 : Infinity,
      });
    }
  }, [progress, toastId, loading, toast]);

  useEffect(() => {
    const newFileDetails = selectedFiles.map((file, index) => {
      const existing = fileDetails[index] || {};
      return {
        file,
        previewUrl: URL.createObjectURL(file),
        password: existing.password || "",
        start_date: existing.start_date || "",
        end_date: existing.end_date || "",
        bankName: existing.bankName || "", // Empty string for bank name
      };
    });
    setFileDetails(newFileDetails);

    return () => {
      fileDetails.forEach((detail) => {
        if (detail.previewUrl) {
          URL.revokeObjectURL(detail.previewUrl);
        }
      });
    };
  }, [selectedFiles]);

  // const handleFileDetailChange = (index, field, value) => {
  //   setFileDetails((prev) => {
  //     const updated = prev.map((detail, i) => {
  //       if (i === index) {
  //         const updatedDetail = { ...detail, [field]: value };
  //         console.log(`Updated ${field} for file ${index}:`, {
  //           previous: detail[field],
  //           new: value,
  //           fullDetail: updatedDetail,
  //         });
  //         return updatedDetail;
  //       }
  //       return detail;
  //     });

  //     console.log("Updated fileDetails:", updated);
  //     return updated;
  //   });
  // };
  const handlePreviewFile = (previewUrl, fileType) => {
    window.open(previewUrl, "_blank");
  };

  const handleAddUnit = () => {
    if (searchTerm.trim() && !units.includes(searchTerm.trim())) {
      setUnits([...units, searchTerm.trim()]);
      setUnit(searchTerm.trim());
      setSearchTerm("");
    }
  };

  const convertDateFormat = (dateStr) => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-");
    return `${day}-${month}-${year}`;
  };

  // console.log("Current Case Name: ", caseName);

  const validateForm = () => {
    // Check if any file is missing bank selection
    const missingBanks = fileDetails.some((detail) => !detail.bankName);

    if (missingBanks) {
      toast({
        title: "Error",
        description: "Please select a bank for all files",
        variant: "destructive",
        duration: 3000,
      });
      return false;
    }
    return true;
  };

  // In GenerateReportForm.js, modify the handleSubmit function:

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("Inside handleSubmit..", caseName);

    if (!validateForm()) {
      return;
    }

    if (!caseName && !currentCaseName) {
      toast({
        title: "Error",
        description: "Please enter a report name",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }


    try {
       if(caseName){ // Check if report name exists
        const response = await window.electron.getReportNameExists({
          reportName: caseName || currentCaseName,
        });
        
        console.log({response})
        if (response.exists) {
          toast({
            title: "Error",
            description:
              "Report name already exists. Please choose a different name.",
            variant: "destructive",
            duration: 3000,
          });
          return;
        }}

      // If report name is unique, proceed with report generation
      handleReportSubmit(
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
        caseName || currentCaseName
      );

    } catch (error) {
      console.error("Error checking report name:", error);
      toast({
        title: "Error",
        description: "Failed to validate report name",
        variant: "destructive",
        duration: 3000,
      });
    }

    // if (selectedFiles.length === 0) {
    //   toast({
    //     title: "Error",
    //     description: "Please select at least one file",
    //     variant: "destructive",
    //     duration: 3000,
    //   });
    //   return;
    // }

    // setLoading(true);
    // const newToastId = toast({
    //   title: "Initializing Report Generation",
    //   description: (
    //     <div className="mt-2 w-full flex flex-col gap-2">
    //       <div className="flex items-center gap-4">
    //         <CircularProgress value={0} className="w-full" />
    //         <span className="text-sm font-medium">0%</span>
    //       </div>
    //       <p className="text-sm text-gray-500">Preparing to process files...</p>
    //     </div>
    //   ),
    //   duration: Infinity,
    // });
    // setToastId(newToastId);

    // progressIntervalRef.current = simulateProgress();

    // try {
    //   const filesWithContent = await Promise.all(
    //     selectedFiles.map(async (file, index) => {
    //       const fileContent = await new Promise((resolve, reject) => {
    //         const reader = new FileReader();
    //         reader.onload = () => resolve(reader.result);
    //         reader.onerror = reject;
    //         reader.readAsBinaryString(file);
    //       });

    //       return {
    //         fileContent,
    //         pdf_paths: file.name,
    //         bankName: detail.bankName,
    //         passwords: detail.password || "",
    //         start_date: convertDateFormat(detail.start_date), // Convert date format
    //         end_date: convertDateFormat(detail.end_date), // Convert date format
    //         ca_id: caseId,
    //       };
    //     })
    //   );

    //   const result = await window.electron.generateReportIpc({
    //     files: filesWithContent,
    //   });

    //     const newCaseId = generateNewCaseId();
    //     setCaseId(newCaseId);

    //     setSelectedFiles([]);
    //     setFileDetails([]);
    //   } else {
    //     throw new Error(result.error);
    //   }
    // } catch (error) {
    //   console.error("Report generation failed:", error);
    //   clearInterval(progressIntervalRef.current);
    //   toast.dismiss(newToastId);
    //   setProgress(0);
    //   toast({
    //     title: "Error",
    //     description: error.message || "Failed to generate report",
    //     variant: "destructive",
    //     duration: 5000,
    //   });
    // } finally {
    //   setLoading(false);
    //   progressIntervalRef.current = null;
    // }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(2)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    setSelectedFiles((prevFiles) => [...prevFiles, ...files]);
  };

  const handleFileChange = (e) => {
    console.log("Inside handleFileChange..");
    console.log({e:e.target})
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);

      // Combine new files with existing files
      const combinedFiles = [...selectedFiles, ...newFiles];
      
      console.log({newFiles,combinedFiles})

      // Remove duplicates based on file name and size
      const uniqueFiles = combinedFiles.filter(
        (file, index, self) =>
          index ===
          self.findIndex((f) => f.name === file.name && f.size === file.size)
      );

      console.log({uniqueFiles})

      setSelectedFiles(uniqueFiles);

      // Create file details for all files
      const newFileDetails = uniqueFiles.map((file, index) => {
        // Check if this file already has details from previous selection
        const existingDetailIndex = selectedFiles.findIndex(
          (existingFile) =>
            existingFile.name === file.name && existingFile.size === file.size
        );

        const existingDetail =
          existingDetailIndex !== -1 ? fileDetails[existingDetailIndex] : {};

        return {
          file,
          previewUrl: URL.createObjectURL(file),
          password: existingDetail.password || "",
          start_date: existingDetail.start_date || "",
          end_date: existingDetail.end_date || "",
          bankName: existingDetail.bankName || "",
        };
      });

      setFileDetails(newFileDetails);
    }
  };

  const removeFile = (indexToRemove) => {
    console.log({removeFile: indexToRemove})
    let tempSelectedFiles = [...selectedFiles];
    let tempFileDetails = [...fileDetails];

    console.log({tempSelectedFiles, tempFileDetails})

    tempSelectedFiles= tempSelectedFiles.filter((_, index) => index !== indexToRemove)
    tempFileDetails= tempFileDetails.filter((_, index) => index !== indexToRemove)

    console.log({tempSelectedFiles, tempFileDetails})

    setSelectedFiles(tempSelectedFiles);
    setFileDetails(tempFileDetails);
  };

  return (
    <div className="bg-white dark:bg-black">
      <div className="mx-auto">
        <div className="bg-white dark:bg-black rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8 backdrop-blur-sm">
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
              {forAts && (
                <div className="relative" ref={dropdownRef}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Unit
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="w-full px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-sm hover:border-gray-300 dark:hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500 transition-all flex justify-between items-center group"
                  >
                    <span>{unit}</span>
                    <ChevronDown className="h-4 w-4 text-gray-400 dark:text-gray-300 group-hover:text-[#3498db] transition-colors" />
                  </button>

                  {isDropdownOpen && (
                    <div className="absolute z-10 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-600 rounded-lg shadow-xl">
                      <div className="p-3 border-b border-gray-100 dark:border-gray-600">
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <input
                              type="text"
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              placeholder="Search or add new unit..."
                              className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500 transition-all"
                            />
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400 dark:text-gray-300" />
                          </div>
                          <button
                            type="button"
                            onClick={handleAddUnit}
                            className="px-4 py-2 text-sm font-medium text-white bg-[#3498db] dark:bg-blue-600 rounded-lg hover:bg-[#2980b9] dark:hover:bg-blue-500 transition-all flex items-center gap-1 shadow-sm"
                          >
                            <Plus className="h-4 w-4" />
                            Add
                          </button>
                        </div>
                      </div>
                      <div className="max-h-48 overflow-y-auto py-1">
                        {filteredUnits.map((u, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => {
                              setUnit(u);
                              setIsDropdownOpen(false);
                            }}
                            className="w-full px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                          >
                            {u}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {forAts && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Serial Number
                  </label>
                  <input
                    type="text"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    placeholder="00009"
                    className="w-full px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-sm hover:border-gray-300 dark:hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500 transition-all"
                  />
                </div>
              )}
            </div>

            <div>
              {/* <h1 className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Add Bank Statements
              </h1> */}

              <div className="flex items-center justify-center space-x-4 w-full mb-6">
                <label className="text-md font-medium text-gray-700 dark:text-gray-300">
                  Report Name
                </label>
                <input
                  ref={caseIdRef}
                  type="text"
                  placeholder="Enter report name"
                  value={currentCaseName || caseName}
                  onChange={(e) => setCaseName(e.target.value)}
                  disabled={currentCaseName != null}
                  className={`w-1/3 px-3 py-2 text-sm text-gray-500 dark:text-gray-400 focus:outline-none ${
                    currentCaseName == null
                      ? "focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500"
                      : "cursor-not-allowed"
                  } transition-all border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm`}
                />
              </div>

              <div
                className={`relative ${
                  isDragging ? "ring-2 ring-[#3498db] dark:ring-blue-500" : ""
                }`}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex cursor-pointer flex-col items-center justify-center p-5 border-2 border-dashed border-gray-200 dark:border-white rounded-lg hover:border-gray-300 dark:hover:border-gray-500 transition-all bg-gray-50 dark:bg-black"
                >
                  <div className="flex flex-col items-center justify-center w-full">
                    {selectedFiles.length > 0 ? (
                      <div className="w-full space-y-4">
                        {fileDetails.map((detail, index) => (
                          <div
                            key={index}
                            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 p-4 space-y-4"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <FileText className="w-5 h-5 text-[#3498db] dark:text-blue-500" />
                                <div>
                                  <p className="text-sm text-gray-600 dark:text-gray-300">
                                    {detail.file.name}
                                  </p>
                                  <p className="text-xs text-gray-400 dark:text-gray-500">
                                    {formatFileSize(detail.file.size)}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center space-x-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handlePreviewFile(
                                      detail.previewUrl,
                                      detail.file.type
                                    )
                                  }
                                  className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-[#3498db] dark:hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
                                  title="Preview file"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeFile(index)}
                                  className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
                                  title="Remove file"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                              <div>
                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                  Bank Name
                                </label>
                                <Select
                                  value={detail.bankName || ""}
                                  onValueChange={(value) =>
                                    handleFileDetailChange(
                                      index,
                                      "bankName",
                                      value
                                    )
                                  }
                                  className="w-full"
                                  onOpenChange={() => setBankSearchTerm("")}
                                >
                                  <SelectTrigger className="w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500 transition-all">
                                    <SelectValue placeholder="Select Bank Name" />
                                    <SelectValue>
                                      {detail.bankName || "Select a bank"}
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent
                                    onCloseAutoFocus={(e) => e.preventDefault()}
                                  >
                                    <div className="p-2 border-b flex gap-2">
                                      <div className="relative flex-1">
                                        <Input
                                          placeholder="Search banks..."
                                          value={bankSearchTerm}
                                          onChange={(e) =>
                                            setBankSearchTerm(e.target.value)
                                          }
                                          onFocus={() =>
                                            setIsSearchInputFocused(true)
                                          }
                                          onBlur={() =>
                                            setIsSearchInputFocused(false)
                                          }
                                          onKeyDown={(e) => e.stopPropagation()}
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                          }}
                                        />
                                      </div>
                                    </div>
                                    <div className="max-h-[200px] overflow-y-auto">
                                      {filteredBanks.map((bank) => (
                                        <SelectItem
                                          key={bank}
                                          value={bank.toLowerCase()}
                                        >
                                          {bank}
                                        </SelectItem>
                                      ))}
                                    </div>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                  Financial Year
                                </label>
                                {renderFinancialYearSelect()}
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                  Start Date
                                </label>
                                <input
                                  type="date"
                                  value={detail.start_date || ""}
                                  onChange={(e) => {
                                    const newDate = e.target.value;
                                    handleFileDetailChange(
                                      index,
                                      "start_date",
                                      newDate
                                    );
                                    if (
                                      !validateDateRange(
                                        newDate,
                                        detail.end_date
                                      )
                                    ) {
                                      // toast({
                                      //   title: "Invalid Date Range",
                                      //   description: "Start date must be before end date",
                                      //   variant: "destructive",
                                      //   duration: 3000,
                                      // });
                                    }
                                  }}
                                  className="w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500 transition-all"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                  End Date
                                </label>
                                <input
                                  type="date"
                                  value={detail.end_date || ""}
                                  onBlur={(e) => {
                                    const newDate = e.target.value;
                                    handleFileDetailChange(
                                      index,
                                      "end_date",
                                      newDate
                                    );
                                    if (
                                      !validateDateRange(
                                        detail.start_date,
                                        newDate
                                      )
                                    ) {
                                      toast({
                                        title: "Invalid Date Range",
                                        description:
                                          "End date must be after start date",
                                        variant: "destructive",
                                        duration: 3000,
                                      });
                                    }
                                  }}
                                  onChange={(e) => {
                                    const newDate = e.target.value;
                                    handleFileDetailChange(
                                      index,
                                      "end_date",
                                      newDate
                                    );
                                  }}
                                  className="w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500 transition-all"
                                />
                              </div>

                              <div>
                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                  Password
                                </label>
                                <input
                                  type="password"
                                  value={detail.password || ""}
                                  onChange={(e) =>
                                    handleFileDetailChange(
                                      index,
                                      "password",
                                      e.target.value
                                    )
                                  }
                                  placeholder="Enter password"
                                  className="w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500 transition-all"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 text-gray-400 dark:text-gray-300 mb-2" />
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1 text-center">
                          Drag and drop your files here, or
                        </p>
                      </>
                    )}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    className="mt-4 px-6 py-2.5 text-sm font-medium"
                  >
                    {selectedFiles.length > 0
                      ? "Add More Files"
                      : "Browse Files"}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileChange}
                    className="hidden"
                    multiple
                    accept=".pdf,.xls,.xlsx"
                  />
                </div>

                {isDragging && (
                  <div className="absolute inset-0 bg-[#3498db]/10 dark:bg-blue-500/10 rounded-lg pointer-events-none" />
                )}
              </div>
            </div>

            <div className="flex justify-center pt-4">
              <Button
                type="submit"
                disabled={loading}
                className="relative inline-flex items-center px-4 py-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  "Generate Report"
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default GenerateReportForm;
