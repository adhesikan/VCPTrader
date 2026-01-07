import { useState } from "react";
import { Filter, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Card, CardContent } from "@/components/ui/card";
import type { ScannerFilters } from "@shared/schema";

interface ScannerFiltersProps {
  filters: ScannerFilters;
  onChange: (filters: ScannerFilters) => void;
  onReset: () => void;
}

const SECTOR_OPTIONS = [
  { value: "all", label: "All Sectors" },
  { value: "Technology", label: "Technology" },
  { value: "Healthcare", label: "Healthcare" },
  { value: "Financial Services", label: "Financial" },
  { value: "Consumer Cyclical", label: "Consumer Cyclical" },
  { value: "Consumer Defensive", label: "Consumer Defensive" },
  { value: "Industrials", label: "Industrials" },
  { value: "Energy", label: "Energy" },
  { value: "Basic Materials", label: "Basic Materials" },
  { value: "Communication Services", label: "Communication" },
  { value: "Real Estate", label: "Real Estate" },
  { value: "Utilities", label: "Utilities" },
];

const defaultFilters: ScannerFilters = {
  minPrice: 5,
  maxPrice: 500,
  minVolume: 500000,
  minDollarVolume: 1000000,
  minRvol: 1,
  excludeEtfs: true,
  excludeOtc: true,
  universe: "all",
  sector: undefined,
  strategies: undefined,
};

export function ScannerFiltersPanel({ filters, onChange, onReset }: ScannerFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);

  const updateFilter = <K extends keyof ScannerFilters>(
    key: K,
    value: ScannerFilters[K]
  ) => {
    onChange({ ...filters, [key]: value });
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="flex items-center gap-2">
        <CollapsibleTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2"
            data-testid="button-toggle-filters"
          >
            <Filter className="h-4 w-4" />
            Filters
          </Button>
        </CollapsibleTrigger>
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="gap-1 text-muted-foreground"
          data-testid="button-reset-filters"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </Button>
      </div>

      <CollapsibleContent className="mt-4">
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <div className="space-y-2">
                <Label htmlFor="universe" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Universe
                </Label>
                <Select
                  value={filters.universe || "all"}
                  onValueChange={(value) => updateFilter("universe", value as ScannerFilters["universe"])}
                >
                  <SelectTrigger id="universe" data-testid="select-universe">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All US Stocks</SelectItem>
                    <SelectItem value="sp500">S&P 500</SelectItem>
                    <SelectItem value="nasdaq100">Nasdaq 100</SelectItem>
                    <SelectItem value="dow30">Dow 30</SelectItem>
                    <SelectItem value="watchlist">My Watchlist</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sector" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Sector
                </Label>
                <Select
                  value={filters.sector || "all"}
                  onValueChange={(value) => updateFilter("sector", value === "all" ? undefined : value)}
                >
                  <SelectTrigger id="sector" data-testid="select-sector">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SECTOR_OPTIONS.map((sector) => (
                      <SelectItem key={sector.value} value={sector.value}>
                        {sector.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="minPrice" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Min Price
                </Label>
                <Input
                  id="minPrice"
                  type="number"
                  placeholder="$5"
                  value={filters.minPrice || ""}
                  onChange={(e) => updateFilter("minPrice", e.target.value ? Number(e.target.value) : undefined)}
                  className="font-mono"
                  data-testid="input-min-price"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxPrice" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Max Price
                </Label>
                <Input
                  id="maxPrice"
                  type="number"
                  placeholder="$500"
                  value={filters.maxPrice || ""}
                  onChange={(e) => updateFilter("maxPrice", e.target.value ? Number(e.target.value) : undefined)}
                  className="font-mono"
                  data-testid="input-max-price"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="minVolume" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Min Volume
                </Label>
                <Input
                  id="minVolume"
                  type="number"
                  placeholder="500K"
                  value={filters.minVolume || ""}
                  onChange={(e) => updateFilter("minVolume", e.target.value ? Number(e.target.value) : undefined)}
                  className="font-mono"
                  data-testid="input-min-volume"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="minRvol" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Min RVOL
                </Label>
                <Input
                  id="minRvol"
                  type="number"
                  step="0.1"
                  placeholder="1.0x"
                  value={filters.minRvol || ""}
                  onChange={(e) => updateFilter("minRvol", e.target.value ? Number(e.target.value) : undefined)}
                  className="font-mono"
                  data-testid="input-min-rvol"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="minDollarVol" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Min $ Volume
                </Label>
                <Input
                  id="minDollarVol"
                  type="number"
                  placeholder="$1M"
                  value={filters.minDollarVolume || ""}
                  onChange={(e) => updateFilter("minDollarVolume", e.target.value ? Number(e.target.value) : undefined)}
                  className="font-mono"
                  data-testid="input-min-dollar-volume"
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  id="excludeEtfs"
                  checked={filters.excludeEtfs ?? true}
                  onCheckedChange={(checked) => updateFilter("excludeEtfs", checked)}
                  data-testid="switch-exclude-etfs"
                />
                <Label htmlFor="excludeEtfs" className="text-sm">
                  Exclude ETFs
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="excludeOtc"
                  checked={filters.excludeOtc ?? true}
                  onCheckedChange={(checked) => updateFilter("excludeOtc", checked)}
                  data-testid="switch-exclude-otc"
                />
                <Label htmlFor="excludeOtc" className="text-sm">
                  Exclude OTC
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
}

export { defaultFilters };
