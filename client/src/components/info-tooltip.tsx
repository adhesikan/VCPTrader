import type { ReactNode } from "react";
import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const tradingTerms: Record<string, string> = {
  resistance: "Price level where the stock has struggled to break above. A breakout happens when price pushes through this ceiling.",
  stopLoss: "Safety price level to exit a trade and limit losses. Placed below recent support to protect your capital.",
  atr: "Average True Range measures daily price volatility over 14 days. Higher ATR means bigger price swings.",
  rvol: "Relative Volume compares current volume to the 20-day average. Above 1.5x often signals strong interest.",
  ema9: "9-day Exponential Moving Average. Fast-moving trend indicator that reacts quickly to price changes.",
  ema21: "21-day Exponential Moving Average. Medium-term trend indicator balancing responsiveness and stability.",
  ema50: "50-day Exponential Moving Average. Slower trend indicator showing the intermediate-term direction.",
  rrRatio: "Risk/Reward Ratio compares potential profit (to resistance) vs. potential loss (to stop). Higher is better — most traders look for 2:1 or more.",
  vcpScore: "Pattern quality score (0-100) based on volatility contraction, volume dry-up, and base structure. Higher scores indicate stronger setups.",
  trend: "Overall price direction based on moving average alignment. Bullish when shorter EMAs are above longer ones.",
  volume: "Number of shares traded. Higher volume confirms price moves and indicates stronger conviction.",
  avgVolume: "Average daily shares traded over 20 days. Used as baseline to compare current activity.",
  toResistance: "Percentage distance from current price to resistance level. Shows potential upside if breakout occurs.",
};

interface InfoTooltipProps {
  term: keyof typeof tradingTerms;
  className?: string;
}

export function InfoTooltip({ term, className = "" }: InfoTooltipProps) {
  const description = tradingTerms[term];
  if (!description) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Info 
          className={`h-3 w-3 text-muted-foreground/60 cursor-help inline-block ${className}`}
          data-testid={`tooltip-trigger-${term}`}
        />
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs" side="top">
        <p>{description}</p>
      </TooltipContent>
    </Tooltip>
  );
}

interface LabelWithTooltipProps {
  label: string;
  term: keyof typeof tradingTerms;
  className?: string;
  children?: ReactNode;
}

export function LabelWithTooltip({ label, term, className = "", children }: LabelWithTooltipProps) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {children}
      {label}
      <InfoTooltip term={term} />
    </span>
  );
}
