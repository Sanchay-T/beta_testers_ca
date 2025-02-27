import React, { useState, useEffect } from "react";
import { ScrollArea } from "../ui/scroll-area";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import RecentReports from "./RecentReports";
import { Bell, Moon, Sun } from "lucide-react";
import { useTheme } from "../theme-provider";
import StatsMetricCard from "../Elements/StatsCard";
import Card1 from "../Elements/Card1";
import Card2 from "../Elements/Card2";
import Card3 from "../Elements/Card3";
import { ResponsiveContainer } from "recharts";

const MainDashboard = ({handleTabChange}) => {
  const { theme, setTheme } = useTheme();
  const [allData, setAllData] = useState([]);
  const [pagesData, setPagesData] = useState([]);
  const [totalEligibility, setTotalEligibility] = useState(0);
  const [totalCommission, setTotalCommission] = useState(0);

  // Separate states for each metric card
  const [reportsMetrics, setReportsMetrics] = useState({
    totalReports: 0,
    totalStatements: 0,
    // totalTransactions: 0,
    chartData: [],
    duration: "all",
  });

  const [pagesMetrics, setPagesMetrics] = useState({
    totalPages: 0,
    totalTransactions: 0,
    totalTimeSaved: 0,
    averageTimeSavedPerDay: 0,
    chartData: [],
    duration: "all",
  });

  // const [timeMetrics, setTimeMetrics] = useState({
  //   totalTimeSaved: 0,
  //   averageTimeSavedPerDay: 0,
  //   timeData: [],
  //   duration: "all",
  // });

  const notifications = [
    {
      id: 1,
      title: "New Message",
      message: "You have a new message from the team.",
      time: "5m ago",
    },
    {
      id: 2,
      title: "Report Ready",
      message: "Your report is ready to download.",
      time: "10m ago",
    },
    {
      id: 3,
      title: "Update Available",
      message: "A new version is available.",
      time: "1h ago",
    },
  ];

  const filterPagesDataByDuration = (pagesData, duration) => {
    const endDate = new Date();
    const startDate = new Date();

    switch (duration) {
      case "today":
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case "1M":
        startDate.setMonth(endDate.getMonth() - 1);
        break;
      case "3M":
        startDate.setMonth(endDate.getMonth() - 3);
        break;
      case "6M":
        startDate.setMonth(endDate.getMonth() - 6);
        break;
      case "1Y":
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
      case "all":
        const totalPagesAll = pagesData.reduce(
          (sum, item) => sum + item.pages,
          0
        );
        const totalTimeSavedAll = totalPagesAll * 10;
        const daysCountAll = pagesData.length > 0 ? pagesData.length : 1;

        return {
          filteredData: pagesData.map((item) => ({
            date: new Date(item.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "2-digit",
              year: "numeric",
            }),
            pages: item.pages,
          })),
          totalPages: totalPagesAll,
          totalTransactions: allData.reduce(
            (sum, item) => sum + (item.transactions || 0),
            0
          ),
          totalTimeSaved: totalTimeSavedAll,
          averageTimeSavedPerDay: Math.round(totalTimeSavedAll / daysCountAll),
        };
    }

    const filteredPages = pagesData.filter((item) => {
      const itemDate = new Date(item.createdAt);
      return itemDate >= startDate && itemDate <= endDate;
    });

    const totalPages = filteredPages.reduce((sum, item) => sum + item.pages, 0);
    const totalTimeSaved = totalPages * 10; // Calculate time saved based on filtered pages
    const daysInPeriod = Math.max(
      1,
      Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24))
    );

    // Group pages by date for chart data
    const chartData = filteredPages.reduce((acc, item) => {
      const date = new Date(item.createdAt).toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
      });

      const existingEntry = acc.find((entry) => entry.date === date);
      if (existingEntry) {
        existingEntry.pages += item.pages;
      } else {
        acc.push({
          date: date,
          pages: item.pages,
        });
      }
      return acc;
    }, []);

    // Calculate transactions for the filtered period
    const filteredTransactions = allData
      .filter((item) => {
        const itemDate = new Date(item.date);
        return itemDate >= startDate && itemDate <= endDate;
      })
      .reduce((sum, item) => sum + (item.transactions || 0), 0);

    return {
      filteredData: chartData,
      totalPages: totalPages,
      totalTransactions: filteredTransactions,
      totalTimeSaved: totalTimeSaved,
      averageTimeSavedPerDay: Math.round(totalTimeSaved / daysInPeriod),
    };
  };

  const handlePagesDurationChange = (duration) => {
    console.log("Duration changed to ", duration, pagesData);

    const filteredResults = filterPagesDataByDuration(pagesData, duration);
    console.log("filtered results", filteredResults);

    setPagesMetrics({
      ...filteredResults,
      duration: duration,
    });
  };

  // const calculateTimeMetrics = (pagesData, duration) => {
  //   const today = new Date();
  //   const startDate = new Date();

  //   switch (duration) {
  //     case "1M":
  //       startDate.setMonth(today.getMonth() - 1);
  //       break;
  //     case "3M":
  //       startDate.setMonth(today.getMonth() - 3);
  //       break;
  //     case "6M":
  //       startDate.setMonth(today.getMonth() - 6);
  //       break;
  //     case "1Y":
  //       startDate.setFullYear(today.getFullYear() - 1);
  //       break;
  //     default:
  //       startDate.setMonth(today.getMonth() - 1);
  //   }

  //   const filteredPages = pagesData.filter((item) => {
  //     const itemDate = new Date(item.createdAt);
  //     return itemDate >= startDate && itemDate <= today;
  //   });

  //   const totalPages = filteredPages.reduce((sum, item) => sum + item.pages, 0);
  //   const daysInPeriod = Math.ceil((today - startDate) / (1000 * 60 * 60 * 24)); // Dynamically calculate days
  //   const totalTimeSaved = totalPages * 10;
  //   const averageTimeSavedPerDay =
  //     daysInPeriod > 0 ? Math.round(totalTimeSaved / daysInPeriod) : 0;

  //   return {
  //     totalTimeSaved,
  //     averageTimeSavedPerDay,
  //     totalPages,
  //     daysInPeriod,
  //   };
  // };

  const filterDataByDuration = (data, duration) => {
    console.log("Aiyaz", { data, duration });
    const endDate = new Date();
    const startDate = new Date();

    switch (duration) {
      case "today":
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(0, 0, 0, 0);
        break;
      case "1M":
        startDate.setMonth(endDate.getMonth() - 1);
        break;
      case "3M":
        startDate.setMonth(endDate.getMonth() - 3);
        break;
      case "6M":
        startDate.setMonth(endDate.getMonth() - 6);
        break;
      case "1Y":
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
      case "all":
        console.log("all data", data);
        console.log("all data", data);
        return filterDataForAll(data);
      default:
        return filterDataForAll(data);
    }

    // console.log("start date", startDate);
    // console.log("end date", endDate);

    const filteredData = data.filter((item) => {
      const itemDate = new Date(item.date);
      // console.log("item date", itemDate);
      return itemDate >= startDate && itemDate <= endDate;
    });
    // console.log("filtered data", filteredData);

    const aggregatedData = filteredData.reduce((acc, item) => {
      const itemDate = new Date(item.date);
      const monthKey = itemDate.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      });

      if (!acc[monthKey]) {
        acc[monthKey] = {
          date: monthKey,
          reports: 0,
          statements: 0,
          transactions: 0,
        };
      }

      acc[monthKey].reports += item.reports || 0;
      acc[monthKey].statements += item.statements || 0;
      acc[monthKey].transactions += item.transactions || 0;

      return acc;
    }, {});

    const aggregatedArray = Object.values(aggregatedData);

    return {
      filteredData: duration === "1M" ? filteredData : aggregatedArray,
      reportTotal: filteredData.reduce(
        (sum, item) => sum + (item.reports || 0),
        0
      ),
      statementTotal: filteredData.reduce(
        (sum, item) => sum + (item.statements || 0),
        0
      ),
      transactionTotal: filteredData.reduce(
        (sum, item) => sum + (item.transactions || 0),
        0
      ),
    };
  };

  // const filterStatementDataByDuration = (data, duration) => {
  //   const today = new Date();
  //   let monthsToShow;

  //   switch (duration) {
  //     case "1M":
  //       monthsToShow = 1;
  //       break;
  //     case "3M":
  //       monthsToShow = 3;
  //       break;
  //     case "6M":
  //       monthsToShow = 6;
  //       break;
  //     case "1Y":
  //       monthsToShow = 12;
  //       break;
  //     default:
  //       monthsToShow = 12;
  //   }

  //   const sortedData = [...data].sort((a, b) => {
  //     const monthA = new Date(Date.parse(a.month + " 1, 2024"));
  //     const monthB = new Date(Date.parse(b.month + " 1, 2024"));
  //     return monthA - monthB;
  //   });

  //   const filteredData = sortedData.slice(-monthsToShow);
  //   return {
  //     filteredData,
  //     statementTotal: filteredData.reduce(
  //       (sum, item) => sum + (item.statements || 0),
  //       0
  //     ),
  //     transactionTotal: filteredData.reduce(
  //       (sum, item) => sum + (item.transactions || 0),
  //       0
  //     ),
  //   };
  // };

  const filterDataForAll = (data) => {
    console.log("hello");
    console.log("data1", data);
    console.log("hello");
    console.log("data1", data);
    const reportTotal = data.reduce(
      (sum, item) => sum + (item.reports || 0),
      0
    );
    const statementTotal = data.reduce(
      (sum, item) => sum + (item.statements || 0),
      0
    );
    const transactionTotal = data.reduce(
      (sum, item) => sum + (item.transactions || 0),
      0
    );

    return {
      filteredData: data,
      reportTotal,
      statementTotal,
      transactionTotal,
    };
  };

  // const filterDataForToday = (data) => {
  //   const today = new Date();
  //   // console.log("today", today);
  //   const todayString = today.toLocaleDateString("en-US", {
  //     month: "short",
  //     day: "2-digit",
  //     year: "numeric",
  //   });
  //   // console.log("today date", todayString);

  //   // console.log("data1", data);
  //   // Find the entry for the current month/year
  //   const todayData = data.find((item) => {
  //     const itemDate = item.month; // Already in "MMM YYYY" format
  //     return itemDate === todayString;
  //   });
  //   // console.log("today data", todayData);

  //   if (!todayData) {
  //     return {
  //       filteredData: [],
  //       reportTotal: 0,
  //       statementTotal: 0,
  //       transactionTotal: 0,
  //     };
  //   }

  //   return {
  //     filteredData: [todayData],
  //     reportTotal: todayData.reports || 0,
  //     statementTotal: todayData.statements || 0,
  //     transactionTotal: todayData.transactions || 0,
  //   };
  // };

  const calculateTimeMetricsAll = (pagesData) => {
    const totalPages = pagesData.reduce((sum, item) => sum + item.pages, 0);
    const totalTimeSaved = totalPages * 10;
    const daysCount = pagesData.length > 0 ? pagesData.length : 1;
    const averageTimeSavedPerDay = Math.round(totalTimeSaved / daysCount);

    return {
      totalTimeSaved,
      averageTimeSavedPerDay,
      totalPages,
      daysCount,
    };
  };

  // const calculateTimeMetricsToday = (pagesData) => {
  //   const today = new Date();
  //   const todayPages = pagesData.filter((item) => {
  //     const itemDate = new Date(item.createdAt);
  //     return itemDate.toDateString() === today.toDateString();
  //   });

  //   const totalPages = todayPages.reduce((sum, item) => sum + item.pages, 0);
  //   const totalTimeSaved = totalPages * 10;

  //   return {
  //     totalTimeSaved,
  //     averageTimeSavedPerDay: totalTimeSaved, // For today, total = average
  //     totalPages,
  //     daysCount: 1,
  //   };
  // };

  const processData = (reports, statements, transactions) => {
    const processDataByDate = (dates) => {
      return dates.reduce((acc, date) => {
        const dateObj = new Date(date);
        const key = dateObj.toLocaleDateString("en-US", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
    };

    const reportsByDate = processDataByDate(reports.caseDates || []);
    const statementsByDate = processDataByDate(statements.statementDates || []);
    const transactionsByDate = processDataByDate(
      transactions.transactionDates || []
    );

    // Get all unique dates
    const allDates = [
      ...new Set([
        ...Object.keys(reportsByDate),
        ...Object.keys(statementsByDate),
        ...Object.keys(transactionsByDate),
      ]),
    ].sort((a, b) => new Date(a) - new Date(b));

    return allDates.map((date) => ({
      date: date,
      reports: reportsByDate[date] || 0,
      statements: statementsByDate[date] || 0,
      transactions: transactionsByDate[date] || 0,
    }));
  };

  // Separate handlers for each metric card
  const handleReportsDurationChange = (duration) => {
    const filteredResults = filterDataByDuration(allData, duration);

    setReportsMetrics({
      totalReports: filteredResults.reportTotal,
      totalStatements: filteredResults.statementTotal,
      totalTransactions: filteredResults.transactionTotal,
      chartData: filteredResults.filteredData,
      duration: duration,
    });
  };

  // const handleStatementsDurationChange = (duration) => {
  //   // console.log("alldata", allData);

  //   const filteredResults = filterDataByDuration(allData, duration);
  //   // console.log("transaction", filteredResults.transactionTotal);

  //   // setStatementsMetrics({
  //   //   totalStatements: filteredResults.statementTotal,
  //   //   totalTransactions: filteredResults.transactionTotal,
  //   //   chartData: filteredResults.filteredData,
  //   //   duration: duration,
  //   // });
  // };
  // const handleTimeMetricsDurationChange = (duration) => {
  //   const endDate = new Date();
  //   const startDate = new Date();

  //   switch (duration) {
  //     case "today":
  //       startDate.setHours(0, 0, 0, 0);
  //       endDate.setHours(23, 59, 59, 999);
  //       break;
  //     case "1M":
  //       startDate.setMonth(endDate.getMonth() - 1);
  //       break;
  //     case "3M":
  //       startDate.setMonth(endDate.getMonth() - 3);
  //       break;
  //     case "6M":
  //       startDate.setMonth(endDate.getMonth() - 6);
  //       break;
  //     case "1Y":
  //       startDate.setFullYear(endDate.getFullYear() - 1);
  //       break;
  //     case "all":
  //       const allMetrics = calculateTimeMetricsAll(pagesData);
  //       setTimeMetrics({
  //         totalTimeSaved: allMetrics.totalTimeSaved,
  //         averageTimeSavedPerDay: allMetrics.averageTimeSavedPerDay,
  //         timeData: [],
  //         duration: duration,
  //       });
  //       return;
  //   }

  //   const filteredPages = pagesData.filter((item) => {
  //     const itemDate = new Date(item.createdAt);
  //     return itemDate >= startDate && itemDate <= endDate;
  //   });

  //   const totalPages = filteredPages.reduce((sum, item) => sum + item.pages, 0);
  //   const totalTimeSaved = totalPages * 10;
  //   const daysInPeriod = Math.max(
  //     1,
  //     Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24))
  //   );
  //   const averageTimeSavedPerDay = Math.round(totalTimeSaved / daysInPeriod);

  //   setTimeMetrics({
  //     totalTimeSaved,
  //     averageTimeSavedPerDay,
  //     timeData: [],
  //     duration: duration,
  //   });
  // };

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Check if cached data exists
        const cachedData = localStorage.getItem("dashboardData");

        if (cachedData) {
          console.log("Loading data from cache...");
          const parsedData = JSON.parse(cachedData);

          setAllData(parsedData.allData);
          setPagesData(parsedData.pagesData);
          setReportsMetrics(parsedData.reportsMetrics);
          setPagesMetrics(parsedData.pagesMetrics);
          setTotalEligibility(parsedData.totalEligibility || 0);
          setTotalCommission(parsedData.totalCommission || 0);
          // setTimeMetrics(parsedData.timeMetrics);
          return; // Exit the function if cache exists
        }

        console.log("Fetching fresh data...");

        // Fetch fresh data
        const reports = await window.electron.getReportsProcessed();
        const statements = await window.electron.getStatementsProcessed();
        const transactions = await window.electron.getTransactionsProcessed();
        const pages = await window.electron.getPages();
        const opportunityToEarn = await window.electron.getOpportunityToEarn();
        let totalEligibility1 = 0;

        let totalCommission1 = 0;

        if (
          opportunityToEarn.success &&
          Array.isArray(opportunityToEarn.data)
        ) {
          totalEligibility1 = opportunityToEarn.data.reduce((sum, item) => {
            return (
              sum +
              (item.homeLoanValue || 0) +
              (item.loanAgainstProperty || 0) +
              (item.businessLoan || 0) +
              (item.termPlan || 0) +
              (item.generalInsurance || 0)
            );
          }, 0);

          totalCommission1 = opportunityToEarn.data.reduce((sum, item) => {
            return (
              sum +
              (item.homeLoanValue || 0) * 0.0045 +
              (item.loanAgainstProperty || 0) * 0.0065 +
              (item.businessLoan || 0) * 0.01 +
              (item.termPlan || 0) +
              (item.generalInsurance || 0)
            );
          }, 0);

          console.log("Total Eligibility Amount:", totalEligibility1);
          console.log("Total Commission Amount:", totalCommission1);
        } else {
          console.log("Invalid data structure");
        }

        setTotalEligibility(totalEligibility1);
        setTotalCommission(totalCommission1);
        console.log("total eligibility", totalEligibility);
        console.log("total commission", totalCommission);
        setPagesData(pages);
        const mergedData = processData(reports, statements, transactions);
        setAllData(mergedData);

        // Aggregate Data for Charts
        const aggregatedData = mergedData.reduce((acc, item) => {
          const itemDate = new Date(item.date);
          const monthKey = itemDate.toLocaleDateString("en-US", {
            month: "short",
            year: "numeric",
          });

          if (!acc[monthKey]) {
            acc[monthKey] = {
              date: monthKey,
              reports: 0,
              statements: 0,
              transactions: 0,
            };
          }

          acc[monthKey].reports += item.reports || 0;
          acc[monthKey].statements += item.statements || 0;
          acc[monthKey].transactions += item.transactions || 0;

          return acc;
        }, {});

        const aggregatedArray = Object.values(aggregatedData);
        console.log("Aggregated Data:", aggregatedArray);

        // Calculate Metrics
        const totalPages = pages.reduce((sum, item) => sum + item.pages, 0);
        const totalTimeSaved = totalPages * 10;
        const daysCount = pages.length > 0 ? pages.length : 1;

        const reportsMetricsData = {
          totalReports: mergedData.reduce(
            (sum, item) => sum + (item.reports || 0),
            0
          ),
          totalStatements: mergedData.reduce(
            (sum, item) => sum + (item.statements || 0),
            0
          ),
          totalTransactions: mergedData.reduce(
            (sum, item) => sum + (item.transactions || 0),
            0
          ),
          chartData: aggregatedArray,
          duration: "all",
        };

        const pagesMetricsData = {
          totalPages: totalPages,
          totalTransactions: reportsMetricsData.totalTransactions,
          totalTimeSaved: totalTimeSaved,
          averageTimeSavedPerDay: Math.round(totalTimeSaved / daysCount),
          chartData: pages.map((item) => ({
            date: new Date(item.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "2-digit",
              year: "numeric",
            }),
            pages: item.pages,
          })),
          duration: "all",
        };

        const timeMetricsData = {
          totalTimeSaved: totalTimeSaved,
          averageTimeSavedPerDay: Math.round(totalTimeSaved / daysCount),
          timeData: [],
          duration: "all",
        };

        setReportsMetrics(reportsMetricsData);
        setPagesMetrics(pagesMetricsData);
        // setTimeMetrics(timeMetricsData);

        // Store Data in Cache
        localStorage.setItem(
          "dashboardData",
          JSON.stringify({
            allData: mergedData, // Store mergedData instead of aggregatedArray
            pagesData: pages,
            reportsMetrics: reportsMetricsData,
            pagesMetrics: pagesMetricsData,
            totalEligibility: totalEligibility1,
            totalCommission: totalCommission1,
            // timeMetrics: timeMetricsData,
          })
        );

        console.log("Dashboard data cached successfully.");
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      }
    };

    fetchDashboardData();
  }, []);

  const [isSmallScreen, setIsSmallScreen] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsSmallScreen(window.innerWidth < 976.26);
    };

    // Initial check
    checkScreenSize();

    // Add event listener for resize
    window.addEventListener("resize", checkScreenSize);

    // Cleanup
    return () => {
      window.removeEventListener("resize", checkScreenSize);
    };
  }, []);

  const gridClasses = isSmallScreen
    ? "grid gap-6 grid-cols-1 h-[300px]"
    : "grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 h-[300px]";

  console.log("pagesss", pagesMetrics);

  return (
    <ScrollArea className="h-full">
      <div className="p-8 pt-0 space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight dark:text-slate-300">
              CypherSOL
            </h2>
            <p className="text-muted-foreground">
              Analytics Dashboard : 1.0.1-alpha , the update has been successful
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="relative">
                  <Bell className="h-4 w-4" />
                  <span className="absolute top-0 right-0 h-2 w-2 bg-red-600 rounded-full" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[380px]">
                <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {notifications.map((notification) => (
                  <DropdownMenuItem
                    key={notification.id}
                    className="flex flex-col items-start p-4"
                  >
                    <div className="flex justify-between w-full">
                      <span className="font-medium">{notification.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {notification.time}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {notification.message}
                    </p>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            >
              {theme === "light" ? (
                <Moon className="h-4 w-4" />
              ) : (
                <Sun className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          
        </div> */}

        <ResponsiveContainer className={gridClasses}>
          <Card1
            type="reports"
            title="Overview"
            value1="Total Reports"
            value2="Total Statements"
            mainValue1={reportsMetrics.totalReports}
            mainValue2={reportsMetrics.totalStatements}
            chartData={reportsMetrics.chartData}
            chartType="bar"
            onDurationChange={handleReportsDurationChange}
            initialDuration={reportsMetrics.duration}
          />

          <Card2
            type="pages"
            title="Platform Activity"
            value1="Total Pages"
            value2="Total Transactions"
            value3="Total Time Saved"
            value4="Avg Time Saved/Day"
            mainValue1={pagesMetrics.totalPages}
            mainValue2={pagesMetrics.totalTransactions}
            mainValue3={pagesMetrics.totalTimeSaved}
            mainValue4={pagesMetrics.averageTimeSavedPerDay}
            chartType="line"
            onDurationChange={handlePagesDurationChange}
            initialDuration={pagesMetrics.duration}
          />

          <Card3
            type="Total Eligible Cases"
            title="Total Eligible reports"
            value1="Total Eligibilty"
            value2="Total Commission"
            mainValue1={totalEligibility}
            mainValue2={totalCommission}
            handleTabChange={handleTabChange}
          />
        </ResponsiveContainer>

        <RecentReports />
      </div>
    </ScrollArea>
  );
};

export default MainDashboard;
