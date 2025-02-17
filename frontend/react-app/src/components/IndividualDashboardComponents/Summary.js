import React, { useState, useMemo, useEffect } from "react";
import PieCharts from "../charts/PieCharts";
import { Card, CardHeader, CardTitle } from "../ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Maximize2, Minimize2 } from "lucide-react";
import SummaryTable from "./SummaryTable";
import DataTable from "./TableData";
import { useParams } from "react-router-dom";
import { useReportContext } from "../../contexts/ReportContext";


const formatDecimal = (value) => {
  return Number(parseFloat(value || 0).toFixed(2));
};
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
            className="absolute top-1 right-3 p-1 rounded-lg bg-slate-100 dark:bg-slate-800"
          >
            {isMaximized ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
        </CardHeader>
        {children}
      </Card>
    </div>
  );
};

const Summary = () => {
const { reportData, updateReportData } = useReportContext();

  // const [activeTable, setActiveTable] = useState("Income Receipts");
  const [summaryData, setSummaryData] = useState({
    Particulars: [],
    "Income Receipts": [],
    "Important Expenses": [],
    "Other Expenses": [],
    "Contra Debit": [],
    "Contra Credit": [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const {
    Particulars: particulars,
    "Income Receipts": incomeReceipts,
    "Important Expenses": importantExpenses,
    "Other Expenses": otherExpenses,
    "Contra Debit": contraDebit,
    "Contra Credit": contraCredit,
  } = summaryData;

  const [incomeMaximized, setIncomeMaximized] = useState(false);
  const [importantExpensesMaximized, setImportantExpensesMaximized] =
    useState(false);
  const [otherExpensesMaximized, setOtherExpensesMaximized] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [transactionData, setTransactionData] = useState([]);
  const {individualId,caseId } = useParams();

  useEffect(() => {
    const fetchSummaryData = async () => {
      if (!caseId) return;

      try {
        // console.log("Fetching summary data for caseId:", caseId);
        const result = await window.electron.getSummary(caseId,individualId);
        console.log("result", result);
        const parsedData = result.length > 0 ? JSON.parse(result[0].data) : {};
        console.log("parsedData", parsedData);
        const transactions = await window.electron.getTransactions(
          caseId,
          parseInt(individualId)
        );
        // console.log("transactions", transactions.length);

        const formatData = (data) => {
          return data.map((item) => {
            const formattedItem = { ...item };
            Object.keys(formattedItem).forEach((key) => {
              if (typeof formattedItem[key] === "number") {
                formattedItem[key] = formatDecimal(formattedItem[key]);
              }
            });
            return formattedItem;
          });
        };
        console.log("aiyaz",individualId, typeof individualId)
        
        if(individualId && individualId!=="undefined" && individualId!==undefined ){
          setSummaryData({
            Particulars: formatData(parsedData.Particulars || []),
            "Income Receipts": formatData(parsedData["Income Receipts"] || []),
            "Important Expenses": formatData(parsedData["Important Expenses"] || []),
            "Other Expenses": formatData(parsedData["Other Expenses"] || []),
            "Contra Debit": formatData(parsedData["Contra Debit"] || []), 
            "Contra Credit": formatData(parsedData["Contra Credit"] || []), 
          });

        }else{
        setSummaryData({
          Particulars: formatData(parsedData.particulars || []),
          "Income Receipts": formatData(parsedData.incomeReceipts || []),
          "Important Expenses": formatData(parsedData.importantExpenses || []),
          "Other Expenses": formatData(parsedData.otherExpenses || []),
          "Contra Debit": formatData(parsedData.contraDebit || []),
          "Contra Credit": formatData(parsedData.contraCredit || []),
        });
      }

        setTransactionData(transactions);
      } catch (error) {
        console.error("Error fetching summary data:", error);
        setError(error);
        setSummaryData({
          Particulars: [],
          "Income Receipts": [],
          "Important Expenses": [],
          "Other Expenses": [],
          "Contra Credit":[],
          "Contra Debit":[]
        });
        setTransactionData([]);
      } finally {
        setIsLoading(false);
      }
    };

    if (caseId) fetchSummaryData();
  }, [caseId]);

  const monthOrder = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const [selectedMonths, setSelectedMonths] = useState([]);
  const months = useMemo(() => {
    const allMonths = new Set();
    [particulars, incomeReceipts, importantExpenses, otherExpenses,contraDebit,contraCredit].forEach(
      (category) => {
        category.forEach((item) => {
          Object.keys(item).forEach((key) => {
            if (
              ![
                "Total",
                "Particulars",
                "Income / Receipts",
                "Important Expenses / Payments",
                "Other Expenses / Payments",
              ].includes(key)
            ) {
              allMonths.add(key);
            }
          });
        });
      }
    );

    return Array.from(allMonths).sort(
      (a, b) => monthOrder.indexOf(a) - monthOrder.indexOf(b)
    );
  }, [incomeReceipts, importantExpenses, otherExpenses,particulars,contraCredit,contraDebit]);

  useEffect(() => {
    if (months.length > 0) {
      setSelectedMonths(months);
    }
  }, [months]);

  const transformData = (data, valueKey, nameKey, excludeName) => {
    if (selectedMonths.length === 0) {
      return data
        .filter((item) => item[nameKey] !== excludeName)
        .map((item) => ({
          name: item[nameKey],
          value: formatDecimal(item[valueKey] || 0),
        }))
        .filter((item) => item.value > 0);
    }

    return data
      .filter((item) => item[nameKey] !== excludeName)
      .map((item) => ({
        name: item[nameKey],
        value: formatDecimal(
          selectedMonths.reduce(
            (sum, month) => sum + parseFloat(item[month] || 0),
            0
          )
        ),
      }))
      .filter((item) => item.value > 0);
  };
  // console.log("other expenses",otherExpenses);
  const particularsData = transformData(
    particulars,
    "Total",
    "Particulars",
    "Total"
  );
  const incomeData = transformData(
    incomeReceipts,
    "Total",
    "Income / Receipts",
    "Total Credit"
  );

  const importantExpensesData = transformData(
    importantExpenses,
    "Total",
    "Important Expenses / Payments",
    "Total"
  );
  const otherExpensesData = transformData(
    otherExpenses,
    "Total",
    "Other Expenses / Payments",
    "Total Debit"
  );

  const handlePieClick = (data) => {
    const categoryName = data.name.trim().toLowerCase();
    
    const matchingTransactions = transactionData.filter(transaction => {
      if (!transaction || !transaction.category) return false;
      const transactionCategory = transaction.category.trim().toLowerCase();
      const amount = parseFloat(transaction.amount || 0);

      const isIncome = summaryData["Income Receipts"].some(item => item["Income / Receipts"]?.trim().toLowerCase() === categoryName);
      const isImportantExpense = summaryData["Important Expenses"].some(item => item["Important Expenses / Payments"]?.trim().toLowerCase() === categoryName);
      const isOtherExpense = summaryData["Other Expenses"].some(item => item["Other Expenses / Payments"]?.trim().toLowerCase() === categoryName);

      if (isIncome) return transactionCategory === categoryName && amount > 0;
      if (isImportantExpense || isOtherExpense) return transactionCategory === categoryName && amount > 0;
      
      return false;
    });

    const formattedTransactions = matchingTransactions.map(transaction => ({
      date: transaction.date ? new Date(transaction.date).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }) : '',
      description: transaction.description || '',
      amount: Math.abs(parseFloat(transaction.amount || 0)),
      category: transaction.category || '',
      balance: parseFloat(transaction.balance || 0),
      bank: transaction.bank || '',
      entity: transaction.entity || 'unknown'
    }));

    setSelectedCategory(categoryName);
    setFilteredTransactions(formattedTransactions);
  };
  
  const renderChart = (data, title, isMaximized, setIsMaximized) => {
    return (
      <MaximizableChart
        title={title}
        isMaximized={isMaximized}
        setIsMaximized={setIsMaximized}
        
      >
        <div className="w-full p-4">
          {data.length > 0 ? (
            <PieCharts
              onPieClick={handlePieClick}
              source="summary"
              data={data}
              title=""
              valueKey="value"
              nameKey="name"
              showLegends={isMaximized}
            />
          ) : (
            // {!isMaximized && (
            //   <Button
            //     onClick={() => setActiveTable(tableType)}
            //     variant={activeTable === tableType ? "default" : "outline"}
            //     className={`mt-4 w-full ${
            //       activeTable === tableType ? "dark:bg-slate-300" : ""
            //     }`}
            //   >
            //     View Table
            //   </Button>
            // )}
            <div className="flex items-center justify-center h-48">
              <p className="text-gray-500 dark:text-gray-400">
                No Data Available
              </p>
            </div>
          )}
        </div>
      </MaximizableChart>
    );
  };

  return (
    <div className="bg-white rounded-lg space-y-6 m-8 mt-2 dark:bg-slate-950 w-[80vw]">
      {/* <ToggleStrip
        columns={mon</div>ths}
        selectedColumns={selectedMonths}
        setSelectedColumns={setSelectedMonths}
      />
      {selectedMonths.length === 0 ? (
        <div className="text-center text-gray-600 dark:text-gray-400 my-6">
          Select months to display the graphs
        </div>
      ) : (
        <> */}
      <div className="flex flex-wrap -mx-2">
        {renderChart(
          incomeData,
          "Income / Receipts",
          incomeMaximized,
          setIncomeMaximized,
          "Income / Receipts"
        )}
        {renderChart(
          importantExpensesData,
          "Important Expenses",
          importantExpensesMaximized,
          setImportantExpensesMaximized,
          "Important Expenses"
        )}
        {renderChart(
          otherExpensesData,
          "Other Expenses",
          otherExpensesMaximized,
          setOtherExpensesMaximized,
          "Other Expenses"
        )}
      </div>
      <Dialog
        open={!!selectedCategory}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setSelectedCategory(null);
            setFilteredTransactions([]);
          }
        }}
      >
        {selectedCategory && filteredTransactions.length > 0 ? (
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader></DialogHeader>
            <DataTable
              data={filteredTransactions}
              title={`Transactions Details: ${selectedCategory}`}
            />
          </DialogContent>
        ) : (
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>No Transactions</DialogTitle>
            </DialogHeader>
            <div className="bg-gray-100 p-4 rounded-md w-full h-[10vh]">
              <p className="text-gray-800 text-center mt-3 font-medium text-base">
                No data Available for this category
              </p>
            </div>
          </DialogContent>
        )}
      </Dialog>
      <div className="space-y-6">
        <SummaryTable
          source="particulars"
          data={particulars}
          title="Particulars"
          categoryKey="Particulars"
        />
        <SummaryTable
          data={incomeReceipts}
          title="Income Receipts"
          categoryKey="Income / Receipts"
        />
        <SummaryTable
          data={importantExpenses}
          title="Important Expenses"
          categoryKey="Important Expenses / Payments"
        />
        <SummaryTable
          data={otherExpenses}
          title="Other Expenses"
          categoryKey="Other Expenses / Payments"
        />
          <SummaryTable
          data={contraCredit}
          title="Contra Credit"
          categoryKey="Contra Credit"
        />
          <SummaryTable
          data={contraDebit}
          title="Contra Debit"
          categoryKey="Contra Debit"
        />
        
      </div>
    </div>
  );
};

export default Summary;
