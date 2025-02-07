import React, { useEffect, useState } from "react";
import { cn } from "../lib/utils";
import { ScrollArea } from "../components/ui/scroll-area";
import Sidebar from "../components/Sidebar";
import Summary from "../components/IndividualDashboardComponents/Summary";
import Transactions from "../components/IndividualDashboardComponents/Transactions";
import Cash from "../components/IndividualDashboardComponents/Cash";
import Suspense from "../components/IndividualDashboardComponents/Suspense";
import { useBreadcrumb } from "../contexts/BreadcrumbContext";
import { useParams } from "react-router-dom";
import { BreadcrumbDynamic } from "../components/BreadCrumb";
import Debtors from "../components/IndividualDashboardComponents/Debtors";
import Creditors from "../components/IndividualDashboardComponents/Creditors";
import EMI from "../components/IndividualDashboardComponents/EMI";
import Investment from "../components/IndividualDashboardComponents/Investment";
import EodBalance from "../components/IndividualDashboardComponents/EodBalance";
import Reversal from "../components/IndividualDashboardComponents/Reversal";
import ForeignTransactions from "../components/IndividualDashboardComponents/ForeignTransactions";
import Upi from "../components/IndividualDashboardComponents/Upi";
import {
  ArrowDownWideNarrow,
  ArrowRightLeft,
  ArrowUpNarrowWide,
  ChartNoAxesCombined,
  ClipboardList,
  FileQuestion,
  History,
  IndianRupee,
  MessageSquareText,
  ScanLine,
  Undo2,
} from "lucide-react";

const IndividualDashboard = () => {
  const [activeTab, setActiveTab] = useState("Summary");
  const { breadcrumbs, setIndividualDashboard } = useBreadcrumb();
  const { caseId, individualId, defaultTab } = useParams();
  const [customerName, setCustomerName] = useState(null);

  useEffect(() => {
    setIndividualDashboard(
      activeTab,
      `/individual-dashboard/${caseId}/${individualId}/${activeTab}`
    );

    console.log(
      "CaseId : ",
      caseId,
      "Default Tab : ",
      defaultTab,
      " activetab",
      activeTab
    );
  }, [activeTab]);

  useEffect(() => {
    const fetchCustomerName = async () => {
      try {
        const customerName = await window.electron.getCustomerName(
          individualId
        );
        console.log("Customer name fetched successfully:", customerName);
        if (customerName) {
          setCustomerName(customerName);
        }
      } catch (error) {
        console.error("Error fetching customer name:", error);
      }
    };

    if (individualId) {
      // Only fetch if we have an ID
      fetchCustomerName();
    }
  }, [individualId]);

  useEffect(() => {
    console.log({ caseId, individualId, defaultTab });
  }, []);

  const navItems = [
    {
      title: "Summary",
      icon: ClipboardList,
      isActive: true,
    },
    {
      title: "Transactions",
      icon: ArrowRightLeft,
    },
    {
      title: "Debtors",
      url: "#",
      icon: ArrowUpNarrowWide,
    },
    {
      title: "Creditors",
      icon: ArrowDownWideNarrow,
    },
    {
      title: "UPI",
      icon: ScanLine,
    },
    {
      title: "Cash",
      icon: IndianRupee,
    },
    {
      title: "EMI",
      icon: MessageSquareText,
    },
    {
      title: "Investment",
      url: "#",
      icon: ChartNoAxesCombined,
    },
    {
      title: "Reversal",
      url: "#",
      icon: Undo2,
    },
    {
      title: "Suspense",
      icon: FileQuestion,
    },
    {
      title: "EOD",
      icon: History,
    },
  ];

  useEffect(() => {
    if (defaultTab === "defaultTab") setActiveTab(navItems[0].title);
    else setActiveTab(defaultTab);
  }, []);

  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    const scrollableNode = document.querySelector(
      "[data-radix-scroll-area-viewport]"
    );
    if (scrollableNode) {
      scrollableNode.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <>
      <div className={cn("w-full flex h-screen bg-background")}>
        <Sidebar
          navItems={navItems}
          activeTab={activeTab}
          setActiveTab={handleTabChange}
          name={customerName}
        />
        <ScrollArea className="w-full">
          <BreadcrumbDynamic items={breadcrumbs} />
          <div className="flex-1 flex flex-col overflow-hidden">
            <main className="flex-1">
              {activeTab === "Summary" && (
                <Summary caseId={caseId} individualId={individualId} />
              )}
              {activeTab === "Transactions" && <Transactions />}
              {activeTab === "Debtors" && (
                <Debtors caseId={caseId} individualId={individualId} />
              )}
              {activeTab === "Creditors" && (
                <Creditors caseId={caseId} individualId={individualId} />
              )}
              {activeTab === "EMI" && (
                <EMI caseId={caseId} individualId={individualId} />
              )}
              {activeTab === "Investment" && (
                <Investment caseId={caseId} individualId={individualId} />
              )}
              {activeTab === "EOD" && (
                <EodBalance caseId={caseId} individualId={individualId} />
              )}
              {activeTab === "Cash" && (
                <Cash caseId={caseId} individualId={individualId} />
              )}
              {activeTab === "UPI" && (
                <Upi caseId={caseId} individualId={individualId} />
              )}
              {activeTab === "Suspense" && (
                <Suspense caseId={caseId} individualId={individualId} />
              )}
              {activeTab === "Reversal" && (
                <Reversal caseId={caseId} individualId={individualId} />
              )}
              {/* {activeTab === "Reversal" && <ForeignTransactions />} */}
            </main>
          </div>
        </ScrollArea>
      </div>
    </>
  );
};

export default IndividualDashboard;
