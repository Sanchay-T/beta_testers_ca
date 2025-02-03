import React, { useState, useEffect } from "react";
import SingleLineChart from "../charts/LineChart";
import SingleBarChart from "../charts/BarChart";
import PieCharts from "../charts/PieCharts";
import DataTable from "./TableData";
import { Maximize2, Minimize2 } from "lucide-react";
import { Card, CardHeader, CardTitle } from "../ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import ToggleStrip from "./ToggleStrip";
import { useParams } from "react-router-dom";
import CategoryEditTable from "../MainDashboardComponents/CategoryEditTable";

const MaximizableChart = ({ children, title, isMaximized, setIsMaximized }) => {
  const toggleMaximize = () => setIsMaximized(!isMaximized);

  if (isMaximized) {
    return (
      <Dialog open={isMaximized} onOpenChange={setIsMaximized}>
        <DialogContent className="max-w-[100vw] w-[70vw] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 w-full overflow-hidden">{children}</div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="w-full md:w-1/2 lg:w-1/3 p-2">
      <Card className="h-full">
        <CardHeader className="relative">
          <CardTitle className="dark:text-slate-300">{title}</CardTitle>
          <button
            onClick={toggleMaximize}
            className="absolute top-4 right-4 p-1 rounded-lg 
                     bg-slate-100 dark:bg-slate-800 
                     hover:bg-slate-200 dark:hover:bg-slate-700
                     transition-colors duration-200"
            aria-label="Maximize"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </CardHeader>
        <div className="p-4">{children}</div>
      </Card>
    </div>
  );
};

const Transactions = () => {
  const [isDailyBalanceMaximized, setIsDailyBalanceMaximized] = useState(false);
  const [isCreditDebitMaximized, setIsCreditDebitMaximized] = useState(false);
  const [isCategoryMaximized, setIsCategoryMaximized] = useState(false);
  const [transactionData, setTransactionData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [availableMonths, setAvailableMonths] = useState([]);
  const { caseId, individualId } = useParams();
  const [categoryOptions, setCategoryOptions] = useState(null);

  // Sample entity options
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
  ];

  useEffect(() => {
    setCategoryOptions(categoryOptionsfixed);
  }, []);

  useEffect(() => {
  }, [individualId]);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {

        // Add this line to debug the electron call
        const data = await  window.electron.getTransactions(
          caseId,
          parseInt(individualId)
        );

        // Transform the data to only include required fields
        const formattedData = data.map((transaction) => ({
          date: new Date(transaction.date).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          }),
          description: transaction.description,
          amount: transaction.amount,
          category: transaction.category,
          type: transaction.type,
          balance: transaction.balance,
          bank: transaction.bank,
          id:transaction.id
        }));

        setTransactionData(formattedData);
      } catch (err) {
        setError("Failed to fetch transactions");
        console.error("Error fetching transactions:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTransactions();
  }, []);

  const monthsData = React.useMemo(() => {
    return transactionData.reduce((acc, transaction) => {
      const date = new Date(transaction.date);
      const monthKey = `${date.toLocaleString("en-GB", {
        month: "short",
      })}-${date.getFullYear()}`;

      if (!acc[monthKey]) {
        acc[monthKey] = [];
      }

      const standardizedTransaction = {
        date: date,
        description: transaction.description,
        amount: transaction.amount,
        balance: transaction.balance,
        category: transaction.category,
        bank: transaction.bank,
        // entity: transaction.entity,
        type: transaction.type,
        id:transaction.id
      };


      acc[monthKey].push(standardizedTransaction);
      return acc;
    }, {});
  }, [transactionData]);

  const getMonthDate = (monthStr) => {
    const [month, year] = monthStr.split("-");
    const monthIndex = new Date(Date.parse(month + " 1, 2000")).getMonth();
    return new Date(parseInt(year), monthIndex);
  };

  const processDailyData = (transactions) => {
    return transactions.map((transaction) => ({
      date: transaction.date.toLocaleDateString("en-GB", {
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
      bank: transaction.bank,
      id:transaction.id
      // entity: transaction.entity,
    }));
  };

  // print the processed data

  const processCreditDebitData = (transactions) => {
    return transactions.map((transaction) => ({
      date: transaction.date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
      credit:
        transaction.type.toLowerCase() === "credit" ? transaction.amount : 0,
      debit:
        transaction.type.toLowerCase() === "debit" ? transaction.amount : 0,
    }));
  };
  const processCategoryData = (transactions) => {
    const categoryTotals = transactions.reduce((acc, transaction) => {
      if (transaction.type === "debit") {
        const category = transaction.category || "Uncategorized";
        if (!acc[category]) {
          acc[category] = { name: category, value: 0 };
        }
        acc[category].value += Math.abs(transaction.amount);
      }
      return acc;
    }, {});

    return Object.values(categoryTotals);
  };

  const [selectedMonths, setSelectedMonths] = useState(availableMonths);
  useEffect(() => {
    const availableMonthstemp = Object.keys(monthsData).sort((a, b) => {
      const dateA = getMonthDate(a);
      const dateB = getMonthDate(b);
      return dateA - dateB;
    });

    setAvailableMonths(availableMonthstemp);

    // Ensure selectedMonths only updates if it's empty (prevents forced re-selection)
    if (selectedMonths.length === 0) {
      setSelectedMonths(availableMonthstemp);
    }

  }, [monthsData,]);

  const filteredData = selectedMonths
    .flatMap((month) => {
      const dailyData = processDailyData(monthsData[month]);
      return Object.values(dailyData);
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date));


  const creditVsdebit = selectedMonths
    .flatMap((month) => {
      const dailyData = processCreditDebitData(monthsData[month]);
      return Object.values(dailyData);
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const categoryData = processCategoryData(
    selectedMonths.flatMap((month) => monthsData[month])
  );

  return (
    <div className="rounded-lg space-y-6 m-8 mt-2">
      {isLoading ? (
        <div className="bg-gray-100 p-4 rounded-md w-full h-[10vh]">
          <p className="text-gray-800 text-center mt-3 font-medium text-lg">
            Loading...
          </p>
        </div>
      ) : error ? (
        <div className="bg-red-100 p-4 rounded-md w-full h-[10vh]">
          <p className="text-red-800 text-center mt-3 font-medium text-lg">
            {error}
          </p>
        </div>
      ) : transactionData.length === 0 ? (
        <div className="bg-gray-100 p-4 rounded-md w-full h-[10vh]">
          <p className="text-gray-800 text-center mt-3 font-medium text-lg">
            No Data Available
          </p>
        </div>
      ) : (
        <>
          <ToggleStrip
            columns={availableMonths}
            selectedColumns={selectedMonths}
            setSelectedColumns={setSelectedMonths}
          />

          {selectedMonths.length === 0 ? (
            <div className="text-center text-gray-600 dark:text-gray-400 my-6">
              Select months to display the graphs
            </div>
          ) : (
            <>
              {/* <div className="flex flex-wrap -mx-2">
                <MaximizableChart
                  title="Daily Balance Trend"
                  isMaximized={isDailyBalanceMaximized}
                  setIsMaximized={setIsDailyBalanceMaximized}
                >
                  <div className="w-full h-full">
                    <SingleLineChart
                      data={filteredData}
                      xAxisKey="date"
                      selectedColumns={["balance"]}
                      showLegends={isDailyBalanceMaximized}
                    />
                  </div>
                </MaximizableChart>

                <MaximizableChart
                  title="Credit vs Debit"
                  isMaximized={isCreditDebitMaximized}
                  setIsMaximized={setIsCreditDebitMaximized}
                >
                  <div className="w-full h-full">
                    <SingleBarChart
                      data={creditVsdebit}
                      xAxis={{ key: "date" }}
                      yAxis={[
                        {
                          key: "credit",
                          type: "bar",
                          color: "hsl(var(--chart-3))",
                        },
                        {
                          key: "debit",
                          type: "line",
                          color: "hsl(var(--chart-5))",
                        },
                      ]}
                      showLegends={isCreditDebitMaximized}
                    />
                  </div>
                </MaximizableChart>

                <MaximizableChart
                  title="Debit Distribution by Category"
                  isMaximized={isCategoryMaximized}
                  setIsMaximized={setIsCategoryMaximized}
                >
                  <div className="w-full h-full">
                    <PieCharts
                      data={categoryData}
                      nameKey="name"
                      valueKey="value"
                      showLegends={isCategoryMaximized}
                    />
                  </div>
                </MaximizableChart>
              </div> */}

              <CategoryEditTable
                data={filteredData}
                categoryOptions={categoryOptions}
                setCategoryOptions={setCategoryOptions}
                caseId={parseInt(caseId)}
              />
            </>
          )}
        </>
      )}
    </div>
  );
};

export default Transactions;
