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
  initialCapital: "Starting amount of money for the backtest simulation. This is the total capital you would invest.",
  positionSize: "Percentage of your total capital to allocate to each trade. Lower percentages reduce risk but also potential gains.",
  stopLossPercent: "Maximum percentage loss allowed before automatically exiting the trade. Protects capital from large drawdowns.",
  startDate: "Beginning date of the historical data period to test the strategy against.",
  endDate: "Ending date of the historical data period. The strategy will be tested between start and end dates.",
  ticker: "Stock symbol to run the backtest on. Uses historical price data from your connected broker.",
  totalReturn: "Overall percentage gain or loss from all trades during the backtest period.",
  winRate: "Percentage of trades that were profitable. Higher win rates indicate more consistent performance.",
  sharpeRatio: "Risk-adjusted return metric. Higher values (above 1.0) indicate better risk-adjusted performance.",
  maxDrawdown: "Largest peak-to-trough decline during the backtest. Lower values indicate less volatile returns.",
  profitFactor: "Ratio of gross profits to gross losses. Values above 1.0 mean the strategy is profitable overall.",
  totalTrades: "Total number of buy/sell transactions executed during the backtest period.",
  avgReturn: "Average percentage return per trade. Shows the typical gain or loss you can expect from each position.",
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
        <span 
          className={`inline-flex items-center cursor-help ${className}`}
          data-testid={`tooltip-trigger-${term}`}
        >
          <Info className="h-3 w-3 text-muted-foreground/60" />
        </span>
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
