import React, { useEffect } from "react";
import { BadgeCheck, Bell, CreditCard, LogOut, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "./ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import logo from "../data/assets/logo.png";
import { useAuth } from "../contexts/AuthContext";
import { useReportContext } from "../contexts/ReportContext";
import { useParams } from "react-router-dom";
import { ScrollArea } from "../components/ui/scroll-area";

const SidebarDynamic = ({ navItems, activeTab, setActiveTab }) => {
  const { logout, setError, user } = useAuth();
  const navigate = useNavigate();
  const { open, toggleSidebar } = useSidebar();
  const { reportData, updateReportData } = useReportContext();
  const { caseId, individualId } = useParams();

  // Get initials for avatar fallback
  const getInitials = (name) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const tabs = navItems.map((item) => item.title);

  const isIndividualDashboard = tabs.includes("Summary");
  const isCaseDashboard = tabs.includes("Reports");
  let isCombinedInvidualDashboard =
    tabs.includes("Summary") &&
    (reportData.individualId === null ||
      reportData.individualId === undefined ||
      reportData.individualId === "undefined" ||
      reportData.individualId === "combined");

  useEffect(() => {
    let fetchedCustomerName = reportData.customerName;
    let fetchedReportName = reportData.reportName;

    const fetchCustomerName = async () => {
      console.log("Fetching customer name for individual ID:", individualId);
      try {
        const customerNametemp = await window.electron.getCustomerName(
          individualId
        );
        if (customerNametemp) {
          console.log("Customer name fetched successfully:", customerNametemp);

          updateReportData({
            ...reportData,
            customerName: customerNametemp,
            caseId,
            individualId,
            reportName: fetchedReportName,
          });
          fetchedCustomerName = customerNametemp;
        }
      } catch (error) {
        console.error("Error fetching customer name:", error);
      }
    };

    const fetchReportName = async () => {
      try {
        const reportName = await window.electron.getReportName(caseId);

        updateReportData({
          ...reportData,
          reportName,
          caseId,
          individualId,
          customerName: fetchedCustomerName,
        });

        fetchedReportName = reportName;
      } catch (error) {
        console.error("Error fetching report name:", error);
      }
    };
    if (
      individualId === undefined ||
      individualId === null ||
      individualId === "undefined" ||
      individualId === "combined"
    ) {
      if (!fetchedReportName) fetchReportName();
    } else {
      if (!fetchedCustomerName) fetchCustomerName();
    }
  }, [caseId, individualId]);

  const handleLogout = async () => {
    try {
      const loggedOut = await logout();
      if (loggedOut) {
        console.log("User logged out successfully");
      } else {
        console.error("Failed to log out on the frontend");
      }
    } catch (error) {
      console.error("Logout error:", error);
      setError(error.message);
    }
  };

  const MenuItem = ({ item, level = 0 }) => {
    const hasSubmenu = item.items?.length > 0;
    const { open: isOpen } = useSidebar();
    const isCollapsed = !isOpen;

    return (
      <div className="w-full">
        <button
          title={isCollapsed ? item.title : undefined} // Show tooltip only when collapsed
          className={`w-full flex items-center justify-start p-2 rounded-md transition-all duration-200 ease-in-out ${
            level > 0 ? "ml-4" : ""
          } ${
            activeTab === item.title && !hasSubmenu
              ? "bg-gray-300 text-black font-semibold dark:bg-slate-300"
              : "text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-white"
          } ${isCollapsed ? "justify-center" : ""}`}
          onClick={() => !hasSubmenu && setActiveTab(item.title)}
        >
          <div className="flex items-center gap-3">
            {item.icon && <item.icon className="h-5 w-5 flex-shrink-0" />}
            {!isCollapsed && <span className="text-sm">{item.title}</span>}
          </div>
        </button>

        {hasSubmenu && (
          <div className={`ml-4 mt-1 space-y-1 ${isCollapsed ? "hidden" : ""}`}>
            {item.items.map((subItem) => (
              <MenuItem key={subItem.title} item={subItem} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  const DashboardInfo = () => {
    const { open: isOpen } = useSidebar();
    const isCollapsed = !isOpen;

    if (isCollapsed || (!isIndividualDashboard && !isCaseDashboard))
      return null;

    return (
      <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-lg shadow-sm">
        {isIndividualDashboard && !isCombinedInvidualDashboard && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Account Name :{" "}
              <span className="text-sm text-gray-800 dark:text-gray-200 font-semibold hover:text-gray-600 dark:hover:text-gray-400 transition-colors duration-300">
                {reportData.customerName}
              </span>
            </p>
          </div>
        )}
        {(isCaseDashboard || isCombinedInvidualDashboard) && (
          <div className="space-y-2">
            {reportData.reportName && (
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Report Name :{" "}
                  <span className="text-sm text-gray-800 dark:text-gray-200 font-semibold hover:text-gray-600 dark:hover:text-gray-400 transition-colors duration-300">
                    {reportData.reportName}
                  </span>
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const NavMain = () => (
    <div className="space-y-2">
      {navItems.map((item) => (
        <MenuItem key={item.title} item={item} />
      ))}
    </div>
  );

  const UserMenu = () => {
    const { open: isOpen } = useSidebar();
    const isCollapsed = !isOpen;

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={`flex items-center w-full ${
              open ? "p-2" : "p-1"
            } hover:bg-gray-100 rounded-md transition-all duration-200`}
          >
            <Avatar className="h-8 w-8 rounded-lg">
              <AvatarImage src={user?.avatar} alt={user?.name || "User"} />
              <AvatarFallback className="rounded-lg">
                {getInitials(user?.name)}
              </AvatarFallback>
            </Avatar>
            {!isCollapsed && (
              <div className="ml-3 flex-1 text-left">
                <p className="text-sm font-medium hover:text-black">
                  {user?.name || "User"}
                </p>
              </div>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" side="top" align="end">
          <DropdownMenuLabel>
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={user?.avatar} alt={user?.name || "User"} />
                <AvatarFallback>{getInitials(user?.name)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{user?.name || "User"}</p>
              </div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem>
              <Sparkles className="mr-2 h-4 w-4" />
              <span>Refer and Earn</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <BadgeCheck className="mr-2 h-4 w-4" />
              <span>Account</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <CreditCard className="mr-2 h-4 w-4" />
              <span>Billing</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Bell className="mr-2 h-4 w-4" />
              <span>Notifications</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            <span>Log out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  // Custom toggle button component
  const SidebarToggle = () => {
    const { open: isOpen, toggleSidebar } = useSidebar();

    return (
      <div className="relative h-screen z-10">
        <SidebarTrigger
          className="absolute -bottom-52 rounded-full left-2 bg-white hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 shadow-sm focus:outline-none shadow-sm"
          onClick={toggleSidebar}
        />
      </div>
    );
  };

  return (
    <Sidebar
      className="transition-all duration-300 ease-in-out"
      collapsible="icon"
      {...{ navItems, activeTab, setActiveTab }}
    >
      <SidebarHeader>
        <div className="h-16 flex items-center px-4 border-b relative">
          <img
            src={logo}
            alt="Logo"
            className={`h-12 cursor-pointer transition-all duration-300 ${
              !open ? "w-8" : "w-auto"
            }`}
            onClick={() => navigate("/")}
          />
          <SidebarToggle />
        </div>
        <DashboardInfo />
      </SidebarHeader>
      <SidebarContent className="p-2 overflow-x-hidden">
        <ScrollArea>
          <NavMain />
        </ScrollArea>
      </SidebarContent>
      <SidebarFooter className={`border-t ${open ? "p-3" : "p-1"}`}>
        <UserMenu />
      </SidebarFooter>
      {/* We're still including SidebarRail but will disable its functionality */}
      <SidebarRail className="pointer-events-none" />
    </Sidebar>
  );
};

export default SidebarDynamic;
