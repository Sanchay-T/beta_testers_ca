import React from "react";
import { Card } from "../ui/card";
import { Checkbox } from "../ui/checkbox";

const ToggleStrip = ({ columns, selectedColumns, setSelectedColumns }) => {
  const toggleColumn = (column) => {
    setSelectedColumns((prev) =>
      prev.includes(column)
        ? prev.filter((c) => c !== column)
        : [...prev, column]
    );
  };

  const toggleSelectAll = () => {
    setSelectedColumns(
      selectedColumns.length === columns.length ? [] : [...columns]
    );
  };

  const isAllSelected = selectedColumns.length === columns.length;

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={toggleSelectAll}
        >
          <Checkbox
            checked={isAllSelected}
            onCheckedChange={(checked) => toggleSelectAll()}
          />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {isAllSelected ? "Deselect All" : "Select All"}
          </span>
        </div>
        {columns.map((column) => (
          <div key={column} className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={selectedColumns.includes(column)}
              onCheckedChange={(checked) => toggleColumn(column)}
              onClick={(e) => e.stopPropagation()} // Prevents parent div from triggering
            />
            <span
              className={`text-sm font-medium transition-colors duration-300 ${
                selectedColumns.includes(column)
                  ? "text-slate-900 dark:text-slate-300 font-semibold"
                  : "text-slate-500 dark:text-slate-500"
              }`}
              onClick={() => toggleColumn(column)} // Clicking text also toggles
            >
              {column}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default ToggleStrip;
