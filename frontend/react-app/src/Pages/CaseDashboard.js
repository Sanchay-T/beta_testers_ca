import React, { useEffect, useState, useRef } from "react";
import { cn } from "../lib/utils";
import { ScrollArea } from "../components/ui/scroll-area";
import Sidebar from "../components/Sidebar";
import AccountNumNameManager from "../components/CaseDashboardComponents/AccountNumNameManager";
import IndividualTable from "../components/CaseDashboardComponents/IndividualTable";
import CombinedTable from "../components/CaseDashboardComponents/CombinedTable";
import { useNavigate, useParams } from "react-router-dom";
import { useBreadcrumb } from "../contexts/BreadcrumbContext";
import { BreadcrumbDynamic } from "../components/BreadCrumb";
import { User, UserPen,Import } from "lucide-react";
import TallyDirectImport from "../components/ImortTally/TallyDirectImport";

const CaseDashboard = () => {
  const { breadcrumbs, setCaseDashboard } = useBreadcrumb();
  const [activeTab, setActiveTab] = useState("Acc No and Acc Name");
  const navigate = useNavigate();
  const { caseId, defaultTab } = useParams();
  const [reportNameFromDb, setReportNameFromDb] = useState(null);

  console.log("CaseId : ", caseId, "Default Tab : ", defaultTab);

  useEffect(() => {
    const fetchReportName = async () => {
      try {
        const result = await window.electron.getReportName(caseId);
        // console.log("Report Name fetched successfully:", result);
        setReportNameFromDb(result);
      } catch (error) {
        // console.error("Error fetching report name:", error);
      }
    };

    fetchReportName();
  }, [caseId]);

  // console.log("Report Name : ", reportNameFromDb);

  useEffect(() => {
    setCaseDashboard(activeTab, `/case-dashboard/${caseId}/${activeTab}`);
  }, [activeTab]);

  const navItems = [
    {
      title: "Reports",
      url: "#",
      icon: User,
      isActive: true,

    },
    {
      title: "Acc No and Acc Name",
      url: "#",
      icon: UserPen,
    },
    {
      title: "Import to Tally",
      url: "#",
      icon: Import,
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
    <div className={cn("w-full flex h-screen bg-background")}>
      <Sidebar
        navItems={navItems}
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        caseId={caseId}
        reportName={reportNameFromDb}
      />
      <ScrollArea className="w-full">
        <BreadcrumbDynamic items={breadcrumbs} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <main className="flex-1">
            {activeTab === "Acc No and Acc Name" && (
              <AccountNumNameManager caseId={caseId} />
            )}
            {activeTab === "Reports" && <IndividualTable caseId={caseId} caseName={reportNameFromDb} />}
            {activeTab === "Combined Table" && <CombinedTable />}
            {activeTab === "Import to Tally" && <TallyDirectImport caseId={caseId}/>}
          </main>
        </div>
      </ScrollArea>
    </div>
  );
};

export default CaseDashboard;
