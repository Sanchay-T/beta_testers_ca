import React from "react";
import { Pie, PieChart } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "../ui/chart";

const SuspensePieChart = ({
  data = [],
  title = "",
  config = {},
  valueKey = null,
  nameKey = null,
  showLegends = false,
  totalTransactionCount = 0,

}) => {


   const suspenseTransactionCount = data.length;
   const nonSuspenseTransactionCount = totalTransactionCount - suspenseTransactionCount;
   const totalCount = totalTransactionCount;


  const pieData = [
    { 
      name: 'Suspense Transactions', 
      value: suspenseTransactionCount, 
      percentage: ((suspenseTransactionCount / totalCount) * 100).toFixed(2),
      fill: 'hsl(var(--chart-2))' 
    },
    { 
      name: 'Other Transactions', 
      value: nonSuspenseTransactionCount, 
      percentage: ((nonSuspenseTransactionCount / totalCount) * 100).toFixed(2),
      fill: 'hsl(var(--chart-1))' 
    }
  ];


  return (
    <Card className="flex flex-col">
      <CardHeader className="items-center pb-0">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer config={config} className="w-full min-h-[55vh]">
          <PieChart>
          <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent 
                  formatter={(value, name, props) => {
                    const item = pieData.find(d => d.name === name);
                    return `${value} ${name} (${item.percentage}%)`;
                  }} 
                />
              }
            />
            {showLegends&&<ChartLegend content={<ChartLegendContent />} />}
            <Pie
              data={pieData}
              dataKey={"value"}
              nameKey={"name"}
              stroke="0"
              radius={120}
            />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

export default SuspensePieChart;
