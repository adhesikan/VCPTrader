import { useState, useEffect } from "react";
import { Check, ChevronDown, Zap, TrendingUp, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { STRATEGY_CONFIGS, type StrategyConfig } from "@shared/strategies";
import { cn } from "@/lib/utils";

interface StrategySelectorProps {
  selectedStrategies: string[];
  onChange: (strategies: string[]) => void;
  mode: "single" | "multi";
}

const categoryIcons: Record<string, typeof Zap> = {
  "Momentum Engine": Zap,
  "Trend Engine": TrendingUp,
  "Volatility Engine": Activity,
};

const groupByCategory = (strategies: StrategyConfig[]) => {
  const groups: Record<string, StrategyConfig[]> = {};
  for (const strategy of strategies) {
    if (!groups[strategy.category]) {
      groups[strategy.category] = [];
    }
    groups[strategy.category].push(strategy);
  }
  return groups;
};

export function StrategySelector({ selectedStrategies, onChange, mode }: StrategySelectorProps) {
  const [open, setOpen] = useState(false);
  const grouped = groupByCategory(STRATEGY_CONFIGS);

  const handleToggle = (strategyId: string) => {
    if (mode === "single") {
      onChange([strategyId]);
      setOpen(false);
    } else {
      if (selectedStrategies.includes(strategyId)) {
        onChange(selectedStrategies.filter(s => s !== strategyId));
      } else {
        onChange([...selectedStrategies, strategyId]);
      }
    }
  };

  const handleSelectAll = () => {
    onChange(STRATEGY_CONFIGS.map(s => s.id));
  };

  const handleSelectNone = () => {
    onChange([]);
  };

  const handleSelectCategory = (category: string) => {
    const categoryStrategies = STRATEGY_CONFIGS.filter(s => s.category === category).map(s => s.id as string);
    const allSelected = categoryStrategies.every(s => selectedStrategies.includes(s));
    
    if (allSelected) {
      onChange(selectedStrategies.filter(s => !categoryStrategies.includes(s)));
    } else {
      const newSelection = [...selectedStrategies];
      for (const stratId of categoryStrategies) {
        if (!newSelection.includes(stratId)) {
          newSelection.push(stratId);
        }
      }
      onChange(newSelection);
    }
  };

  const getDisplayText = () => {
    if (selectedStrategies.length === 0) {
      return "Select strategies";
    }
    if (selectedStrategies.length === 1) {
      const strategy = STRATEGY_CONFIGS.find(s => s.id === selectedStrategies[0]);
      return strategy?.displayName || selectedStrategies[0];
    }
    if (selectedStrategies.length === STRATEGY_CONFIGS.length) {
      return "All Strategies";
    }
    return `${selectedStrategies.length} strategies`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-[220px] justify-between gap-2"
          data-testid="button-strategy-selector"
        >
          <div className="flex items-center gap-2 truncate">
            <TrendingUp className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{getDisplayText()}</span>
          </div>
          <ChevronDown className="h-4 w-4 flex-shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        {mode === "multi" && (
          <div className="flex items-center justify-between gap-2 p-2 border-b">
            <Button variant="ghost" size="sm" onClick={handleSelectAll} data-testid="button-select-all">
              Select All
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSelectNone} data-testid="button-select-none">
              Clear All
            </Button>
          </div>
        )}
        <div className="max-h-[350px] overflow-y-auto p-2">
          {Object.entries(grouped).map(([category, strategies]) => {
            const Icon = categoryIcons[category] || TrendingUp;
            const categorySelected = strategies.filter(s => selectedStrategies.includes(s.id)).length;
            
            return (
              <div key={category} className="mb-3 last:mb-0">
                <div 
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground",
                    mode === "multi" && "cursor-pointer hover-elevate rounded"
                  )}
                  onClick={() => mode === "multi" && handleSelectCategory(category)}
                  data-testid={`category-${category.replace(/\s+/g, "-").toLowerCase()}`}
                >
                  <Icon className="h-3 w-3" />
                  <span>{category}</span>
                  {mode === "multi" && (
                    <Badge variant="outline" className="ml-auto text-xs">
                      {categorySelected}/{strategies.length}
                    </Badge>
                  )}
                </div>
                <div className="space-y-0.5">
                  {strategies.map((strategy) => {
                    const isSelected = selectedStrategies.includes(strategy.id);
                    return (
                      <div
                        key={strategy.id}
                        className={cn(
                          "flex items-center gap-3 px-2 py-2 rounded cursor-pointer hover-elevate",
                          isSelected && "bg-accent"
                        )}
                        onClick={() => handleToggle(strategy.id)}
                        data-testid={`strategy-option-${strategy.id}`}
                      >
                        {mode === "multi" ? (
                          <Checkbox
                            checked={isSelected}
                            className="pointer-events-none"
                          />
                        ) : (
                          <div className={cn("h-4 w-4 flex items-center justify-center", isSelected ? "text-primary" : "text-transparent")}>
                            <Check className="h-4 w-4" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{strategy.displayName}</p>
                          <p className="text-xs text-muted-foreground truncate">{strategy.shortDescription}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
