import React, { useState, useEffect } from "react";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Clock, Phone, Mail, MessageSquare } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";

const Loader = () => (
  <div className="flex items-center justify-center h-full">
    <div className="animate-spin rounded-full h-6 w-6 md:h-8 md:w-8 border-t-4 border-white border-opacity-75"></div>
  </div>
);

const getCardStyles = () => ({
  background: `linear-gradient(135deg, #003366 0%, #0056B3 100%),
    radial-gradient(circle at top right, rgba(0, 150, 255, 0.3) 0%, transparent 70%),
    radial-gradient(circle at bottom left, rgba(0, 80, 170, 0.3) 0%, transparent 70%),
    radial-gradient(circle at center, rgba(0, 150, 255, 0.1) 0%, transparent 50%)`,
  boxShadow: "0 8px 32px rgba(0, 51, 102, 0.25)",
});

const getBorderStyle = () => "linear-gradient(to right, #1187e9, #0a4a8e)";

const Card3 = ({ title, value1, value2, mainValue1 = 0, mainValue2 = 0,handleTabChange }) => {
  const cardStyles = getCardStyles();
  const borderGradient = getBorderStyle();
  const [isLoading, setIsLoading] = useState(true);

  const contactInfo = {
    phone: "+91 9833553348",
    email: "support@cyphersol.com",
    whatsapp: "+91 9833553348",
  };

  useEffect(() => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 500);
  }, []);

  const handleMailClick = () => {
    const subject = "Inquiry about Eligible Cases";
    const body =
      "Hello CypherSOL Team,\n\nI would like to get more information about my eligible cases.\n\nThank you.";
    window.location.href = `mailto:${
      contactInfo.email
    }?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const handleWhatsAppClick = () => {
    const message =
      "Hello CypherSOL Team, I would like to get more information about my eligible cases.";
    window.open(
      `https://api.whatsapp.com/send?phone=${contactInfo.whatsapp.replace(
        /\D/g,
        ""
      )}&text=${encodeURIComponent(message)}`,
      "_blank"
    );
  };

  const handlePhoneClick = () => {
    window.location.href = `tel:${contactInfo.phone}`;
  };

  const handleNavigateToEligibility = ()=>{
    handleTabChange("Opportunity to Earn")
  }

  return (
    <Card
      className="relative transition-transform duration-300 rounded-2xl w-full max-w-lg mx-auto min-h-[400px] lg:min-h-[500px]"
      style={cardStyles}
    >
      <div
        className="absolute -inset-0.5 rounded-2xl opacity-75 blur-sm animate-tilt"
        style={{ background: borderGradient }}
      ></div>

      <div
        className="absolute inset-0 z-0 opacity-20 pointer-events-none animate-[moveBackground_8s_linear_infinite]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.1), transparent 50%)",
        }}
      ></div>

      <CardContent className="relative z-10 flex flex-col h-full p-3 sm:p-4 lg:p-6 gap-2 sm:gap-3 lg:gap-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="p-1.5 md:p-2 bg-white/10 rounded-full shadow-lg backdrop-blur-lg transition-all duration-300 hover:shadow-[0_0_10px_2px_rgba(255,255,255,0.5)]">
              <Clock className="h-4 w-4 md:h-6 md:w-6 text-white transition-transform duration-300 hover:scale-110 " />
            </div>
            <h2 className="text-sm md:text-lg font-extrabold text-white tracking-wider uppercase break-words">
              {title || "Total Eligible Cases"}
            </h2>
          </div>
        </div>

        <div className="flex-1 bg-white/10 py-2 md:py-3 px-3 md:px-4 rounded-xl backdrop-blur-md shadow-lg flex flex-col items-center justify-center">
          {isLoading ? (
            <Loader />
          ) : (
            <>
              <span className="text-xs uppercase tracking-wide text-gray-300 mb-1 text-center">
                {value1 || "Total Eligibility Amount"}
              </span>
              <span className="text-xl md:text-2xl font-bold text-white">
                ₹{Math.ceil(mainValue1).toLocaleString(
                  "en-IN",
                  {
                    maximumFractionDigits: 0,
                  }

                )}
              </span>
            </>
          )}
        </div>

        <div className="flex-1 bg-white/10 py-2 md:py-3 px-3 md:px-4 rounded-xl backdrop-blur-md shadow-lg flex flex-col items-center justify-center">
          {isLoading ? (
            <Loader />
          ) : (
            <>
              <span className="text-xs uppercase tracking-wide text-gray-300 mb-1 text-center">
                {value2 || "Total Commission Amount"}
              </span>
              <span className="text-2xl md:text-3xl lg:text-4xl font-bold  truncate w-full text-center text-white ">
                ₹{Math.ceil(mainValue2).toLocaleString("en-IN", {
                          maximumFractionDigits: 0,
                        })}
              </span>
            </>
          )}
        </div>

        <Button
          className="w-full bg-white/20 hover:bg-white/30 text-white rounded-lg py-2 md:py-3 mt-1"
          onClick={handleNavigateToEligibility}
        >
          More Details
        </Button>

        <div className="flex justify-around mt-1 bg-white/10 rounded-xl p-2 backdrop-blur-md">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="p-1.5 md:p-2 text-white hover:bg-white/20 rounded-full transition-all duration-300 hover:scale-110"
                  onClick={handlePhoneClick}
                >
                  <Phone className="h-3.5 w-3.5 md:h-4 md:w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="relative z-50">
                <p>Call: {contactInfo.phone}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="p-1.5 md:p-2 text-white hover:bg-white/20 rounded-full transition-all duration-300 hover:scale-110"
                  onClick={handleWhatsAppClick}
                >
                  <MessageSquare className="h-3.5 w-3.5 md:h-4 md:w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="relative z-50">
                <p>WhatsApp: {contactInfo.whatsapp}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="p-1.5 md:p-2 text-white hover:bg-white/20 rounded-full transition-all duration-300 hover:scale-110"
                  onClick={handleMailClick}
                >
                  <Mail className="h-3.5 w-3.5 md:h-4 md:w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="relative z-50">
                <p>Email: {contactInfo.email}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardContent>
    </Card>
  );
};

export default Card3;
