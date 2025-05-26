import React, { useState, useEffect } from "react";
import BarLineChart from "../charts/BarLineChart";
import UnifiedTable from "./UnifiedTable";
import ToggleStrip from "./ToggleStrip";
import { useParams } from "react-router-dom";
import InvestmentTransactionDialog from "./InvestmentTransactionDialog";
// import investementData from "../../data/investment.json";
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '../ui/table';

const Investment = () => {
  const [data, setData] = useState([]);
  const [investmentSummary, setInvestmentSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const { caseId, individualId } = useParams();
  const [availableMonths, setAvailableMonths] = useState([]);
  const [selectedMonths, setSelectedMonths] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedInvestment, setSelectedInvestment] = useState(null);

  // Helper function to get month key
  const getMonthKey = (dateString) => {
    const date = new Date(dateString);
    return `${date.toLocaleString("en-GB", { month: "short" })}-${date.getFullYear()}`;
  };

  // Helper function to parse month string to Date
  const getMonthDate = (monthStr) => {
    const [month, year] = monthStr.split("-");
    const monthIndex = new Date(Date.parse(month + " 1, 2000")).getMonth();
    return new Date(parseInt(year), monthIndex);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch transactions filtered by "debtor"
      const result = await window.electron.getTransactionsByInvestment(
        caseId,
        parseInt(individualId)
      );
      // console.log("Investment transactions:", result);
      // Transform data to include only required fields
      const transformedData = result.map((item) => ({
        date: new Date(item.date).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }),
        description: item.description,
        debit: item.amount,
        balance: item.balance,
        category: item.category,
        monthKey: getMonthKey(item.date),
        id: item.id,
      }));

      const groupedInvestment = processInvestmentSummary(transformedData);
      setInvestmentSummary(groupedInvestment);

      const uniqueMonths = [...new Set(transformedData.map(item => item.monthKey))]
        .sort((a, b) => {
          const dateA = getMonthDate(a);
          const dateB = getMonthDate(b);
          return dateA - dateB;
        });
      setData(transformedData);
      setAvailableMonths(uniqueMonths);

      // Initially select all months
      setSelectedMonths(uniqueMonths);
    } catch (error) {
      console.error("Error fetching emi transactions:", error);
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {


    fetchData();
  }, []);

  const processInvestmentSummary = (transactions) => {
    const grouped = [];
    const threshold = 0.7;

    transactions.forEach((transaction) => {
      const existing = grouped.find(
        (item) =>
          item.amount === transaction.debit &&
          similarity(item.description, transaction.description) >= threshold
      );

      if (existing) {
        existing.frequency++;
      } else {
        grouped.push({
          description: transaction.description,
          amount: transaction.debit,
          frequency: 1,
        });
      }
    });

    // Return grouped without filtering, as unique entries should have frequency 1
    return grouped;
  };

  const similarity = (str1, str2) => {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();
    const match = [...s1].filter((char) => s2.includes(char)).length;
    return match / Math.max(s1.length, s2.length);
  };

  const filteredData = data.filter(item =>
    selectedMonths.includes(item.monthKey)
  );

  // Transform data for chart to show monthly aggregates
  const getChartData = () => {
    const monthlyData = {};

    filteredData.forEach(item => {
      if (!monthlyData[item.monthKey]) {
        monthlyData[item.monthKey] = {
          date: item.monthKey, // Using monthKey as date for x-axis
          debit: 0
        };
      }
      monthlyData[item.monthKey].debit += item.debit;
    });

    return Object.values(monthlyData).sort((a, b) => {
      const dateA = getMonthDate(a.date);
      const dateB = getMonthDate(b.date);
      return dateA - dateB;
    });
  };


  const handleInvestmentRowClick = (investment) => {
    setSelectedInvestment(investment);
    setDialogOpen(true);
  };



  if (loading) {
    return (
      <div className="bg-gray-100 p-4 rounded-md w-full h-[10vh]">
        <p className="text-gray-800 text-center mt-3 font-medium text-lg">
          Loading...
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg space-y-6 m-8 pr-16 mt-2 min-w-full max-w-[0] dark:bg-slate-950">
      {data.length === 0 ? (
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
              Select months to view data
            </div>
          ) : (
            <>
              <div className="w-full h-[60vh]">
                <BarLineChart
                  data={getChartData()}
                  title="Investment"
                  xAxisKey="date"
                  yAxisKey="debit"
                />
              </div>
              <div>
                {/* <UnifiedTable data={investmentSummary} title="Investment Summary"
                  caseId={caseId}
                /> */}
                <Card>
                  <CardHeader>
                    <CardTitle>Investment Summary</CardTitle>
                    <p className="text-sm text-gray-500">View and manage your data</p>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Description</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Frequency</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {investmentSummary.map((investment, index) => (
                            <TableRow
                              key={index}
                              className="cursor-pointer hover:bg-gray-50"
                              onClick={() => handleInvestmentRowClick(investment)}
                            >
                              <TableCell>{investment.description}</TableCell>
                              <TableCell>{investment.amount}</TableCell>
                              <TableCell>{investment.frequency}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="bg-gray-50 font-medium">
                            <TableCell>Total</TableCell>
                            <TableCell>{investmentSummary.reduce((sum, item) => sum + item.amount, 0)}</TableCell>
                            <TableCell>{investmentSummary.reduce((sum, item) => sum + item.frequency, 0)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </div>
              <div>
                <UnifiedTable data={filteredData} title="Investment Transactions"
                  caseId={caseId}
                  refreshFunction={fetchData}
                />
              </div>
              <InvestmentTransactionDialog
                isOpen={dialogOpen}
                onClose={() => setDialogOpen(false)}
                selectedInvestment={selectedInvestment}
                transactions={filteredData}
              />
            </>
          )}
        </>
      )}
    </div>
  );
};

export default Investment;
