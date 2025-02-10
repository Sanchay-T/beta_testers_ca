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

  const [totalReports, setTotalReports] = useState(0);
  const [totalStatements, setTotalStatements] = useState(0);
  const [reportChartData, setReportChartData] = useState([]);
  const [statementChartData, setStatementChartData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [reportStatus, setReportStatus] = useState({ success: 0, failed: 0 });
  const [allData, setAllData] = useState([]);
  const [currentDuration, setCurrentDuration] = useState("1M");
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [reportsDuration, setReportsDuration] = useState("1M");
  const [statementsDuration, setStatementsDuration] = useState("1Y");
  const [pagesData, setPagesData] = useState([]);
  const [AverageTimeSavedPerDay, setAverageTimeSavedPerDay] = useState(0);
  const [timeMetrics, setTimeMetrics] = useState({
    totalTimeSaved: 0,
    averageTimeSavedPerDay: 0,
    timeData: [],
  });
  const [timeMetricsDuration, setTimeMetricsDuration] = useState("1M");

  const calculateTimeMetrics = (pagesData, duration) => {
    const today = new Date();
    let startDate;

    const getFYDates = () => {
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth() + 1;
      const fyStartYear = currentMonth <= 3 ? currentYear - 1 : currentYear;

      return {
        start: new Date(`${fyStartYear}-04-01`),
        end: new Date(`${fyStartYear + 1}-03-31`),
      };
    };

    switch (duration) {
      case "1M":
        startDate = new Date(
          today.getFullYear(),
          today.getMonth() - 1,
          today.getDate()
        );
        break;
      case "2M":
        startDate = new Date(
          today.getFullYear(),
          today.getMonth() - 2,
          today.getDate()
        );
        break;
      case "6M":
        startDate = new Date(
          today.getFullYear(),
          today.getMonth() - 6,
          today.getDate()
        );
        break;
      case "1Y":
        const fyDates = getFYDates();
        startDate = fyDates.start;
        break;
      default:
        startDate = new Date(
          today.getFullYear(),
          today.getMonth() - 1,
          today.getDate()
        );
    }

    const filteredPages = pagesData.filter((item) => {
      const itemDate = new Date(item.createdAt);
      return duration === "1Y"
        ? itemDate >= getFYDates().start && itemDate <= getFYDates().end
        : itemDate >= startDate && itemDate <= today;
    });

    const totalPages = filteredPages.reduce((sum, item) => sum + item.pages, 0);
    const daysInPeriod = Math.ceil(
      (duration === "1Y"
        ? getFYDates().end - getFYDates().start
        : today - startDate) /
        (1000 * 60 * 60 * 24)
    );

    const totalTimeSaved = totalPages * 10;
    const averageTimeSavedPerDay = Math.round(totalTimeSaved / daysInPeriod);

    return {
      totalTimeSaved,
      averageTimeSavedPerDay,
      totalPages,
      daysInPeriod,
    };
  };

  const handleTimeMetricsDurationChange = (duration) => {
    setTimeMetricsDuration(duration);
    const newMetrics = calculateTimeMetrics(pagesData, duration);
    setTimeMetrics((prevMetrics) => ({
      ...prevMetrics,
      totalTimeSaved: newMetrics.totalTimeSaved,
      averageTimeSavedPerDay: newMetrics.averageTimeSavedPerDay,
    }));
  };

  const filterDataByDuration = (data, duration) => {
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
        monthsToShow = 1;
    }

    const sortedData = [...data].sort((a, b) => {
      const monthA = new Date(Date.parse(a.month + " 1, 2024"));
      const monthB = new Date(Date.parse(b.month + " 1, 2024"));
      return monthA - monthB;
    });

    const filteredData = sortedData.slice(-monthsToShow);
    const reportTotal = filteredData.reduce(
      (sum, item) => sum + (item.reports || 0),
      0
    );
    const statementTotal = filteredData.reduce(
      (sum, item) => sum + (item.statements || 0),
      0
    );

    return { filteredData, reportTotal, statementTotal };
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
    };
  };

  const getFinancialYearDates = () => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    const fyStartYear = currentMonth <= 3 ? currentYear - 1 : currentYear;

    return {
      start: new Date(`${fyStartYear}-04-01`),
      end: new Date(`${fyStartYear + 1}-03-31`),
    };
  };

  const filterStatementsByFinancialYear = (statements) => {
    const { start, end } = getFinancialYearDates();

    return statements.statementDates.filter((date) => {
      const statementDate = new Date(date);
      return statementDate >= start && statementDate <= end;
    }).length;
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const reports = await window.electron.getReportsProcessed();
        const statements = await window.electron.getStatementsProcessed();
        const transactions = await window.electron.getTransactionsProcessed();
        const pages = await window.electron.getPages();

        setPagesData(pages);

        const initialMetrics = calculateTimeMetrics(pages, "1Y");
        setTimeMetrics({
          totalTimeSaved: initialMetrics.totalTimeSaved,
          averageTimeSavedPerDay: initialMetrics.averageTimeSavedPerDay,
          timeData: [],
        });

        const fyStatementCount = filterStatementsByFinancialYear(statements);
        setTotalTransactions(transactions.totalCount);

        const mergedData = processData(reports, statements);
        setAllData(mergedData);

        const reportsData = filterDataByDuration(mergedData, "1M");
        const statementsData = filterStatementDataByDuration(mergedData, "1Y");

        setReportChartData(reportsData.filteredData);
        setStatementChartData(statementsData.filteredData);
        setTotalReports(reportsData.reportTotal);
        setTotalStatements(fyStatementCount);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      }
    };

    fetchDashboardData();
  }, []);

  const handleReportsDurationChange = (duration) => {
    setReportsDuration(duration);
    const { filteredData, reportTotal } = filterDataByDuration(
      allData,
      duration
    );
    setReportChartData(filteredData);
    setTotalReports(reportTotal);
  };

  const handleStatementsDurationChange = (duration) => {
    setStatementsDuration(duration);
    const { filteredData, statementTotal } = filterStatementDataByDuration(
      allData,
      duration
    );
    setStatementChartData(filteredData);
  };

  const handleDurationChange = (duration) => {
    setCurrentDuration(duration);
    const { filteredData, reportTotal, statementTotal } = filterDataByDuration(
      allData,
      duration
    );
    setReportChartData(filteredData);
    setTotalReports(reportTotal);
    setTotalStatements(statementTotal);
  };

  const processData = (reports, statements) => {
    const processDataByMonth = (dates) => {
      return dates.reduce((acc, date) => {
        const month = new Date(date).toLocaleString("default", {
          month: "short",
        });
        acc[month] = (acc[month] || 0) + 1;
        return acc;
      }, {});
    };

    const reportsByMonth = processDataByMonth(reports.caseDates || []);
    const statementsByMonth = processDataByMonth(
      statements.statementDates || []
    );

    const allMonths = [
      ...new Set([
        ...Object.keys(reportsByMonth),
        ...Object.keys(statementsByMonth),
      ]),
    ];

    return allMonths.map((month) => ({
      month,
      reports: reportsByMonth[month] || 0,
      statements: statementsByMonth[month] || 0,
    }));
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-8 pt-0 space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight dark:text-slate-300">
              Cyphersol
            </h2>
            <p className="text-muted-foreground">
              Analytics Dashboard : 1.0.1-alpha , the update has been
              successfull Analytics Dashboard : 1.0.1-alpha , the update has
              been successfull
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
            title="Monthly Reports & Statements"
            value1="Total Reports"
            value2="Total Statements"
            mainValue1={totalReports}
            mainValue2={totalStatements}
            chartData={reportChartData}
            chartType="bar"
            onDurationChange={handleReportsDurationChange}
          />

          <StatsMetricCard
            type="statements"
            title="Financial Year Statements"
            value1="FY Statements"
            value2="Total Transactions"
            mainValue1={totalStatements}
            mainValue2={totalTransactions}
            chartData={statementChartData}
            chartType="line"
            handleDurationChange={handleStatementsDurationChange}
          />
          <StatsMetricCard
            type="timeSaved"
            title="Time Saved"
            value1="Total Time Saved"
            value2="Average Time Saved/Day"
            mainValue1={timeMetrics.totalTimeSaved}
            mainValue2={timeMetrics.averageTimeSavedPerDay}
            mainValueLabel="Minutes Saved"
            currentDuration={timeMetricsDuration}
            onDurationChange={handleTimeMetricsDurationChange}
          />
        </div>

        {/* <MetricCard {...timeMetric} /> */}

        {/* Recent reports */}
        <RecentReports />
        {/* <Card>
              <CardHeader>
                <CardTitle>Analytics Overview</CardTitle>
                <CardDescription>Report generation trends over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ReportChart chartData={dummyChartData} viewType={chartViewType} />
              </CardContent>
            </Card> */}
      </div>
    </ScrollArea>
  );
};

export default MainDashboard;
