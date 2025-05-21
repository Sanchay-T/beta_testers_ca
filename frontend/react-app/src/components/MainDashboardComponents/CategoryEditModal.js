import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import UnifiedTable from "../IndividualDashboardComponents/UnifiedTable";

const CategoryEditModal = ({ open, onOpenChange, caseId, caseName }) => {
  const [transactionData, setTransactionData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const processDailyData = (transactions) => {
    return transactions.map((transaction) => ({
      date: transaction.date,
      description: transaction.description,
      debit:
        transaction.type.toLowerCase() === "debit" ? transaction.amount : 0,
      credit:
        transaction.type.toLowerCase() === "credit" ? transaction.amount : 0,

      balance: transaction.balance,
      category: transaction.category,
      // entity: transaction.entity,
      ledger: transaction.ledger,
      voucher_type: transaction.voucher_type,
      bank: transaction.bank,
      id: transaction.id,
    }));
  };

  const fetchTransactions = async () => {
    try {
      setIsLoading(true);
      // Add this line to debug the electron call
      const data = await window.electron.getTransactions(caseId);

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
        ledger:
          transaction.entity === "unknown"
            ? transaction.category
            : transaction.entity,
        type: transaction.type,
        balance: transaction.balance,
        bank: transaction.bank,
        id: transaction.id,
        voucher_type: transaction.voucher_type,
      }));

      const processedData = processDailyData(formattedData);
      setTransactionData(processedData);
    } catch (err) {
      setError("Failed to fetch transactions");
      console.error("Error fetching transactions:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [caseId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="min-w-[90vw] h-[95vh] flex flex-col">
        <DialogHeader>
          {/* <DialogTitle>Transactions</DialogTitle> */}
        </DialogHeader>
        <div className="overflow-auto flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <p>Loading transactions...</p>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64 text-red-500">
              <p>{error}</p>
            </div>
          ) : (
            <UnifiedTable
              data={transactionData}
              title={`${caseName} Transactions`}
              caseId={parseInt(caseId)}
              refreshFunction={fetchTransactions}
              source="categoryEditModal"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CategoryEditModal;
