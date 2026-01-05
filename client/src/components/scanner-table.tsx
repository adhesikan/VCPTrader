import { useState } from "react";
import { ArrowUpDown, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ScanResult, PatternStageType } from "@shared/schema";

type SortField = "ticker" | "price" | "changePercent" | "volume" | "rvol" | "patternScore" | "stage";
type SortDirection = "asc" | "desc";

const STAGE_ORDER: Record<string, number> = {
  "BREAKOUT": 4,
  "READY": 3,
  "APPROACHING": 2,
  "FORMING": 1,
};

interface ScannerTableProps {
  results: ScanResult[];
  isLoading?: boolean;
  onRowClick?: (result: ScanResult) => void;
  searchQuery?: string;
}

function formatVolume(vol: number | null | undefined): string {
  if (!vol) return "-";
  if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(1)}M`;
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(1)}K`;
  return vol.toFixed(0);
}

function formatPrice(price: number | null | undefined): string {
  if (!price) return "-";
  return `$${price.toFixed(2)}`;
}

function formatPercent(pct: number | null | undefined): string {
  if (pct === null || pct === undefined) return "-";
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

function getStageBadgeVariant(stage: PatternStageType): "default" | "secondary" | "destructive" | "outline" {
  switch (stage) {
    case "BREAKOUT":
      return "default";
    case "READY":
      return "secondary";
    case "FORMING":
      return "outline";
    default:
      return "outline";
  }
}

export function ScannerTable({ results, isLoading, onRowClick, searchQuery = "" }: ScannerTableProps) {
  const [sortField, setSortField] = useState<SortField>("patternScore");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const filteredResults = results.filter((r) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      r.ticker.toLowerCase().includes(query) ||
      (r.name && r.name.toLowerCase().includes(query))
    );
  });

  const sortedResults = [...filteredResults].sort((a, b) => {
    const modifier = sortDirection === "asc" ? 1 : -1;
    
    if (sortField === "stage") {
      const aOrder = STAGE_ORDER[a.stage] ?? 0;
      const bOrder = STAGE_ORDER[b.stage] ?? 0;
      return (aOrder - bOrder) * modifier;
    }
    
    const aVal = a[sortField] ?? 0;
    const bVal = b[sortField] ?? 0;
    if (typeof aVal === "string" && typeof bVal === "string") {
      return aVal.localeCompare(bVal) * modifier;
    }
    return ((aVal as number) - (bVal as number)) * modifier;
  });

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8 gap-1 font-medium"
      onClick={() => handleSort(field)}
      data-testid={`sort-${field}`}
    >
      {children}
      {sortField === field ? (
        sortDirection === "asc" ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )
      ) : (
        <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
      )}
    </Button>
  );

  if (isLoading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Symbol</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Change</TableHead>
              <TableHead className="text-right">Volume</TableHead>
              <TableHead className="text-right">RVOL</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead className="text-right">Resistance</TableHead>
              <TableHead className="text-right">Stop</TableHead>
              <TableHead className="text-right">Score</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 8 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 9 }).map((_, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-16">
        <div className="text-center">
          <p className="text-lg font-medium">No patterns found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Run a scan to find VCP setups
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border" data-testid="scanner-table">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-card">
          <TableRow>
            <TableHead className="w-[100px]">
              <SortHeader field="ticker">Symbol</SortHeader>
            </TableHead>
            <TableHead className="text-right">
              <SortHeader field="price">Price</SortHeader>
            </TableHead>
            <TableHead className="text-right">
              <SortHeader field="changePercent">Change</SortHeader>
            </TableHead>
            <TableHead className="text-right">
              <SortHeader field="volume">Volume</SortHeader>
            </TableHead>
            <TableHead className="text-right">
              <SortHeader field="rvol">RVOL</SortHeader>
            </TableHead>
            <TableHead>
              <SortHeader field="stage">Stage</SortHeader>
            </TableHead>
            <TableHead className="text-right">Resistance</TableHead>
            <TableHead className="text-right">Stop</TableHead>
            <TableHead className="text-right">
              <SortHeader field="patternScore">Score</SortHeader>
            </TableHead>
            <TableHead className="w-[40px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedResults.map((result) => {
            const isExpanded = expandedRow === result.id;
            const changeColor = (result.changePercent ?? 0) >= 0 
              ? "text-chart-2" 
              : "text-destructive";

            return (
              <TableRow
                key={result.id}
                className="cursor-pointer hover-elevate"
                onClick={() => {
                  setExpandedRow(isExpanded ? null : result.id);
                  onRowClick?.(result);
                }}
                data-testid={`row-${result.ticker}`}
              >
                <TableCell className="font-mono font-semibold">
                  {result.ticker}
                  {result.name && (
                    <span className="ml-2 text-xs text-muted-foreground font-normal">
                      {result.name.length > 15 ? result.name.slice(0, 15) + "..." : result.name}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatPrice(result.price)}
                </TableCell>
                <TableCell className={`text-right font-mono ${changeColor}`}>
                  {formatPercent(result.changePercent)}
                </TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">
                  {formatVolume(result.volume)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {result.rvol ? `${result.rvol.toFixed(1)}x` : "-"}
                </TableCell>
                <TableCell>
                  <Badge variant={getStageBadgeVariant(result.stage as PatternStageType)}>
                    {result.stage}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">
                  {formatPrice(result.resistance)}
                </TableCell>
                <TableCell className="text-right font-mono text-destructive">
                  {formatPrice(result.stopLoss)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <div className="h-1.5 w-12 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${Math.min(100, result.patternScore ?? 0)}%` }}
                      />
                    </div>
                    <span className="font-mono text-xs w-6 text-right">
                      {result.patternScore ?? 0}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <Link href={`/charts/${result.ticker}`}>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="h-7 w-7"
                      data-testid={`button-chart-${result.ticker}`}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
