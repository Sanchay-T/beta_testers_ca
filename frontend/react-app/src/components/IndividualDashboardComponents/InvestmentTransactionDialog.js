import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,

} from "../ui/dialog";
import DataTable from './UnifiedTable';

const InvestmentTransactionDialog = ({ isOpen, onClose, selectedInvestment, transactions }) => {
    const [filteredTransactions, setFilteredTransactions] = useState([]);


    useEffect(() => {
        if (selectedInvestment && transactions) {
            const filtered = transactions.filter(transaction =>
                transaction.debit === selectedInvestment.amount
            );

            setFilteredTransactions(filtered);
        }
    }, [selectedInvestment, transactions]);


    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
                <DataTable
                    data={filteredTransactions}
                    title="Investment Transactions"
                />
            </DialogContent>
        </Dialog>
    );
};

export default InvestmentTransactionDialog;