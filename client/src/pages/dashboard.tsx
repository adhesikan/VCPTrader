import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  TrendingUp, 
  Search, 
  Bell, 
  List, 
  ArrowRight,
  BarChart3,
  Activity,
  Settings,
  Plug,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertList } from "@/components/alert-card";
import { ScannerTable } from "@/components/scanner-table";
import { useBrokerStatus } from "@/hooks/use-broker-status";
import type { ScanResult, Alert, MarketStats } from "@shared/schema";

export default function Dashboard() {
  const { isConnected } = useBrokerStatus();
  
  const { data: scanResults, isLoading: scanLoading } = useQuery<ScanResult[]>({
    queryKey: ["/api/scan/results"],
  });

  const { data: alerts, isLoading: alertsLoading } = useQuery<Alert[]>({
    queryKey: ["/api/alerts"],
  });

  const { data: marketStats, isLoading: statsLoading } = useQuery<MarketStats>({
    queryKey: ["/api/market/stats"],
  });

  const topResults = scanResults?.slice(0, 5) || [];
  const recentAlerts = alerts?.slice(0, 4) || [];

  const breakoutCount = scanResults?.filter(r => r.stage === "BREAKOUT").length || 0;
  const readyCount = scanResults?.filter(r => r.stage === "READY").length || 0;
  const formingCount = scanResults?.filter(r => r.stage === "FORMING").length || 0;

  return (
    <div className="p-6 space-y-6" data-testid="dashboard-page">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Overview of VCP patterns and market activity
          </p>
        </div>
        <Link href="/scanner">
          <Button className="gap-2" data-testid="button-run-scan">
            <Search className="h-4 w-4" />
            Run Scanner
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card data-testid="card-breakouts">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Breakouts
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-chart-2" />
          </CardHeader>
          <CardContent>
            {scanLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold font-mono">{breakoutCount}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Active breakout patterns
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-ready">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ready
            </CardTitle>
            <Activity className="h-4 w-4 text-chart-1" />
          </CardHeader>
          <CardContent>
            {scanLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold font-mono">{readyCount}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Near breakout threshold
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-forming">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Forming
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-chart-4" />
          </CardHeader>
          <CardContent>
            {scanLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold font-mono">{formingCount}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Developing VCP setups
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-alerts">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Alerts Today
            </CardTitle>
            <Bell className="h-4 w-4 text-chart-5" />
          </CardHeader>
          <CardContent>
            {alertsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold font-mono">
                {alerts?.length || 0}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {alerts?.filter(a => !a.isRead).length || 0} unread
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base font-medium">Top VCP Setups</CardTitle>
              <Link href="/scanner">
                <Button variant="ghost" size="sm" className="gap-1 text-xs">
                  View All <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {!scanLoading && topResults.length === 0 && !isConnected ? (
                <div className="py-8 text-center">
                  <Plug className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
                  <p className="text-muted-foreground font-medium">No broker connected</p>
                  <p className="text-sm text-muted-foreground/70 mt-1 mb-4">
                    Connect your brokerage to see live VCP data
                  </p>
                  <Link href="/settings">
                    <Button variant="outline" size="sm" className="gap-2">
                      <Settings className="h-4 w-4" />
                      Go to Settings
                    </Button>
                  </Link>
                </div>
              ) : (
                <ScannerTable results={topResults} isLoading={scanLoading} />
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base font-medium">Recent Alerts</CardTitle>
              <Link href="/alerts">
                <Button variant="ghost" size="sm" className="gap-1 text-xs">
                  View All <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {alertsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ) : recentAlerts.length === 0 ? (
                <div className="py-6 text-center">
                  <Bell className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">No alerts yet</p>
                </div>
              ) : (
                <AlertList alerts={recentAlerts} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="hover-elevate cursor-pointer" data-testid="card-quick-scan">
          <Link href="/scanner">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-md bg-primary/10 flex items-center justify-center">
                <Search className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-medium">Quick Scan</h3>
                <p className="text-sm text-muted-foreground">
                  Find VCP setups now
                </p>
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover-elevate cursor-pointer" data-testid="card-manage-alerts">
          <Link href="/alerts">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-md bg-chart-5/10 flex items-center justify-center">
                <Bell className="h-6 w-6 text-chart-5" />
              </div>
              <div>
                <h3 className="font-medium">Manage Alerts</h3>
                <p className="text-sm text-muted-foreground">
                  Configure notifications
                </p>
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover-elevate cursor-pointer" data-testid="card-watchlists">
          <Link href="/watchlists">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-md bg-chart-2/10 flex items-center justify-center">
                <List className="h-6 w-6 text-chart-2" />
              </div>
              <div>
                <h3 className="font-medium">Watchlists</h3>
                <p className="text-sm text-muted-foreground">
                  Track your favorites
                </p>
              </div>
            </CardContent>
          </Link>
        </Card>
      </div>
    </div>
  );
}
