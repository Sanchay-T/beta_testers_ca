import React, { useState, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import BarLineChart from "../charts/BarLineChart";
import UnifiedTable from "./UnifiedTable";
import { useParams } from "react-router-dom";

const Upi = () => {
  const [upiCrData, setUpiCrData] = useState([]);
  const [upiDrData, setUpiDrData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const { caseId, individualId } = useParams();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const crResponse = await window.electron.getTransactionsByUpiCr(
          caseId,
          parseInt(individualId)
        );
        const drResponse = await window.electron.getTransactionsByUpiDr(
          caseId,
          parseInt(individualId)
        );

        // Transform UPI-Cr data
        const transformedUpiCrData = crResponse.map((item) => ({
          date: new Date(item.date).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          }),
          Description: item.description,
          Credit: item.amount || 0,
          Balance: item.balance || 0,
          category:item.category|| '-',
          entity:item.entity|| '-',
          id:item.id,

        }));

        // Transform UPI-Dr data
        const transformedUpiDrData = drResponse.map((item) => ({
          date: new Date(item.date).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          }),
          Description: item.description,
          Debit: Math.abs(item.amount) || 0, // Ensure positive value
          Balance: item.balance || 0,
          category:item.category|| '-',
          entity:item.entity || '-',
          transactionId:item.id

        }));

        setUpiCrData(transformedUpiCrData);
        setUpiDrData(transformedUpiDrData);
        setIsLoading(false);
      } catch (err) {
        console.error("Error fetching UPI transactions:", err);
        setError("Failed to fetch UPI transaction data");
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

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
      <Tabs defaultValue="upi-cr">
        <TabsList className="grid w-[500px] grid-cols-2 pb-10">
          <TabsTrigger value="upi-cr">UPI-Cr</TabsTrigger>
          <TabsTrigger value="upi-dr">UPI-Dr</TabsTrigger>
        </TabsList>

        <TabsContent value="upi-cr">
          {upiCrData.length === 0 ? (
            <div className="bg-gray-100 p-4 rounded-md w-full h-[10vh]">
              <p className="text-gray-800 text-center mt-3 font-medium text-lg">
                No Data Available
              </p>
            </div>
          ) : (
            <>
              <div className="mb-6 w-full h-[60vh]">
                <BarLineChart
                  data={upiCrData}
                  xAxisKey="date"
                  columnTypes={columnTypes}
                  config={chartConfig}
                />
              </div>
              <div>
                <UnifiedTable data={upiCrData} title="UPI Credit Transactions" />
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="upi-dr">
          {upiDrData.length === 0 ? (
            <div className="bg-gray-100 p-4 rounded-md w-full h-[10vh]">
              <p className="text-gray-800 text-center mt-3 font-medium text-lg">
                No Data Available
              </p>
            </div>
          ) : (
            <>
              <div className="mb-6 w-full h-[60vh]">
                <BarLineChart
                  data={upiDrData}
                  xAxisKey="date"
                  columnTypes={columnTypes}
                  config={chartConfig}
                />
              </div>
              <div>
                <UnifiedTable data={upiDrData} title="UPI Debit Transactions" />
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Upi;
