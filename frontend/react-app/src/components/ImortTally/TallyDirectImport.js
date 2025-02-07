import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Ambulance, Loader2 } from "lucide-react";
import TallyTable from "./TallyTable";

const TallyDirectImport = ({caseId}) => {
  const [vouchers, setVouchers] = useState(["Payment Receipt Voucher", "Contra Voucher"]);
  const [selectedVoucher, setSelectedVoucher] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch available vouchers
  useEffect(() => {
    async function fetchVouchersTransactions() {
      try {
        const data = await window.electron.getTransactions(caseId); // Fetch vouchers from Electron API
        console.log({aq:data});
         const formattedData = data.map((transaction) => ({
          
          date: new Date(transaction.date).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          }),
          effective_date: "",
          bill_ref:"",
          dr_ledger: transaction.type==="debit" ? (transaction.entity!=="unknown"?transaction.entity:transaction.category):"",
          cr_ledger:transaction.type==="credit" ? (transaction.entity!=="unknown"?transaction.entity:transaction.category):"",
          amount:transaction.amount,
          // voucher_type:transaction.voucher_type,
          voucher_type:transaction.type==="debit" ? "Payment Voucher":"Receipt Voucher",
          narration:transaction.description,
          id:transaction.id,

        }));
        setTransactions(formattedData);
        setSelectedVoucher("Payment Receipt Voucher");
      } catch (err) {
        console.error("Error fetching transactions:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchVouchersTransactions();
  }, []);

  // Fetch transactions for selected voucher
  const handleVoucherChange = async (voucherId) => {
    setSelectedVoucher(voucherId);
    setLoading(true);
    try {
      const response = await window.electron.getVoucherTransactions(voucherId);
      if (!response.success) throw new Error(response.message);
      setTransactions(response.data);
    } catch (err) {
      console.error("Error fetching transactions:", err);
    }
    setLoading(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg font-semibold">{`Tally ${selectedVoucher} Transactions`}</CardTitle>
          <div className="flex gap-4">
            <Select onValueChange={handleVoucherChange} value={selectedVoucher}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select a Voucher" />
              </SelectTrigger>
              <SelectContent>
                {vouchers.map((voucher) => (
                  <SelectItem key={voucher} value={voucher}>
                    {voucher}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        ) : transactions.length > 0 ? (
          <TallyTable data={transactions} title={" "} subtitle={" "}/>
        ) : (
          <div className="text-center py-6 text-gray-500">No transactions available</div>
        )}
      </CardContent>
    </Card>
  );
}

export default TallyDirectImport