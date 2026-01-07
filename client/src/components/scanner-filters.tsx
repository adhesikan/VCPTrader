import { useState, useEffect } from "react";
import { Filter, RotateCcw, ChevronDown, Globe, Droplets, Target, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
import { cn } from "@/lib/utils";

interface ScannerFiltersProps {
  filters: ScannerFilters;
  onChange: (filters: ScannerFilters) => void;
  onReset: () => void;
  showConfluence?: boolean;
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

export type PresetId = "conservative" | "balanced" | "aggressive" | "scalp" | "swing" | "high_momentum" | "custom";

interface Preset {
  id: PresetId;
  name: string;
  filters: Partial<ScannerFilters>;
}

const PRESETS: Preset[] = [
  {
    id: "conservative",
    name: "Conservative",
    filters: {
      minPrice: 10,
      maxPrice: 500,
      minVolume: 1000000,
      minDollarVolume: 20000000,
      minRvol: 1.5,
      excludeEtfs: true,
      excludeOtc: true,
    },
  },
  {
    id: "balanced",
    name: "Balanced",
    filters: {
      minPrice: 5,
      maxPrice: 500,
      minVolume: 500000,
      minDollarVolume: 10000000,
      minRvol: 1.2,
      excludeEtfs: true,
      excludeOtc: true,
    },
  },
  {
    id: "aggressive",
    name: "Aggressive",
    filters: {
      minPrice: 2,
      maxPrice: 500,
      minVolume: 200000,
      minDollarVolume: 3000000,
      minRvol: 1.0,
      excludeEtfs: true,
      excludeOtc: true,
    },
  },
  {
    id: "scalp",
    name: "Scalp",
    filters: {
      minPrice: 5,
      maxPrice: 200,
      minVolume: 1000000,
      minDollarVolume: 20000000,
      minRvol: 1.8,
      excludeEtfs: true,
      excludeOtc: true,
    },
  },
  {
    id: "swing",
    name: "Swing",
    filters: {
      minPrice: 10,
      maxPrice: 500,
      minVolume: 300000,
      minDollarVolume: 5000000,
      minRvol: 1.0,
      excludeEtfs: true,
      excludeOtc: true,
    },
  },
  {
    id: "high_momentum",
    name: "High Momentum",
    filters: {
      minPrice: 5,
      maxPrice: 500,
      minVolume: 800000,
      minDollarVolume: 15000000,
      minRvol: 2.0,
      excludeEtfs: true,
      excludeOtc: true,
    },
  },
];

export const defaultFilters: ScannerFilters = PRESETS.find(p => p.id === "balanced")!.filters as ScannerFilters;

function detectPreset(filters: ScannerFilters): PresetId {
  for (const preset of PRESETS) {
    const matches = Object.entries(preset.filters).every(([key, value]) => {
      const filterValue = filters[key as keyof ScannerFilters];
      return filterValue === value;
    });
    if (matches) return preset.id;
  }
  return "custom";
}

export function applyPreset(presetId: PresetId, currentFilters: ScannerFilters): ScannerFilters {
  const preset = PRESETS.find(p => p.id === presetId);
  if (!preset) return currentFilters;
  return { ...currentFilters, ...preset.filters };
}

interface FilterSectionProps {
  title: string;
  description: string;
  icon: typeof Globe;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function FilterSection({ title, description, icon: Icon, children, defaultOpen = true }: FilterSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover-elevate rounded-md">
        <div className="flex items-center gap-3">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <div className="text-left">
            <p className="text-sm font-medium">{title}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-3">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function ScannerFiltersPanel({ filters, onChange, onReset, showConfluence = false }: ScannerFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<PresetId>(() => detectPreset(filters));

  useEffect(() => {
    setSelectedPreset(detectPreset(filters));
  }, [filters]);

  const updateFilter = <K extends keyof ScannerFilters>(
    key: K,
    value: ScannerFilters[K]
  ) => {
    onChange({ ...filters, [key]: value });
  };

  const handlePresetChange = (presetId: PresetId) => {
    if (presetId === "custom") return;
    const newFilters = applyPreset(presetId, filters);
    onChange(newFilters);
    setSelectedPreset(presetId);
  };

  const handleReset = () => {
    if (selectedPreset !== "custom") {
      const presetFilters = applyPreset(selectedPreset, filters);
      onChange(presetFilters);
    } else {
      onReset();
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="flex items-center gap-2 flex-wrap">
        <CollapsibleTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2"
            data-testid="button-toggle-filters"
          >
            <Filter className="h-4 w-4" />
            Filters
            <ChevronDown className={cn("h-3 w-3 transition-transform", isOpen && "rotate-180")} />
          </Button>
        </CollapsibleTrigger>

        <Select value={selectedPreset} onValueChange={(v) => handlePresetChange(v as PresetId)}>
          <SelectTrigger className="w-[140px]" data-testid="select-preset">
            <Sparkles className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRESETS.map((preset) => (
              <SelectItem key={preset.id} value={preset.id}>
                {preset.name}
              </SelectItem>
            ))}
            {selectedPreset === "custom" && (
              <SelectItem value="custom">Custom</SelectItem>
            )}
          </SelectContent>
        </Select>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="gap-1 text-muted-foreground"
          data-testid="button-reset-filters"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </Button>

        {selectedPreset === "custom" && (
          <Badge variant="outline" className="text-xs">Custom</Badge>
        )}
      </div>

      <CollapsibleContent className="mt-4">
        <Card>
          <CardContent className="p-2 space-y-1">
            <FilterSection
              title="Universe"
              description="Choose what to scan"
              icon={Globe}
              defaultOpen={true}
            >
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="universe" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Market
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
              </div>
            </FilterSection>

            <FilterSection
              title="Liquidity"
              description="Filter for tradable stocks"
              icon={Droplets}
              defaultOpen={true}
            >
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
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
            </FilterSection>

            <FilterSection
              title="Signal Quality"
              description="Control signal strength and selectivity"
              icon={Target}
              defaultOpen={true}
            >
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
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

                {showConfluence && (
                  <div className="space-y-2">
                    <Label htmlFor="minConfluence" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Min Confluence
                    </Label>
                    <Select
                      value={String(filters.minConfluence || 2)}
                      onValueChange={(value) => updateFilter("minConfluence" as keyof ScannerFilters, Number(value) as any)}
                    >
                      <SelectTrigger id="minConfluence" data-testid="select-min-confluence">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2">2+ strategies</SelectItem>
                        <SelectItem value="3">3+ strategies</SelectItem>
                        <SelectItem value="4">4+ strategies</SelectItem>
                        <SelectItem value="5">5+ strategies</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Require multiple strategies to align</p>
                  </div>
                )}
              </div>
            </FilterSection>
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
}

export { defaultFilters as BALANCED_FILTERS };
