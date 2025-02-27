import React, { useState, useEffect } from "react";
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
import clsx from "clsx";

// Loader component: a simple animated spinner using Tailwind classes
const Loader = () => (
  <div className="flex items-center justify-center h-full">
    <div className="animate-spin rounded-full h-10 w-10 border-t-4 border-white border-opacity-75"></div>
  </div>
);

// Use your exact original gradients for the card background
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
    case "pages":
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

// Extract the primary linear gradient for the animated border using the exact colors
const getBorderStyle = (type) => {
  switch (type) {
    case "reports":
      return "linear-gradient(to right, #1187e9, #0a4a8e)";
    case "pages":
      return "linear-gradient(to right, #1187e9, #0a4a8e)";
    case "timeSaved":
      return "linear-gradient(to right, #1187e9, #0a4a8e)";
    default:
      return "";
  }
};

const MetricIcon = ({ type }) => {
  const iconProps = {
    className:
      "h-6 w-6 text-white transition-transform duration-300 hover:scale-110",
  };
  switch (type) {
    case "pages":
      return <ClipboardList {...iconProps} />;
    case "reports":
      return <FileText {...iconProps} />;
    case "timeSaved":
      return <Clock {...iconProps} />;
    default:
      return null;
  }
};

// const AnimatedPieChart = ({ data }) => {
//   const COLORS = [
//     "rgba(255, 255, 255, 0.8)",
//     "rgba(255, 255, 255, 0.4)",
//     "rgba(255, 255, 255, 0.2)",
//   ];

//   return (
//     <ResponsiveContainer width="100%" height="100%">
//       <PieChart>
//         <Pie
//           data={data}
//           cx="50%"
//           cy="50%"
//           innerRadius={55}
//           outerRadius={75}
//           paddingAngle={5}
//           dataKey="value"
//           animationBegin={0}
//           animationDuration={1500}
//         >
//           {data.map((entry, index) => (
//             <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
//           ))}
//         </Pie>
//         <Tooltip
//           contentStyle={{
//             backgroundColor: "rgba(255, 255, 255, 0.95)",
//             border: "none",
//             borderRadius: "8px",
//             boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
//           }}
//           itemStyle={{ color: "#1E1B4B" }}
//         />
//       </PieChart>
//     </ResponsiveContainer>
//   );
// };

