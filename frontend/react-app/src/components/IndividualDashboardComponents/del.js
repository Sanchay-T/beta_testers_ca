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

const MainDashboard = () => {
  const { theme, setTheme } = useTheme();
  const [allData, setAllData] = useState([]);
  const [pagesData, setPagesData] = useState([]);

  // Separate states for each metric card
  const [reportsMetrics, setReportsMetrics] = useState({
    totalReports: 0,
    totalStatements: 0,
    totalTransactions: 0,
    chartData: [],
    duration: "all",
  });

  const [statementsMetrics, setStatementsMetrics] = useState({
    totalStatements: 0,
    totalTransactions: 0,
    chartData: [],
    duration: "all",
  });

  const [timeMetrics, setTimeMetrics] = useState({
    totalTimeSaved: 0,
    averageTimeSavedPerDay: 0,
    timeData: [],
    duration: "all",
  });

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

  const calculateTimeMetrics = (pagesData, duration) => {
    const today = new Date();
    const startDate = new Date();

    switch (duration) {
      case "1M":
        startDate.setMonth(today.getMonth() - 1);
        break;
      case "2M":
        startDate.setMonth(today.getMonth() - 2);
        break;
      case "6M":
        startDate.setMonth(today.getMonth() - 6);
        break;
      case "1Y":
        startDate.setFullYear(today.getFullYear() - 1);
        break;
      default:
        startDate.setMonth(today.getMonth() - 1);
    }

    const filteredPages = pagesData.filter((item) => {
      const itemDate = new Date(item.createdAt);
      return itemDate >= startDate && itemDate <= today;
    });

    const totalPages = filteredPages.reduce((sum, item) => sum + item.pages, 0);
    const daysInPeriod = Math.ceil((today - startDate) / (1000 * 60 * 60 * 24)); // Dynamically calculate days
    const totalTimeSaved = totalPages * 10;
    const averageTimeSavedPerDay =
      daysInPeriod > 0 ? Math.round(totalTimeSaved / daysInPeriod) : 0;

    return {
      totalTimeSaved,
      averageTimeSavedPerDay,
      totalPages,
      daysInPeriod,
    };
  };

  const filterDataByDuration = (data, duration) => {
    const today = new Date();
    const startDate = new Date();

    switch (duration) {
      case "1M":
        startDate.setMonth(today.getMonth() - 1);
        break;
      case "2M":
        startDate.setMonth(today.getMonth() - 2);
        break;
      case "6M":
        startDate.setMonth(today.getMonth() - 6);
        break;
      case "1Y":
        startDate.setFullYear(today.getFullYear() - 1);
        break;
      default:
        startDate.setMonth(today.getMonth() - 1);
    }

    const filteredData = data.filter((item) => {
      const itemDate = new Date(
        Date.parse(item.month + " 1, " + today.getFullYear())
      );
      return itemDate >= startDate && itemDate <= today;
    });

    const reportTotal = filteredData.reduce(
      (sum, item) => sum + (item.reports || 0),
      0
    );
    const statementTotal = filteredData.reduce(
      (sum, item) => sum + (item.statements || 0),
      0
    );
    const transactionTotal = filteredData.reduce(
      (sum, item) => sum + (item.transactions || 0),
      0
    );

    return {
      filteredData,
      reportTotal,
      statementTotal,
      transactionTotal,
    };
  };

  const filterStatementDataByDuration = (data, duration) => {
    const today = new Date();
    let monthsToShow;

    switch (duration) {
      case "1M":
        monthsToShow = 1;
        break;
      case "2M":
        monthsToShow = 2;
        break;
      case "6M":
        monthsToShow = 6;
        break;
      case "1Y":
        monthsToShow = 12;
        break;
      default:
        monthsToShow = 12;
    }

    const sortedData = [...data].sort((a, b) => {
      const monthA = new Date(Date.parse(a.month + " 1, 2024"));
      const monthB = new Date(Date.parse(b.month + " 1, 2024"));
      return monthA - monthB;
    });

    const filteredData = sortedData.slice(-monthsToShow);
    return {
      filteredData,
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

  const filterDataForAll = (data) => {
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

  const filterDataForToday = (data) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Get today's date in the format "MMM DD YYYY"
    const todayFormatted = today.toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    });

    // Filter data for today only
    const todayData = data.filter((item) => {
      const itemDate = new Date(item.date); // You'll need to add a 'date' field to your data
      const itemDateFormatted = itemDate.toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
      });
      return itemDateFormatted === todayFormatted;
    });

    return {
      filteredData: todayData,
      reportTotal: todayData.reduce(
        (sum, item) => sum + (item.reports || 0),
        0
      ),
      statementTotal: todayData.reduce(
        (sum, item) => sum + (item.statements || 0),
        0
      ),
      transactionTotal: todayData.reduce(
        (sum, item) => sum + (item.transactions || 0),
        0
      ),
    };
  };

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

  const calculateTimeMetricsToday = (pagesData) => {
    const today = new Date();
    const todayPages = pagesData.filter((item) => {
      const itemDate = new Date(item.createdAt);
      return itemDate.toDateString() === today.toDateString();
    });

    const totalPages = todayPages.reduce((sum, item) => sum + item.pages, 0);
    const totalTimeSaved = totalPages * 10;

    return {
      totalTimeSaved,
      averageTimeSavedPerDay: totalTimeSaved, // For today, total = average
      totalPages,
      daysCount: 1,
    };
  };

  const processData = (reports, statements, transactions) => {
    const processDataByMonth = (dates) => {
      return dates.reduce((acc, date) => {
        const dateObj = new Date(date);
        const month = dateObj.toLocaleString("default", { month: "short" });
        const year = dateObj.getFullYear();
        const key = `${month} ${year}`;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
    };

    const reportsByMonth = processDataByMonth(reports.caseDates || []);
    const statementsByMonth = processDataByMonth(
      statements.statementDates || []
    );
    const transactionsByMonth = processDataByMonth(
      transactions.transactionDates || []
    );

    const allMonths = [
      ...new Set([
        ...Object.keys(reportsByMonth),
        ...Object.keys(statementsByMonth),
        ...Object.keys(transactionsByMonth),
      ]),
    ];

    return allMonths.map((monthYear) => ({
      month: monthYear,
      reports: reportsByMonth[monthYear] || 0,
      statements: statementsByMonth[monthYear] || 0,
      transactions: transactionsByMonth[monthYear] || 0,
    }));
  };

  // Separate handlers for each metric card
  const handleReportsDurationChange = (duration) => {
    let filteredResults;

    if (duration === "today") {
      filteredResults = filterDataForToday(allData);
    } else if (duration === null) {
      // null represents showing all data
      filteredResults = {
        filteredData: allData,
        reportTotal: allData.reduce(
          (sum, item) => sum + (item.reports || 0),
          0
        ),
        statementTotal: allData.reduce(
          (sum, item) => sum + (item.statements || 0),
          0
        ),
        transactionTotal: allData.reduce(
          (sum, item) => sum + (item.transactions || 0),
          0
        ),
      };
    } else {
      filteredResults = filterDataByDuration(allData, duration);
    }

    setReportsMetrics({
      totalReports: filteredResults.reportTotal,
      totalStatements: filteredResults.statementTotal,
      totalTransactions: filteredResults.transactionTotal,
      chartData: filteredResults.filteredData,
      duration: duration || null,
    });
  };

  const handleStatementsDurationChange = (duration) => {
    let filteredResults;

    if (duration === "today") {
      filteredResults = filterDataForToday(allData);
    } else if (duration === null) {
      // null represents showing all data
      filteredResults = {
        filteredData: allData,
        statementTotal: allData.reduce(
          (sum, item) => sum + (item.statements || 0),
          0
        ),
        transactionTotal: allData.reduce(
          (sum, item) => sum + (item.transactions || 0),
          0
        ),
      };
    } else {
      filteredResults = filterStatementDataByDuration(allData, duration);
    }

    setStatementsMetrics({
      totalStatements: filteredResults.statementTotal,
      totalTransactions: filteredResults.transactionTotal,
      chartData: filteredResults.filteredData,
      duration: duration || null,
    });
  };

  const handleTimeMetricsDurationChange = (duration) => {
    let newMetrics;

    if (duration === "today") {
      newMetrics = calculateTimeMetricsToday(pagesData);
    } else if (duration === null) {
      // null represents showing all data
      const totalPages = pagesData.reduce((sum, item) => sum + item.pages, 0);
      const totalTimeSaved = totalPages * 10;
      const daysCount = pagesData.length > 0 ? pagesData.length : 1;
      newMetrics = {
        totalTimeSaved,
        averageTimeSavedPerDay: Math.round(totalTimeSaved / daysCount),
        totalPages,
        daysCount,
      };
    } else {
      newMetrics = calculateTimeMetrics(pagesData, duration);
    }

    setTimeMetrics({
      totalTimeSaved: newMetrics.totalTimeSaved,
      averageTimeSavedPerDay: newMetrics.averageTimeSavedPerDay,
      timeData: [],
      duration: duration || null,
    });
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const reports = await window.electron.getReportsProcessed();
        const statements = await window.electron.getStatementsProcessed();
        const transactions = await window.electron.getTransactionsProcessed();
        const pages = await window.electron.getPages();

        setPagesData(pages);
        const mergedData = processData(reports, statements, transactions);
        setAllData(mergedData);

        // Initialize with all data
        const totalPages = pages.reduce((sum, item) => sum + item.pages, 0);
        const totalTimeSaved = totalPages * 10;
        const daysCount = pages.length > 0 ? pages.length : 1;

        setTimeMetrics({
          totalTimeSaved,
          averageTimeSavedPerDay: Math.round(totalTimeSaved / daysCount),
          timeData: [],
          duration: null,
        });

        const reportTotal = mergedData.reduce(
          (sum, item) => sum + (item.reports || 0),
          0
        );
        const statementTotal = mergedData.reduce(
          (sum, item) => sum + (item.statements || 0),
          0
        );
        const transactionTotal = mergedData.reduce(
          (sum, item) => sum + (item.transactions || 0),
          0
        );

        setReportsMetrics({
          totalReports: reportTotal,
          totalStatements: statementTotal,
          totalTransactions: transactionTotal,
          chartData: mergedData,
          duration: null,
        });

        setStatementsMetrics({
          totalStatements: statementTotal,
          totalTransactions: transactionTotal,
          chartData: mergedData,
          duration: null,
        });
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      }
    };

    fetchDashboardData();
  }, []);

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

        <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          <StatsMetricCard
            type="reports"
            title="Reports & Statements"
            value1="Total Reports"
            value2="Total Statements"
            mainValue1={reportsMetrics.totalReports}
            mainValue2={reportsMetrics.totalStatements}
            chartData={reportsMetrics.chartData}
            chartType="bar"
            onDurationChange={handleReportsDurationChange}
            initialDuration={reportsMetrics.duration}
          />

          <StatsMetricCard
            type="statements"
            title="Financial Year Statements"
            value1="FY Statements"
            value2="Total Transactions"
            mainValue1={statementsMetrics.totalStatements}
            mainValue2={statementsMetrics.totalTransactions}
            chartData={statementsMetrics.chartData}
            chartType="line"
            onDurationChange={handleStatementsDurationChange}
            initialDuration={statementsMetrics.duration}
          />

          <StatsMetricCard
            type="timeSaved"
            title="Time Saved"
            value1="Total Time Saved"
            value2="Avg Time Saved/Day"
            mainValue1={timeMetrics.totalTimeSaved}
            mainValue2={timeMetrics.averageTimeSavedPerDay}
            mainValueLabel="Minutes Saved"
            onDurationChange={handleTimeMetricsDurationChange}
            initialDuration={timeMetrics.duration}
          />
        </div>

        <RecentReports />
      </div>
    </ScrollArea>
  );
};

export default MainDashboard;
