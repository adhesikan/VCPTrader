import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from "react";

interface TooltipContextType {
  tooltipsEnabled: boolean;
  setTooltipsEnabled: (enabled: boolean) => void;
}

const TooltipContext = createContext<TooltipContextType | undefined>(undefined);

const STORAGE_KEY = "vcp-tooltips-enabled";

export function TooltipVisibilityProvider({ children }: { children: ReactNode }) {
  const [tooltipsEnabled, setTooltipsEnabledState] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored !== "false";
    }
    return true;
  });
  
  const hasFetched = useRef(false);
  
  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    
    const fetchUserSettings = async () => {
      try {
        const response = await fetch("/api/user/settings", { credentials: "include" });
        if (response.ok) {
          const settings = await response.json();
          if (typeof settings.showTooltips === "boolean") {
            setTooltipsEnabledState(settings.showTooltips);
            localStorage.setItem(STORAGE_KEY, String(settings.showTooltips));
          }
        }
      } catch {
      }
    };
    
    fetchUserSettings();
  }, []);

  const setTooltipsEnabled = (enabled: boolean) => {
    setTooltipsEnabledState(enabled);
    localStorage.setItem(STORAGE_KEY, String(enabled));
  };

  return (
    <TooltipContext.Provider value={{ tooltipsEnabled, setTooltipsEnabled }}>
      {children}
    </TooltipContext.Provider>
  );
}

export function useTooltipVisibility() {
  const context = useContext(TooltipContext);
  if (context === undefined) {
    throw new Error("useTooltipVisibility must be used within a TooltipVisibilityProvider");
  }
  return context;
}
