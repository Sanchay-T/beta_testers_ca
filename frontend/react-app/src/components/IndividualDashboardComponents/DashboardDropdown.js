import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../ui/card";
import { useReportContext } from "../../contexts/ReportContext";

const DashboardDropdown = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [statements, setStatements] = useState([]);
  const navigate = useNavigate();
  const { reportData } = useReportContext();
  const { caseId } = reportData;

  useEffect(() => {
    const fetchStatements = async () => {
      setIsLoading(true);
      try {
        const result = await window.electron.getStatements(caseId);
        setStatements(result);
      } catch (error) {
        console.error("Error fetching statements:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (caseId) {
      fetchStatements();
    }
  }, [caseId]);

  // Extract unique individual names (assuming customerName is unique).
  const individuals = Array.from(
    new Set(statements.map((item) => item.customerName).filter(Boolean))
  );

  const handleSelect = (value) => {
    console.log("Selected value:", value);
    if (value === "combined") {
      navigate(`/individual-dashboard/${caseId}/defaultTab`);
    } else {
      // Find a statement corresponding to the selected individual.
      // Adjust this if you need to use a different unique identifier.
      const record = statements.find(
        (item) => item.customerName === value
      );
      console.log({record})
      if (record) {
        navigate(`/individual-dashboard/${caseId}/${record.id}/defaultTab`);
      }
    }
  };

  return (
    <>
        {isLoading ? (
          <div className="flex justify-center items-center">
            <Loader2 className="animate-spin" />
          </div>
        ) : (
          <select
            className="border rounded px-4 py-2 w-full"
            onChange={(e) => handleSelect(e.target.value)}
          >
            <option value="combined">Combined Dashboard</option>
            {individuals.map((name, index) => (
              <option key={index} value={name}>
                {name}
              </option>
            ))}
          </select>
        )}
    </>

  );
};

export default DashboardDropdown;
