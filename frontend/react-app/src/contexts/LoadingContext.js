// contexts/LoadingContext.jsx
import React, { createContext, useContext, useState } from 'react';

const LoadingContext = createContext();

export function LoadingProvider({ children }) {
  const [isExcelLoading, setIsExcelLoading] = useState(false);
  const [isReportLoading, setIsReportLoading] = useState(false);
  
  return (
    <LoadingContext.Provider value={{ 
      isExcelLoading, 
      setIsExcelLoading,
      isReportLoading, 
      setIsReportLoading 
    }}>
      {children}
    </LoadingContext.Provider>
  );
}

export function useLoading() {
    const context = useContext(LoadingContext);
    if (context === undefined) {
      throw new Error('useLoading must be used within a LoadingProvider');
    }
    return context;
  }