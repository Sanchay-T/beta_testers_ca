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

const Card2 = ({
  type,
  title,
  value1,
  value2,
  value3,
  value4,
  mainValue1 = 0, // Add default value
  mainValue2 = 0, // Add default value
  mainValue3 = 0,
  mainValue4 = 0,
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
  const progressColor = clsx(
    "h-2 rounded-full transition-all",
    userProgress.progress < 40
      ? "bg-green-500"
      : userProgress.progress < 70
      ? "bg-yellow-500"
      : "bg-red-500"
  );

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

    if (type === "pages") {
      return (
        <div className="w-full h-full bg-white/10 rounded-xl p-4 shadow-inner animate-fadeIn flex items-center justify-center">
          <div className="space-y-3 w-full">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold tracking-wide text-white uppercase">
                Plan Validity
              </span>
              <span className="text-xs text-gray-300">
                {userProgress.progress}% Complete
              </span>
            </div>
            <div className="relative w-full h-2 bg-white/20 rounded-full overflow-hidden">
              <div
                className={progressColor}
                style={{ width: `${userProgress.progress}%` }}
              />
            </div>
            <p className="text-sm text-gray-200">
              Your <span className="font-semibold">Enterprise</span> plan
              expires in{" "}
              <span className="font-bold">
                {userProgress.remainingDays} days
              </span>
              .
            </p>
          </div>
        </div>
      );
    }
  };

  return (
    <Card
      className="relative transition-transform duration-300 rounded-2xl w-full max-w-lg mx-auto min-h-[450px] lg:min-h-[500px] overflow-hidden flex flex-col"
      style={cardStyles}
    >
      <div
        className="absolute -inset-0.5 rounded-2xl opacity-75 blur-sm animate-tilt"
        style={{ background: borderGradient }}
      />

      <div
        className="absolute inset-0 z-0 opacity-20 pointer-events-none animate-[moveBackground_8s_linear_infinite]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.1), transparent 50%)",
        }}
      />

      <CardContent className="relative z-10 flex flex-col h-full px-3 py-4 sm:p-4 md:p-6 gap-2 md:gap-4 flex-grow">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="p-1.5 sm:p-2 md:p-3 bg-white/10 rounded-full shadow-lg backdrop-blur-lg transition-all duration-300 hover:shadow-[0_0_10px_2px_rgba(255,255,255,0.5)]">
              <MetricIcon type={type} />
            </div>
            <h2 className="text-sm sm:text-base md:text-lg font-extrabold text-white tracking-wider uppercase">
              {title}
            </h2>
          </div>
        </div>

        {/* Stat Boxes - Top Row */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3 md:gap-4">
          <div className="bg-white/10 p-1 sm:p-2 md:p-3 rounded-xl backdrop-blur-md shadow-lg flex flex-col items-center">
            {isLoading ? (
              <Loader />
            ) : (
              <>
                <span className="text-[10px] sm:text-xs uppercase tracking-wide text-gray-300 text-center">
                  {value1}
                </span>
                <span className="text-base sm:text-xl md:text-2xl font-bold text-white">
                  {mainValue1.toLocaleString()}
                </span>
              </>
            )}
          </div>

          <div className="bg-white/10 p-1 sm:p-2 md:p-3 rounded-xl backdrop-blur-md shadow-lg flex flex-col items-center">
            {isLoading ? (
              <Loader />
            ) : (
              <>
                <span className="text-[10px] sm:text-xs md:text-smuppercase tracking-wide text-gray-300 text-center">
                  {value2}
                </span>
                <span className="text-base sm:text-xl md:text-2xl font-bold text-white">
                  {mainValue2.toLocaleString()}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Stat Boxes - Bottom Row */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3 md:gap-4">
          <div className="bg-white/10 p-1 sm:p-2 md:p-3 rounded-xl backdrop-blur-md shadow-lg flex flex-col items-center">
            {isLoading ? (
              <Loader />
            ) : (
              <>
                <span className="text-[10px] sm:text-xs uppercase tracking-wide text-gray-300 text-center">
                  {value3}
                </span>
                <span className="text-base sm:text-xl md:text-2xl font-bold text-white">
                  {mainValue3.toLocaleString()}
                </span>
              </>
            )}
          </div>

          <div className="bg-white/10 p-1 sm:p-2 md:p-3 rounded-xl backdrop-blur-md shadow-lg flex flex-col items-center">
            {isLoading ? (
              <Loader />
            ) : (
              <>
                <span className="text-[10px] sm:text-xs uppercase tracking-wide text-gray-300 text-center">
                  {value4}
                </span>
                <span className="text-base sm:text-xl md:text-2xl font-bold text-white">
                  {mainValue4.toLocaleString()}
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

export default Card2;
