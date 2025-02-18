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
// import ForeignTransactions from "../components/IndividualDashboardComponents/ForeignTransactions";
import Upi from "../components/IndividualDashboardComponents/Upi";
import Insurance from "../components/IndividualDashboardComponents/Insurance";
import Contra from "../components/IndividualDashboardComponents/Contra";
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
  ShieldPlus,
} from "lucide-react";
import { useReportContext } from "../contexts/ReportContext";
import DashboardDropdown from "../components/IndividualDashboardComponents/DashboardDropdown";


const IndividualDashboard = () => {
  const [activeTab, setActiveTab] = useState("Summary");
  const { breadcrumbs, setIndividualDashboard } = useBreadcrumb();
  const { caseId, individualId, defaultTab } = useParams();
  const { reportData, updateReportData } = useReportContext();
  const {currentCustomerName,setCurrentCustomerName} = useState(null);
  
  const [navItems, setNavItems] = useState([
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
    {
      title: "Insurance",
      icon: ShieldPlus,
    },
    {
      title: "Contra",
      icon: IndianRupee,
    },
  ]);

  useEffect(() => {
    setIndividualDashboard(
      activeTab,
      `/individual-dashboard/${caseId}/${individualId || "combined"}/${activeTab}`
    );
  }, [activeTab, caseId, individualId, setIndividualDashboard]);


  useEffect(() => {
    if (individualId!==undefined && individualId!==null && individualId!=="undefined") {
      updateReportData({
        ...reportData,
        individualId:null,
        customerName: null
      })
      // hide eod for individual
      setNavItems((prev) => {
        return prev.filter((item) => item.title !== "EOD");
      });
    }else{
      // show eod for where individual id is not present, first check if it is already present
      if(!navItems.find((item) => item.title === "EOD")){
        setNavItems((prev) => {
          return [...prev, {
            title: "EOD",
            icon: History,
          }]
        });
      }
    }
  }, []);


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
        />
        <ScrollArea className="w-full">
          <div className="flex justify-between items-center w-full pr-14">

          <BreadcrumbDynamic items={breadcrumbs} />
          <div>
            <DashboardDropdown/>

          </div>
          </div>
          <div className="flex-1 flex flex-col overflow-hidden">
            <main className="flex-1">
              {activeTab === "Summary" && (
                <Summary  />
              )}
              {activeTab === "Transactions" && <Transactions />}
              {activeTab === "Debtors" && (
                <Debtors  />
              )}
              {activeTab === "Creditors" && (
                <Creditors  />
              )}
              {activeTab === "EMI" && (
                <EMI  />
              )}
              {activeTab === "Investment" && (
                <Investment  />
              )}
              {activeTab === "EOD" && (
                <EodBalance  />
              )}
              {activeTab === "Cash" && (
                <Cash />
              )}
              {activeTab === "UPI" && (
                <Upi />
              )}
              {activeTab === "Suspense" && (
                <Suspense  />
              )}
              {activeTab === "Reversal" && (
                <Reversal  />
              )}
              {activeTab === "Insurance" && (
                <Insurance  />
              )}
              {activeTab === "Contra" && (
                <Contra  />
              )}
            </main>
          </div>
        </ScrollArea>
      </div>
    </>
  );
};

export default IndividualDashboard;
