import { StrategyPlugin, ScanResultOutput } from "../strategies/types";

export interface ConfluenceResult {
  symbol: string;
  name: string;
  price: number;
  matchedStrategies: string[];
  strategyResults: ScanResultOutput[];
  confluenceScore: number;
  primaryStage: string;
  keyLevels: {
    resistance?: number;
    support?: number;
    stop?: number;
  };
  explanation: string;
}

export function aggregateConfluence(
  symbol: string,
  results: ScanResultOutput[],
  bonusPerMatch: number = 10
): ConfluenceResult | null {
  const activeResults = results.filter(r => 
    r.stage === "READY" || r.stage === "TRIGGERED" || r.stage === "BREAKOUT"
  );

  if (activeResults.length === 0) return null;

  const maxScore = Math.max(...activeResults.map(r => r.score));
  const bonusScore = (activeResults.length - 1) * bonusPerMatch;
  const confluenceScore = Math.min(100, maxScore + bonusScore);

  const primaryResult = activeResults.reduce((best, current) => 
    current.score > best.score ? current : best
  );

  const matchedStrategies = activeResults.map(r => r.strategyId);

  const allResistances = activeResults
    .map(r => r.levels.resistance)
    .filter((r): r is number => r !== undefined);
  const allStops = activeResults
    .map(r => r.levels.stopLevel)
    .filter((s): s is number => s !== undefined);

  const explanation = activeResults.length > 1
    ? `${activeResults.length} strategies aligned: ${matchedStrategies.join(", ")}. This alert is informational only and not investment advice.`
    : `Single strategy match: ${matchedStrategies[0]}. This alert is informational only and not investment advice.`;

  return {
    symbol,
    name: primaryResult.name || symbol,
    price: primaryResult.price,
    matchedStrategies,
    strategyResults: activeResults,
    confluenceScore: Math.round(confluenceScore),
    primaryStage: primaryResult.stage,
    keyLevels: {
      resistance: allResistances.length > 0 ? Math.max(...allResistances) : undefined,
      support: undefined,
      stop: allStops.length > 0 ? Math.min(...allStops) : undefined,
    },
    explanation,
  };
}

export function filterByMinMatches(
  results: ConfluenceResult[],
  minMatches: number
): ConfluenceResult[] {
  return results.filter(r => r.matchedStrategies.length >= minMatches);
}

export function rankByConfluence(results: ConfluenceResult[]): ConfluenceResult[] {
  return [...results].sort((a, b) => {
    if (b.matchedStrategies.length !== a.matchedStrategies.length) {
      return b.matchedStrategies.length - a.matchedStrategies.length;
    }
    return b.confluenceScore - a.confluenceScore;
  });
}
