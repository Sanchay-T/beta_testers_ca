import React, { useState, useEffect } from "react";
import ToggleStrip from "./ToggleStrip";
import { useParams } from "react-router-dom";
import UnifiedTable from "../IndividualDashboardComponents/UnifiedTable";



const Transactions = () => {
  const [transactionData, setTransactionData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [availableMonths, setAvailableMonths] = useState([]);
  const { caseId, individualId } = useParams();

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
          id:transaction.id,
          voucher_type: transaction.voucher_type,
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
      const [day, month, year] = transaction.date.split("/").map(Number);
      const date = new Date(year, month - 1, day); // month is zero-based in JS
      if (isNaN(date.getTime())) {
        console.warn("Invalid date detected:", transaction.date);
        return acc; // Skip invalid dates
    }



      const monthKey = `${date.toLocaleString("en-GB", {
        month: "short",
      })}-${date.getFullYear()}`;


      if (!acc[monthKey]) {
        acc[monthKey] = [];
      }

      const standardizedTransaction = {
        date: transaction.date,
        description: transaction.description,
        amount: transaction.amount,
        balance: transaction.balance,
        category: transaction.category,
        bank: transaction.bank,
        // entity: transaction.entity,
        type: transaction.type,
        id:transaction.id,
        voucher_type: transaction.voucher_type,
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
      date: transaction.date,
      description: transaction.description,
      credit:
        transaction.type.toLowerCase() === "credit" ? transaction.amount : 0,
      debit:
        transaction.type.toLowerCase() === "debit" ? transaction.amount : 0,
      balance: transaction.balance,
      category: transaction.category,
      bank: transaction.bank,
      id:transaction.id,
      voucher_type: transaction.voucher_type,
      // entity: transaction.entity,
    }));
  };

  // print the processed data

  

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

  }, [monthsData]);



  const filteredData = selectedMonths
    .flatMap((month) => {
      const dailyData = processDailyData(monthsData[month]);
      return Object.values(dailyData);
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date));

    useEffect(() => {
      console.log({filteredData})
    }, [filteredData]);
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

              <UnifiedTable
                data={filteredData}
                title="Transactions"
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
