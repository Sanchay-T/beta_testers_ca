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
import { useReportContext } from "../contexts/ReportContext";

const CaseDashboard = () => {
  const { breadcrumbs, setCaseDashboard } = useBreadcrumb();
  const [activeTab, setActiveTab] = useState("Acc No and Acc Name");
  const navigate = useNavigate();
  const { caseId, defaultTab } = useParams();
  const { reportData, updateReportData } = useReportContext();




  // console.log("Report Name : ", reportNameFromDb);

  useEffect(() => {
    setCaseDashboard(activeTab, `/case-dashboard/${caseId}/${activeTab}`);

  }, [activeTab]);

  useEffect(()=>{

    updateReportData({
      ...reportData,
      customerName:null,
      individualId:null
    })
  },[caseId])

  const navItems = [
    {
      title: "Reports",
      url: "#",
      icon: User,
      isActive: true,

    },
    {
      title: "Account Information",
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
      />
      <ScrollArea className="w-full">
        <BreadcrumbDynamic items={breadcrumbs} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <main className="flex-1">
            {activeTab === "Account Information" && (
              <AccountNumNameManager />
            )}
            {activeTab === "Reports" && <IndividualTable />}
            {activeTab === "Combined Table" && <CombinedTable />}
            {activeTab === "Import to Tally" && <TallyDirectImport />}
          </main>
        </div>
      </ScrollArea>
    </div>
  );
};

export default CaseDashboard;
