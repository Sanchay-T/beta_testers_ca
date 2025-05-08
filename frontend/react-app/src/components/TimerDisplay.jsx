import React, { useEffect, useState } from "react";
import { Clock, CalendarClock } from "lucide-react";

const TimerDisplay = () => {
  const [remainingSeconds, setRemainingSeconds] = useState(null);
  const [expiryTime, setExpiryTime] = useState(null);

  useEffect(() => {
    console.log("TimerDisplay mounted");
    const handleUpdate = (seconds) => {
      console.log(`Remaining seconds: ${seconds}`);
      setRemainingSeconds(seconds);

      // Calculate expiry time in local timezone
      const expiry = new Date(Date.now() + seconds * 1000);
      console.log(`Expiry time: ${expiry.toLocaleString()}`);
      setExpiryTime(expiry);
    };

    window.electron?.onRemainingSecondsUpdated(handleUpdate);

    return () => {
      window.electron?.offRemainingSecondsUpdated(handleUpdate);
    };
  }, []);

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4 bg-background/80 backdrop-blur-sm p-4 justify-center rounded-lg border border-border shadow-lg w-full max-w-md">
      <div className="flex items-center gap-3 w-full sm:w-auto">
        <div className="p-2 bg-primary/10 rounded-full">
          <Clock className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-sm text-muted-foreground font-medium">
            Time Remaining
          </p>
          <p
            className={`text-xl font-semibold ${
              remainingSeconds && remainingSeconds < 300
                ? "text-red-500"
                : "text-foreground"
            } transition-colors`}
          >
            {remainingSeconds !== null
              ? formatTime(remainingSeconds)
              : "--:--:--"}
          </p>
        </div>
      </div>

      <div className="hidden sm:block h-8 w-px bg-border" />

      <div className="flex items-center gap-3 w-full sm:w-auto">
        <div className="p-2 bg-primary/10 rounded-full">
          <CalendarClock className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-sm text-muted-foreground font-medium">Expiry</p>
          <p className="text-foreground font-medium">
            {expiryTime ? (
              <>
                <span className="text-sm">
                  {expiryTime.toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
                <span className="mx-1">•</span>
                <span className="text-sm">
                  {expiryTime.toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
              </>
            ) : (
              "--/-- --:--"
            )}
          </p>
        </div>
      </div>
    </div>
  );
};

export default TimerDisplay;
