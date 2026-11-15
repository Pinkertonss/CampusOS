"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

interface SupportContextType {
  isOpen: boolean;
  activeTab: "help" | "bug" | "request" | "tickets";
  openSupport: (tab?: "help" | "bug" | "request" | "tickets") => void;
  closeSupport: () => void;
  setActiveTab: (tab: "help" | "bug" | "request" | "tickets") => void;
}

const SupportContext = createContext<SupportContextType | undefined>(undefined);

export function SupportProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"help" | "bug" | "request" | "tickets">("help");

  const openSupport = (tab: "help" | "bug" | "request" | "tickets" = "help") => {
    setActiveTab(tab);
    setIsOpen(true);
  };

  const closeSupport = () => {
    setIsOpen(false);
  };

  return (
    <SupportContext.Provider
      value={{
        isOpen,
        activeTab,
        openSupport,
        closeSupport,
        setActiveTab,
      }}
    >
      {children}
    </SupportContext.Provider>
  );
}

export function useSupport() {
  const context = useContext(SupportContext);
  if (!context) {
    throw new Error("useSupport must be used within a SupportProvider");
  }
  return context;
}
