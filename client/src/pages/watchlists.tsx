import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { List, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WatchlistPanel } from "@/components/watchlist-panel";
import { ScannerTable } from "@/components/scanner-table";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Watchlist, ScanResult } from "@shared/schema";

export default function Watchlists() {
  const [selectedWatchlistId, setSelectedWatchlistId] = useState<string | undefined>();
  const { toast } = useToast();

  const { data: watchlists, isLoading } = useQuery<Watchlist[]>({
    queryKey: ["/api/watchlists"],
  });

  const { data: watchlistResults, isLoading: resultsLoading } = useQuery<ScanResult[]>({
    queryKey: ["/api/watchlists", selectedWatchlistId, "results"],
    enabled: !!selectedWatchlistId,
  });

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await apiRequest("POST", "/api/watchlists", { name, symbols: [] });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/watchlists"] });
      setSelectedWatchlistId(data.id);
      toast({
        title: "Watchlist created",
        description: `"${data.name}" has been created`,
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to create watchlist",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/watchlists/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/watchlists"] });
      setSelectedWatchlistId(undefined);
      toast({
        title: "Watchlist deleted",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to delete watchlist",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const addSymbolMutation = useMutation({
    mutationFn: async ({ watchlistId, symbol }: { watchlistId: string; symbol: string }) => {
      await apiRequest("POST", `/api/watchlists/${watchlistId}/symbols`, { symbol });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/watchlists"] });
      toast({
        title: "Symbol added",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to add symbol",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const removeSymbolMutation = useMutation({
    mutationFn: async ({ watchlistId, symbol }: { watchlistId: string; symbol: string }) => {
      await apiRequest("DELETE", `/api/watchlists/${watchlistId}/symbols/${symbol}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/watchlists"] });
      toast({
        title: "Symbol removed",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to remove symbol",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const selectedWatchlist = watchlists?.find(w => w.id === selectedWatchlistId);

  return (
    <div className="p-6 space-y-6" data-testid="watchlists-page">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Watchlists</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track names you care about and monitor setups
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1 h-fit">
          <CardHeader>
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <List className="h-4 w-4" />
              My Watchlists
            </CardTitle>
          </CardHeader>
          <CardContent>
            <WatchlistPanel
              watchlists={watchlists || []}
              selectedWatchlistId={selectedWatchlistId}
              onSelectWatchlist={setSelectedWatchlistId}
              onCreateWatchlist={(name) => createMutation.mutate(name)}
              onDeleteWatchlist={(id) => deleteMutation.mutate(id)}
              onAddSymbol={(watchlistId, symbol) => addSymbolMutation.mutate({ watchlistId, symbol })}
              onRemoveSymbol={(watchlistId, symbol) => removeSymbolMutation.mutate({ watchlistId, symbol })}
              isLoading={isLoading}
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-medium">
              {selectedWatchlist ? `${selectedWatchlist.name} - Results` : "Watchlist Results"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedWatchlistId ? (
              <ScannerTable
                results={watchlistResults || []}
                isLoading={resultsLoading}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <List className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-lg font-medium">Select a watchlist</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Choose a watchlist to view VCP analysis for those symbols
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