const Card1 = ({
  type,
  title,
  value1,
  value2,
  mainValue1 = 0, // Add default value
  mainValue2 = 0, // Add default value
  chartData = [],
  chartType,
  onDurationChange,
  initialDuration = "1M",
}) => {
  const cardStyles = getCardStyles(type);
  const borderGradient = getBorderStyle(type);
  const [duration, setDuration] = useState(type === "pages" ? "1Y" : "1M");
  const [userProgress, setUserProgress] = useState({
    progress: 0,
    remainingDays: 0,
    dateJoined: null,
    expiryDate: null,
  });
  const [localDuration, setLocalDuration] = useState(initialDuration);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUserProgress = async () => {
      if (type === "pages") {
        try {
          setIsLoading(true);

          const progress = await window.electron.getProgressed();
          if (!progress.error) {
            setUserProgress(progress);
          }
        } catch (error) {
          console.error("Error fetching user progress:", error);
        } finally {
          setIsLoading(false);
        }
      } else {
        // For other types, simulate loading time for data preparation
        setIsLoading(true);
        setTimeout(() => setIsLoading(false), 500);
      }
    };

    fetchUserProgress();
  }, [type]);

  // Change progress bar color dynamically

  const handleDurationClick = (newDuration) => {
    setIsLoading(true);
    setLocalDuration(newDuration);
    onDurationChange?.(newDuration);
    setIsLoading(false);
  };

  const renderChart = () => {
    // For types that depend on external data (e.g., "reports"), show a loader if chartData is missing.
    if (isLoading) {
      return (
        <div className="w-full h-full bg-white/10 rounded-xl p-4 shadow-inner animate-fadeIn flex items-center justify-center">
          <Loader />
        </div>
      );
    }

    const formatXAxisTick = (value) => {
      const date = new Date(value);
      if (localDuration === "1M") {
        // For 1M, show date in DD/MM format
        return `${date.getDate()} ${date.toLocaleString("en-US", {
          month: "short",
        })} ${date.getFullYear().toString().substr(2, 2)}`;
      } else {
        // For other durations, show month and year
        return date.toLocaleDateString("en-US", {
          month: "short",
          year: "2-digit",
        });
      }
    };

    // Filter out data points with no reports and statements
    const filteredChartData = chartData.filter(
      (item) => item.reports > 0 || item.statements > 0
    );

    // Format dates to show only month and year
    const formattedChartData = filteredChartData.map((item) => {
      const date = new Date(item.date);
      return {
        ...item,
        formattedDate: date.toLocaleDateString("en-US", {
          month: "short",
          year: "2-digit",
        }),
      };
    });

    // Default: "reports" (or similar types) when chartData is provided.
    return (
      <div className="w-full h-full bg-white/10 rounded-xl p-4 shadow-inner animate-fadeIn">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={filteredChartData}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.1)"
            />
            <XAxis
              dataKey="date"
              stroke="rgba(255,255,255,0.6)"
              tick={{
                fill: "rgba(255,255,255,0.9)",
                fontSize: 12,
                angle: -45,
                textAnchor: "end",
                dy: 10,
              }}
              height={65}
              interval={0}
              tickFormatter={formatXAxisTick}
            />
            <YAxis
              stroke="rgba(255,255,255,0.6)"
              tick={{ fill: "rgba(255,255,255,0.9)", fontSize: 12 }}
              width={30}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(255,255,255,0.95)",
                border: "none",
                borderRadius: "8px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              }}
              labelFormatter={(value) => {
                const date = new Date(value);
                return localDuration === "1M"
                  ? date.toLocaleDateString("en-US", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })
                  : date.toLocaleDateString("en-US", {
                      month: "long",
                      year: "numeric",
                    });
              }}
            />
            <Bar
              dataKey="reports"
              fill="#60a5fa"
              radius={[4, 4, 0, 0]}
              name="Reports"
            />
            <Bar
              dataKey="statements"
              fill="#d1d5db"
              radius={[4, 4, 0, 0]}
              name="Statements"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  };

  return (
    <Card
      className={clsx(
        "relative transition-transform duration-300 rounded-2xl w-full max-w-lg mx-auto h-[530px]"
        // "hover:scale-105"
      )}
      style={cardStyles}
    >
      {/* Animated Glowing Border (using original hex values) */}
      <div
        className="absolute -inset-0.5 rounded-2xl opacity-75 blur-sm animate-tilt"
        style={{ background: borderGradient }}
      ></div>

      {/* Drifting Background Pattern for a futuristic touch */}
      <div
        className="absolute inset-0 z-0 opacity-20 pointer-events-none animate-[moveBackground_8s_linear_infinite]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.1), transparent 50%)",
        }}
      ></div>

      <CardContent className="relative z-10 flex flex-col h-full p-6 gap-7">
        {/* Header with Icon and Title */}
        <div className="flex justify-between items-center h-12">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/10 rounded-full shadow-lg backdrop-blur-lg transition-all duration-300 hover:shadow-[0_0_10px_2px_rgba(255,255,255,0.5)]">
              <MetricIcon type={type} />
            </div>
            <h2 className="text-xl font-extrabold text-white tracking-wider uppercase">
              {title}
            </h2>
          </div>
        </div>

        {/* Stat Boxes */}
        <div className="flex gap-4 h-28">
          <div className="flex-1 bg-white/10 py-4 rounded-xl backdrop-blur-md shadow-lg flex flex-col items-center">
            {isLoading ? (
              <Loader />
            ) : (
              <>
                <span className="text-xs uppercase tracking-wide text-gray-300 text-center">
                  {value1}
                </span>
                <span className="text-3xl font-bold text-white">
                  {mainValue1.toLocaleString()}
                </span>
              </>
            )}
          </div>

          <div className="flex-1 bg-white/10 py-4 rounded-xl backdrop-blur-md shadow-lg flex flex-col items-center">
            {isLoading ? (
              <Loader />
            ) : (
              <>
                <span className="text-xs uppercase tracking-wide text-gray-300 text-center">
                  {value2}
                </span>
                <span className="text-3xl font-bold text-white">
                  {mainValue2.toLocaleString()}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Chart Area */}
        <div className="flex-grow min-h-[120px] w-full">{renderChart()}</div>

        {/* Duration Buttons */}
        <div className="mt-auto py-2">
          <div className="flex justify-center gap-1 mt-1 sm:mb-2 sm:gap-2 flex-wrap">
            {["today", "1M", "3M", "6M", "1Y"].map((option) => (
              <button
                key={option}
                onClick={() => handleDurationClick(option)}
                className={clsx(
                  "relative z-10 px-1.5 sm:px-2 md:px-4 py-1 text-sm rounded-full font-medium transition-all duration-300",
                  localDuration === option
                    ? "bg-white text-black shadow-[0_0_8px_2px_rgba(255,255,255,0.8)]"
                    : "bg-white/10 text-white hover:bg-white/20"
                )}
              >
                {option === "today" ? "Today" : option}
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default Card1;
