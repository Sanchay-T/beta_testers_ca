import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import UnifiedTable from "../IndividualDashboardComponents/UnifiedTable";

const CategoryEditModal = ({ open, onOpenChange, caseId }) => {
  const [transactionData, setTransactionData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);


  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        console.log("Fetching transactions for statementId:", caseId);

        // Add this line to debug the electron call
        console.log("Before electron call");
        const data = await window.electron.getTransactions(caseId);
        console.log("After electron call, received data:", data);

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

      setIsLoading(true);
      fetchTransactions();
      setIsLoading(false);
  }, [caseId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="min-w-[90vw] h-[95vh] flex flex-col">
        <DialogHeader>
          {/* <DialogTitle>Transactions</DialogTitle> */}
        </DialogHeader>
        <div className="overflow-auto flex-1">
          
          <UnifiedTable
            data={transactionData}
            title="Transactions"
            caseId={parseInt(caseId)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CategoryEditModal;
