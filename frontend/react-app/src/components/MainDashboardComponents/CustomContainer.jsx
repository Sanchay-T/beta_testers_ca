// CustomContainer.jsx
import React from "react";

/**
 * A replacement for Recharts ResponsiveContainer that avoids ResizeObserver errors
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - The components to render inside the container
 * @param {string} props.className - Additional CSS classes to apply
 * @param {string|number} props.width - Width of the container (percentage or pixel value)
 * @param {string|number} props.height - Height of the container (percentage or pixel value)
 * @param {Object} props.style - Additional inline styles to apply
 */
const CustomContainer = ({
  children,
  className = "",
  width = "100%",
  height = "100%",
  style = {},
}) => {
  // Process width and height to ensure they have proper units
  const processSize = (size) => {
    if (typeof size === "number") {
      return `${size}px`;
    }
    return size;
  };

  // Apply width and height along with any additional styles
  const containerStyle = {
    width: processSize(width),
    height: processSize(height),
    position: "relative", // Similar to ResponsiveContainer's positioning
    ...style,
  };

  return (
    <div className={className} style={containerStyle}>
      {children}
    </div>
  );
};

export default CustomContainer;
