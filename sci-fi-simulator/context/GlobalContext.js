import React, { createContext, useContext, useState } from "react";

const GlobalContext = createContext();

export const GlobalProvider = ({ children }) => {
  const [resourceAllocation, setResourceAllocation] = useState({});
  const [activeStatus, setActiveStatus] = useState({});

  return (
    <GlobalContext.Provider
      value={{
        resourceAllocation,
        setResourceAllocation,
        activeStatus,
        setActiveStatus,
      }}
    >
      {children}
    </GlobalContext.Provider>
  );
};

export const useGlobalContext = () => useContext(GlobalContext);
