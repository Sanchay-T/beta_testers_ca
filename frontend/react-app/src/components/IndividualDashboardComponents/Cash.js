import React, { useState, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import BarLineChart from "../charts/BarLineChart";
import UnifiedTable from "./UnifiedTable";
import { useParams } from "react-router-dom";

const Cash = () => {
  const [withdrawalData, setWithdrawalData] = useState([]);
  const [depositData, setDepositData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const { caseId, individualId } = useParams();
  console.log("in cash", caseId, individualId);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const withdrawalResponse =
          await window.electron.getTransactionsByCashWithdrawal(
            caseId,
            parseInt(individualId)
          );
        const depositResponse =
          await window.electron.getTransactionsByCashDeposit(
            caseId,
            parseInt(individualId)
          );

        // Transform withdrawal data
        const transformedWithdrawalData = withdrawalResponse.map((item) => ({
          date: new Date(item.date).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          }),
          Description: item.description,
          Debit: Math.abs(item.amount) || 0, // Ensure positive value
          Balance: item.balance || 0,
          category: item.category || "-",
        }));

        // Transform deposit data
        const transformedDepositData = depositResponse.map((item) => ({
          date: new Date(item.date).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          }),
          Description: item.description,
          Credit: item.amount || 0,
          Balance: item.balance || 0,
          category: item.category || "-",

        }));

        setWithdrawalData(transformedWithdrawalData);
        setDepositData(transformedDepositData);
        setIsLoading(false);
      } catch (err) {
        console.error("Error fetching cash transactions:", err);
        setError("Failed to fetch transaction data");
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  console.log("Withdrawal data:", withdrawalData);
  console.log("Deposit data:", depositData);

  const chartConfig = {
    yAxis: {
      min: 0,
      max: 40000,
      ticks: [0, 9000, 18000, 27000, 36000],
    },
  };

  const columnTypes = {
    Debit: "bar",
    Credit: "bar",
    Balance: "line",
  };

  if (isLoading) {
    return (
      <div className="rounded-xl shadow-sm m-8 mt-2 space-y-6">
        <div className="bg-gray-100 p-4 rounded-md w-full h-[10vh]">
          <p className="text-gray-800 text-center mt-3 font-medium text-lg">
            Loading...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl shadow-sm m-8 mt-2 space-y-6">
        <div className="bg-red-100 p-4 rounded-md w-full h-[10vh]">
          <p className="text-red-800 text-center mt-3 font-medium text-lg">
            {error}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl shadow-sm m-8 mt-2 space-y-6">
      <Tabs defaultValue="withdrawal">
        <TabsList className="grid w-[500px] grid-cols-2 pb-10">
          <TabsTrigger value="withdrawal">Withdrawal</TabsTrigger>
          <TabsTrigger value="deposit">Deposit</TabsTrigger>
        </TabsList>

        <TabsContent value="withdrawal">
          {withdrawalData.length === 0 ? (
            <div className="bg-gray-100 p-4 rounded-md w-full h-[10vh]">
              <p className="text-gray-800 text-center mt-3 font-medium text-lg">
                No Data Available
              </p>
            </div>
          ) : (
            <>
              <div className="mb-6 w-full h-[60vh]">
                <BarLineChart
                  data={withdrawalData}
                  xAxisKey="date"
                  columnTypes={columnTypes}
                  config={chartConfig}
                />
              </div>
              <div>
                <UnifiedTable
                  data={withdrawalData}
                  title="Cash Widthdrawal Transactions"
                />
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="deposit">
          {depositData.length === 0 ? (
            <div className="bg-gray-100 p-4 rounded-md w-full h-[10vh]">
              <p className="text-gray-800 text-center mt-3 font-medium text-lg">
                No Data Available
              </p>
            </div>
          ) : (
            <>
              <div className="mb-6 w-full h-[60vh]">
                <BarLineChart
                  data={depositData}
                  xAxisKey="date"
                  columnTypes={columnTypes}
                  config={chartConfig}
                />
              </div>
              <div>
                <UnifiedTable data={depositData} title="Cash Deposit Transactions" />
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Cash;
