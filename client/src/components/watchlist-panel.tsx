import { useState } from "react";
import { Plus, X, Edit2, Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Watchlist } from "@shared/schema";

interface WatchlistPanelProps {
  watchlists: Watchlist[];
  selectedWatchlistId?: string;
  onSelectWatchlist: (id: string) => void;
  onCreateWatchlist: (name: string) => void;
  onDeleteWatchlist: (id: string) => void;
  onAddSymbol: (watchlistId: string, symbol: string) => void;
  onRemoveSymbol: (watchlistId: string, symbol: string) => void;
  isLoading?: boolean;
}

export function WatchlistPanel({
  watchlists,
  selectedWatchlistId,
  onSelectWatchlist,
  onCreateWatchlist,
  onDeleteWatchlist,
  onAddSymbol,
  onRemoveSymbol,
  isLoading,
}: WatchlistPanelProps) {
  const [newWatchlistName, setNewWatchlistName] = useState("");
  const [newSymbol, setNewSymbol] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const selectedWatchlist = watchlists.find((w) => w.id === selectedWatchlistId);

  const handleCreateWatchlist = () => {
    if (newWatchlistName.trim()) {
      onCreateWatchlist(newWatchlistName.trim());
      setNewWatchlistName("");
      setIsDialogOpen(false);
    }
  };

  const handleAddSymbol = () => {
    if (newSymbol.trim() && selectedWatchlistId) {
      onAddSymbol(selectedWatchlistId, newSymbol.trim().toUpperCase());
      setNewSymbol("");
    }
  };

  return (
    <div className="flex flex-col h-full" data-testid="watchlist-panel">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h2 className="text-lg font-semibold">Watchlists</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1" data-testid="button-new-watchlist">
              <Plus className="h-4 w-4" />
              New
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Watchlist</DialogTitle>
            </DialogHeader>
            <div className="flex gap-2 mt-4">
              <Input
                placeholder="Watchlist name"
                value={newWatchlistName}
                onChange={(e) => setNewWatchlistName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateWatchlist()}
                data-testid="input-watchlist-name"
              />
              <Button onClick={handleCreateWatchlist} data-testid="button-create-watchlist">
                Create
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {watchlists.map((watchlist) => (
          <Badge
            key={watchlist.id}
            variant={watchlist.id === selectedWatchlistId ? "default" : "outline"}
            className="cursor-pointer gap-1.5"
            onClick={() => onSelectWatchlist(watchlist.id)}
            data-testid={`badge-watchlist-${watchlist.id}`}
          >
            {watchlist.name}
            <span className="text-xs opacity-70">
              ({watchlist.symbols?.length || 0})
            </span>
          </Badge>
        ))}
      </div>

      {selectedWatchlist && (
        <Card className="flex-1 flex flex-col min-h-0">
          <CardHeader className="py-3 px-4 flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base font-medium">
              {selectedWatchlist.name}
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive"
              onClick={() => onDeleteWatchlist(selectedWatchlist.id)}
              data-testid="button-delete-watchlist"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="p-4 pt-0 flex-1 flex flex-col min-h-0">
            <div className="flex gap-2 mb-3">
              <Input
                placeholder="Add symbol (e.g., AAPL)"
                value={newSymbol}
                onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && handleAddSymbol()}
                className="font-mono uppercase"
                data-testid="input-add-symbol"
              />
              <Button
                size="icon"
                onClick={handleAddSymbol}
                disabled={!newSymbol.trim()}
                data-testid="button-add-symbol"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <ScrollArea className="flex-1">
              {selectedWatchlist.symbols && selectedWatchlist.symbols.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {selectedWatchlist.symbols.map((symbol) => (
                    <Badge
                      key={symbol}
                      variant="secondary"
                      className="gap-1 pr-1 font-mono"
                      data-testid={`symbol-${symbol}`}
                    >
                      {symbol}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 ml-1 hover:bg-destructive/20"
                        onClick={() => onRemoveSymbol(selectedWatchlist.id, symbol!)}
                        data-testid={`button-remove-${symbol}`}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No symbols in this watchlist
                </p>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {!selectedWatchlist && watchlists.length > 0 && (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <p className="text-sm">Select a watchlist to view symbols</p>
        </div>
      )}

      {watchlists.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
          <p className="text-sm font-medium">No watchlists yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Create a watchlist to track your favorite stocks
          </p>
        </div>
      )}
    </div>
  );
}
