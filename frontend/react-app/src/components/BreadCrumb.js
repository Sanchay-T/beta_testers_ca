import React, { useState, useEffect } from "react";
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { useNavigate, useLocation, matchPath } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { Button } from "../components/ui/button";
import { useBreadcrumb } from "../contexts/BreadcrumbContext";

export function BreadcrumbDynamic({ items, className = "py-4 px-8" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { lastStates, navigationStack } = useBreadcrumb();
  const [isLoading, setIsLoading] = useState(false);
  const [currentItems, setCurrentItems] = useState(items);

  useEffect(() => {
    setCurrentItems(items);
  }, [items]);

  const handleNavigation = async (path) => {
    if (!path || typeof path !== "string") {
      console.warn("Invalid navigation path:", path);
      return;
    }
    setIsLoading(true);
    try {
      await navigate(path);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    const currentPath = location.pathname;

    // Match report page
    const reportMatch = matchPath(
      "/individual-dashboard/:caseId/:individualId/:defaultTab/report/:reportName",
      currentPath
    );

    // Match individual dashboard
    const individualDashboardMatch = matchPath(
      "/individual-dashboard/:caseId/:individualId/:defaultTab",
      currentPath
    );

    if (reportMatch) {
      const { caseId, individualId, defaultTab } = reportMatch.params;
      if (caseId && individualId && defaultTab) {
        handleNavigation(
          `/individual-dashboard/${caseId}/${individualId}/${defaultTab}`
        );
        return;
      }
    }

    if (individualDashboardMatch) {
      const { caseId } = individualDashboardMatch.params;
      if (caseId) {
        handleNavigation(`/case-dashboard/${caseId}/defaultTab`);
        return;
      }
    }

    // Navigate to last known main dashboard
    if (lastStates.mainDashboard?.length > 0) {
      handleNavigation(
        lastStates.mainDashboard[lastStates.mainDashboard.length - 1].path
      );
      return;
    }

    // Fallback: Use browser history back
    window.history.back();
  };

  const isBackButtonVisible = () => {
    return (
      matchPath(
        "/individual-dashboard/:caseId/:individualId/:defaultTab/report/:reportName",
        location.pathname
      ) ||
      matchPath(
        "/individual-dashboard/:caseId/:individualId/:defaultTab",
        location.pathname
      ) ||
      matchPath("/case-dashboard/:caseId/:defaultTab", location.pathname)
    );
  };

  if (!currentItems?.length) {
    return null;
  }

  return (
    <div className="flex items-center gap-4">
      {isBackButtonVisible() && (
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center gap-2 ml-2"
          onClick={handleBack}
          disabled={isLoading}
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>
      )}

      <Breadcrumb className={className}>
        <BreadcrumbList>
          {currentItems.map((item, index) => (
            <React.Fragment key={index}>
              <BreadcrumbItem className={isLoading ? "opacity-50" : ""}>
                {item.dropdown ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className="flex items-center gap-1"
                      disabled={isLoading}
                    >
                      <BreadcrumbEllipsis className="h-4 w-4" />
                      <span className="sr-only">Toggle menu</span>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      {item.dropdown.map((dropdownItem, dropdownIndex) => (
                        <DropdownMenuItem
                          key={dropdownIndex}
                          onClick={() => handleNavigation(dropdownItem.path)}
                          disabled={isLoading}
                        >
                          {dropdownItem.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : item.isCurrentPage ? (
                  <BreadcrumbPage>{item.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    as="button"
                    className="cursor-pointer hover:underline"
                    onClick={() => handleNavigation(item.path)}
                    disabled={isLoading}
                  >
                    {item.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {index < currentItems.length - 1 && <BreadcrumbSeparator />}
            </React.Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}

export default BreadcrumbDynamic;
