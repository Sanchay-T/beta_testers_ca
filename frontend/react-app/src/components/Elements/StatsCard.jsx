import React, { useState } from "react";
import { Card, CardContent } from "../ui/card";
import { Progress } from "../ui/progress";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, Clock, FileText, ClipboardList } from "lucide-react";

const getCardStyles = (type) => {
  switch (type) {
    case "reports":
      return {
        background: `linear-gradient(135deg, #2D2665 0%, #4633B5 100%),
                    radial-gradient(circle at top right, rgba(115, 103, 240, 0.3) 0%, transparent 70%),
                    radial-gradient(circle at bottom left, rgba(50, 40, 120, 0.3) 0%, transparent 70%),
                    radial-gradient(circle at center, rgba(115, 103, 240, 0.1) 0%, transparent 50%)`,
        boxShadow: "0 8px 32px rgba(45, 38, 101, 0.25)",
      };
    case "statements":
      return {
        background: `linear-gradient(135deg, #003366 0%, #0056B3 100%),
                    radial-gradient(circle at top right, rgba(0, 150, 255, 0.3) 0%, transparent 70%),
                    radial-gradient(circle at bottom left, rgba(0, 80, 170, 0.3) 0%, transparent 70%),
                    radial-gradient(circle at center, rgba(0, 150, 255, 0.1) 0%, transparent 50%)`,
        boxShadow: "0 8px 32px rgba(0, 51, 102, 0.25)",
      };

    case "timeSaved":
      return {
        background: `linear-gradient(135deg, #003366 0%, #0056B3 100%),
                      radial-gradient(circle at top right, rgba(0, 150, 255, 0.3) 0%, transparent 70%),
                      radial-gradient(circle at bottom left, rgba(0, 80, 170, 0.3) 0%, transparent 70%),
                      radial-gradient(circle at center, rgba(0, 150, 255, 0.1) 0%, transparent 50%)`,
        boxShadow: "0 8px 32px rgba(0, 51, 102, 0.25)",
      };
    default:
      return {};
  }
};

const MetricIcon = ({ type }) => {
  const iconProps = {
    className:
      "h-4 w-4 text-white transition-all duration-300 sm:h-5 sm:w-5 lg:h-6 lg:w-6",
  };
  switch (type) {
    case "statements":
      return <ClipboardList {...iconProps} />;
    case "reports":
      return <FileText {...iconProps} />;
    case "timeSaved":
      return <Clock {...iconProps} />;
    default:
      return null;
  }
};

const AnimatedPieChart = ({ data }) => {
  const COLORS = [
    "rgba(255, 255, 255, 0.8)",
    "rgba(255, 255, 255, 0.4)",
    "rgba(255, 255, 255, 0.2)",
  ];

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={80}
          paddingAngle={5}
          dataKey="value"
          animationBegin={0}
          animationDuration={1500}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: "rgba(255, 255, 255, 0.95)",
            border: "none",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          }}
          itemStyle={{ color: "#1E1B4B" }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
};

const StatsMetricCard = ({
  type,
  title = "N/A",
  value1 = "",
  value2 = "",
  mainValue1 = 0,
  mainValue2 = 0,
  chartData = [],
  chartType = "line",
  onDurationChange,
  handleDurationChange,
  currentDuration,
}) => {
  const cardStyles = getCardStyles(type);
  const [duration, setDuration] = useState(type === "statements" ? "1Y" : "1M");
  const [progress, setProgress] = useState(65);

  const handleDurationClick = (newDuration) => {
    if (type === "timeSaved") {
      onDurationChange?.(newDuration);
    } else {
      setDuration(newDuration);
      if (type === "reports") {
        onDurationChange?.(newDuration);
      } else if (type === "statements") {
        handleDurationChange?.(newDuration);
      }
    }
  };

  const renderChart = () => {
    if (type === "statements") {
      return (
        <div className="space-y-4 py-14">
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm text-white font-medium">
                Plan Validity
              </span>
              <span className="text-sm text-white">65% Complete</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
          <p className="text-sm text-white">
            Your Enterprise plan will expire in 127 days
          </p>
        </div>
      );
    }

    if (type === "timeSaved") {
      const pieChartData = [
        { name: "Manual Processing", value: 40 },
        { name: "Automation", value: 35 },
        { name: "Optimization", value: 25 },
      ];
      return <AnimatedPieChart data={pieChartData} />;
    }

    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255, 255, 255, 0.1)"
          />
          <XAxis
            dataKey="month"
            stroke="rgba(255, 255, 255, 0.3)"
            tick={{ fill: "rgba(255, 255, 255, 0.8)", fontSize: "12px" }}
          />
          <YAxis
            stroke="rgba(255, 255, 255, 0.3)"
            tick={{ fill: "rgba(255, 255, 255, 0.8)", fontSize: "12px" }}
            width={30}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "rgba(255, 255, 255, 0.95)",
              border: "none",
              borderRadius: "8px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            }}
          />
          <Bar
            dataKey="reports"
            fill="rgba(99, 102, 241, 0.8)"
            radius={[4, 4, 0, 0]}
            name="Reports"
          />
          <Bar
            dataKey="statements"
            fill="rgba(255, 99, 132, 0.8)"
            radius={[4, 4, 0, 0]}
            name="Statements"
          />
        </BarChart>
      </ResponsiveContainer>
    );
  };

  return (
    <Card
      className="w-full overflow-hidden transition-all duration-300 border-0 rounded-xl relative backdrop-blur-xl"
      style={cardStyles}
    >
      <div className="absolute inset-0 opacity-50 mix-blend-overlay bg-[radial-gradient(circle_at_50%_-20%,rgba(255,255,255,0.15),rgba(255,255,255,0))]" />
      <CardContent className="flex flex-col h-full p-6 gap-4 relative z-10">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-lg backdrop-blur-sm shadow-lg">
              <MetricIcon type={type} />
            </div>
            <h2 className="text-lg font-semibold text-white tracking-wide">
              {title}
            </h2>
          </div>
        </div>

        <div>
          <div className="text-md text-white/80 tracking-tight">
            {value1} : {mainValue1.toLocaleString()}
          </div>
          <div className="text-md text-white/80 tracking-tight">
            {value2} : {mainValue2.toLocaleString()}
          </div>
        </div>

        <div className="h-44 w-full">{renderChart()}</div>

        <div className="flex justify-center gap-3 mt-4">
          {["1M", "2M", "6M", "1Y"].map((option) => (
            <button
              key={option}
              className={`px-3 py-1 rounded-lg font-medium text-sm transition-all duration-300 ${
                (type === "timeSaved" ? currentDuration : duration) === option
                  ? "bg-emerald-500 text-white"
                  : "bg-white/10 text-white/80 hover:bg-white/20"
              }`}
              onClick={() => handleDurationClick(option)}
            >
              {option}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default StatsMetricCard;
