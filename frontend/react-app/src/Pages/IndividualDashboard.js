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
  Upload,
  Plus,
  Grid2X2,
  Import,
  MoreHorizontal,
} from "lucide-react";
import { useReportContext } from "../contexts/ReportContext";
import DashboardDropdown from "../components/IndividualDashboardComponents/DashboardDropdown";
import TallyDirectImport from "../components/ImportTally/TallyDirectImport";

const IndividualDashboard = () => {
  const [activeTab, setActiveTab] = useState("Summary");
  const { breadcrumbs, setIndividualDashboard } = useBreadcrumb();
  const { caseId, individualId, defaultTab } = useParams();
  const { reportData, updateReportData } = useReportContext();
  const { currentCustomerName, setCurrentCustomerName } = useState(null);

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
      title: "Suspense",
      icon: FileQuestion,
    },

    {
      title: "Tally",
      icon: Grid2X2,
      // This group will be open by default
      items: [
        {
          title: "Ledgers",
          url: "#",
          icon: Plus,
        },
        {
          title: "Upload to Tally",
          url: "#",
          icon: Upload,
        },
      ],
      alwaysOpen: true,
    },
    {
      title: "Other",
      icon: MoreHorizontal,
      // This group will be collapsed by default
      items: [
        { title: "Debtors", icon: ArrowUpNarrowWide },
        { title: "Creditors", icon: ArrowDownWideNarrow },
        { title: "UPI", icon: ScanLine },
        { title: "Cash", icon: IndianRupee },
        { title: "EMI", icon: MessageSquareText },
        { title: "Investment", icon: ChartNoAxesCombined },
        { title: "Reversal", icon: Undo2 },
        { title: "Insurance", icon: ShieldPlus },
        { title: "Contra", icon: IndianRupee },
      ],
    },
  ]);

  useEffect(() => {
    setIndividualDashboard(
      activeTab,
      `/individual-dashboard/${caseId}/${
        individualId || "combined"
      }/${activeTab}`
    );
  }, [activeTab, caseId, individualId, setIndividualDashboard]);

  useEffect(() => {
    if (
      individualId === undefined ||
      individualId === null ||
      individualId === "undefined"
    ) {
      // If the condition is met, add EOD to the "Other" group if it’s not already present.
      setNavItems((prevNavItems) =>
        prevNavItems.map((item) => {
          if (item.title === "Other") {
            const hasEOD = item.items.some((sub) => sub.title === "EOD");
            if (!hasEOD) {
              return {
                ...item,
                items: [...item.items, { title: "EOD", icon: History }],
              };
            }
          }
          return item;
        })
      );
    } else {
      // Otherwise, remove EOD from the "Other" group if it exists.
      setNavItems((prevNavItems) =>
        prevNavItems.map((item) => {
          if (item.title === "Other") {
            return {
              ...item,
              items: item.items.filter((sub) => sub.title !== "EOD"),
            };
          }
          return item;
        })
      );
    }
  }, []);

  // useEffect(() => {
  //   console.log({ defaultTab });
  //   if (defaultTab === "defaultTab") setActiveTab(navItems[0].title);
  //   else setActiveTab(defaultTab);
  // }, []);

  useEffect(() => {
    const computedTab =
      defaultTab === "defaultTab" ? navItems[0].title : defaultTab;
    if (activeTab !== computedTab) {
      setActiveTab(computedTab);
    }
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
            {/* <div>
              <DashboardDropdown />
            </div> */}
          </div>
          <div className="flex-1 flex flex-col overflow-hidden">
            <main className="flex-1">
              {activeTab === "Summary" && <Summary />}
              {activeTab === "Transactions" && <Transactions />}
              {activeTab === "Debtors" && <Debtors />}
              {activeTab === "Creditors" && <Creditors />}
              {activeTab === "EMI" && <EMI />}
              {activeTab === "Investment" && <Investment />}
              {activeTab === "EOD" && <EodBalance />}
              {activeTab === "Cash" && <Cash />}
              {activeTab === "UPI" && <Upi />}
              {activeTab === "Suspense" && <Suspense />}
              {activeTab === "Reversal" && <Reversal />}
              {activeTab === "Insurance" && <Insurance />}
              {activeTab === "Contra" && <Contra />}
              {activeTab === "Upload to Tally" && (
                <TallyDirectImport defaultVoucher={"Payment Receipt Contra"} />
              )}
              {activeTab === "Ledgers" && (
                <TallyDirectImport defaultVoucher={"Ledgers"} />
              )}
              {activeTab === "Import Ledgers" && (
                <TallyDirectImport defaultVoucher={"Import Ledgers"} />
              )}
            </main>
          </div>
        </ScrollArea>
      </div>
    </>
  );
};

export default IndividualDashboard;
