import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Bell, Plus, Check, Trash2, Filter, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AlertList } from "@/components/alert-card";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Alert, AlertTypeValue, InsertAlert, Watchlist } from "@shared/schema";

export default function Alerts() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedWatchlist, setSelectedWatchlist] = useState<string>("none");
  const [newAlert, setNewAlert] = useState({
    ticker: "",
    type: "BREAKOUT" as AlertTypeValue,
  });
  const { toast } = useToast();

  const { data: alerts, isLoading } = useQuery<Alert[]>({
    queryKey: ["/api/alerts"],
  });

  const { data: watchlists } = useQuery<Watchlist[]>({
    queryKey: ["/api/watchlists"],
  });

  const selectedWatchlistData = watchlists?.find(w => w.id === selectedWatchlist);

  useEffect(() => {
    if (selectedWatchlistData?.symbols && selectedWatchlistData.symbols.length > 0) {
      setNewAlert(prev => ({ ...prev, ticker: selectedWatchlistData.symbols![0] }));
    }
  }, [selectedWatchlistData]);

  const dismissMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("PATCH", `/api/alerts/${id}`, { isRead: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertAlert) => {
      const response = await apiRequest("POST", "/api/alerts", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      setIsCreateOpen(false);
      setNewAlert({
        ticker: "",
        type: "BREAKOUT",
      });
      toast({
        title: "Alert Created",
        description: "You will be notified when conditions are met",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to create alert",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/alerts/mark-all-read", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      toast({
        title: "All alerts marked as read",
      });
    },
  });

  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/alerts", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      toast({
        title: "All alerts cleared",
      });
    },
  });

  const handleCreateAlert = () => {
    if (newAlert.ticker) {
      createMutation.mutate({
        ticker: newAlert.ticker.toUpperCase(),
        type: newAlert.type,
        isRead: false,
      });
    }
  };

  const unreadAlerts = alerts?.filter(a => !a.isRead) || [];
  const readAlerts = alerts?.filter(a => a.isRead) || [];

  const breakoutAlerts = alerts?.filter(a => a.type === "BREAKOUT") || [];
  const stopAlerts = alerts?.filter(a => a.type === "STOP_HIT") || [];
  const approachingAlerts = alerts?.filter(a => a.type === "APPROACHING") || [];

  return (
    <div className="p-6 space-y-6" data-testid="alerts-page">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Alerts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your breakout and price alerts
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllReadMutation.mutate()}
            disabled={unreadAlerts.length === 0}
            className="gap-1"
            data-testid="button-mark-all-read"
          >
            <Check className="h-4 w-4" />
            Mark All Read
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => deleteAllMutation.mutate()}
            disabled={!alerts?.length}
            className="gap-1 text-destructive"
            data-testid="button-clear-all"
          >
            <Trash2 className="h-4 w-4" />
            Clear All
          </Button>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" data-testid="button-create-alert">
                <Plus className="h-4 w-4" />
                New Alert
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create VCP Stage Alert</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                {watchlists && watchlists.length > 0 && (
                  <div className="space-y-2">
                    <Label>From Watchlist (optional)</Label>
                    <Select value={selectedWatchlist} onValueChange={setSelectedWatchlist}>
                      <SelectTrigger data-testid="select-alert-watchlist">
                        <List className="h-4 w-4 mr-2" />
                        <SelectValue placeholder="Select a watchlist" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None - enter manually</SelectItem>
                        {watchlists.map((wl) => (
                          <SelectItem key={wl.id} value={wl.id}>
                            {wl.name} ({wl.symbols?.length || 0} symbols)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="ticker">Symbol</Label>
                  {selectedWatchlistData?.symbols && selectedWatchlistData.symbols.length > 0 ? (
                    <Select
                      value={newAlert.ticker}
                      onValueChange={(value) => setNewAlert(prev => ({ ...prev, ticker: value }))}
                    >
                      <SelectTrigger className="font-mono" data-testid="input-alert-ticker">
                        <SelectValue placeholder="Select symbol" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedWatchlistData.symbols.map((symbol) => (
                          <SelectItem key={symbol} value={symbol}>
                            {symbol}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id="ticker"
                      placeholder="AAPL"
                      value={newAlert.ticker}
                      onChange={(e) => setNewAlert(prev => ({ ...prev, ticker: e.target.value.toUpperCase() }))}
                      className="font-mono uppercase"
                      data-testid="input-alert-ticker"
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type">VCP Stage</Label>
                  <Select
                    value={newAlert.type}
                    onValueChange={(value) => setNewAlert(prev => ({ ...prev, type: value as AlertTypeValue }))}
                  >
                    <SelectTrigger id="type" data-testid="select-alert-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BREAKOUT">
                        <div className="flex flex-col items-start">
                          <span className="font-medium">Breakout</span>
                          <span className="text-xs text-muted-foreground">Alert when price breaks above resistance</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="APPROACHING">
                        <div className="flex flex-col items-start">
                          <span className="font-medium">Ready</span>
                          <span className="text-xs text-muted-foreground">Alert when pattern is ready for breakout</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="EMA_EXIT">
                        <div className="flex flex-col items-start">
                          <span className="font-medium">Forming</span>
                          <span className="text-xs text-muted-foreground">Alert when VCP pattern starts forming</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    You'll be notified when the stock reaches this VCP stage
                  </p>
                </div>

                <Button
                  onClick={handleCreateAlert}
                  disabled={!newAlert.ticker || createMutation.isPending}
                  className="w-full"
                  data-testid="button-submit-alert"
                >
                  {createMutation.isPending ? "Creating..." : "Create Alert"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Badge variant="default" className="gap-1">
          <Bell className="h-3 w-3" />
          Unread <span className="font-mono">{unreadAlerts.length}</span>
        </Badge>
        <Badge variant="secondary" className="gap-1">
          Breakout <span className="font-mono">{breakoutAlerts.length}</span>
        </Badge>
        <Badge variant="outline" className="gap-1">
          Ready <span className="font-mono">{approachingAlerts.length}</span>
        </Badge>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all" data-testid="tab-all">
            All ({alerts?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="unread" data-testid="tab-unread">
            Unread ({unreadAlerts.length})
          </TabsTrigger>
          <TabsTrigger value="read" data-testid="tab-read">
            Read ({readAlerts.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <AlertList
            alerts={alerts || []}
            onDismiss={(id) => dismissMutation.mutate(id)}
          />
        </TabsContent>

        <TabsContent value="unread" className="mt-6">
          <AlertList
            alerts={unreadAlerts}
            onDismiss={(id) => dismissMutation.mutate(id)}
          />
        </TabsContent>

        <TabsContent value="read" className="mt-6">
          <AlertList alerts={readAlerts} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
