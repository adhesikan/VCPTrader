import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Newspaper, Search, ExternalLink, AlertCircle, Info } from "lucide-react";

interface NewsArticle {
  title: string;
  source: string;
  date: string;
  url: string;
  imageUrl?: string;
}

interface NewsResponse {
  ok: boolean;
  ticker?: string;
  items?: number;
  articles?: NewsArticle[];
  error?: string;
}

const STORAGE_KEY = "vcp_last_news_ticker";

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffHours < 1) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return `${diffMins} min ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
      });
    }
  } catch {
    return dateStr;
  }
}

export default function NewsPage() {
  const [ticker, setTicker] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(STORAGE_KEY) || "";
    }
    return "";
  });
  const [searchTicker, setSearchTicker] = useState("");
  const [items, setItems] = useState("10");

  const { data, isLoading, error, refetch, isFetching } = useQuery<NewsResponse>({
    queryKey: ["/api/news", { ticker: searchTicker, items }],
    queryFn: async () => {
      const response = await fetch(`/api/news?ticker=${encodeURIComponent(searchTicker)}&items=${items}`);
      return response.json();
    },
    enabled: !!searchTicker,
  });

  useEffect(() => {
    if (searchTicker) {
      localStorage.setItem(STORAGE_KEY, searchTicker);
    }
  }, [searchTicker]);

  const handleSearch = () => {
    const cleanTicker = ticker.trim().toUpperCase();
    if (cleanTicker) {
      setSearchTicker(cleanTicker);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <div className="container max-w-4xl mx-auto p-4 space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Newspaper className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-semibold" data-testid="text-news-title">News & Research</h1>
        </div>
        <p className="text-muted-foreground" data-testid="text-news-subtitle">
          Search recent headlines for research purposes only.
        </p>
      </div>

      <Alert className="border-muted bg-muted/30" data-testid="alert-news-disclaimer">
        <Info className="h-4 w-4" />
        <AlertDescription className="text-sm text-muted-foreground">
          Headlines are provided for general information only and are not investment advice. 
          No interpretation or recommendation is implied.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Search Headlines</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Input
                placeholder="Enter ticker (e.g., AAPL)"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                onKeyDown={handleKeyDown}
                className="uppercase"
                data-testid="input-news-ticker"
              />
            </div>
            <Select value={items} onValueChange={setItems}>
              <SelectTrigger className="w-full sm:w-28" data-testid="select-news-items">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5 items</SelectItem>
                <SelectItem value="10">10 items</SelectItem>
                <SelectItem value="15">15 items</SelectItem>
                <SelectItem value="20">20 items</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={handleSearch}
              disabled={!ticker.trim() || isFetching}
              data-testid="button-news-search"
            >
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {!searchTicker && !isLoading && (
        <div className="text-center py-12 text-muted-foreground" data-testid="text-news-empty-state">
          <Newspaper className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>Search a ticker to see recent headlines.</p>
        </div>
      )}

      {(isLoading || isFetching) && searchTicker && (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex gap-4">
                  <Skeleton className="h-16 w-16 rounded flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {error && (
        <Alert variant="destructive" data-testid="alert-news-error">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Couldn't load headlines right now. Try again.
          </AlertDescription>
        </Alert>
      )}

      {data && !data.ok && (
        <Alert variant="destructive" data-testid="alert-news-api-error">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{data.error || "Please enter a valid ticker symbol."}</AlertDescription>
        </Alert>
      )}

      {data?.ok && data.articles && !isFetching && (
        <div className="space-y-3" data-testid="container-news-results">
          <p className="text-sm text-muted-foreground" data-testid="text-news-results-summary">
            Showing {data.articles.length} recent headlines for <span className="font-medium">{data.ticker}</span>
          </p>
          
          {data.articles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-news-no-results">
              <p>No recent headlines found for {data.ticker}.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.articles.map((article, index) => (
                <a
                  key={index}
                  href={article.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="block group"
                  data-testid={`link-news-article-${index}`}
                >
                  <Card className="hover-elevate transition-colors">
                    <CardContent className="p-4">
                      <div className="flex gap-4">
                        {article.imageUrl && (
                          <div className="flex-shrink-0 hidden sm:block">
                            <img
                              src={article.imageUrl}
                              alt=""
                              className="h-16 w-24 object-cover rounded"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = "none";
                              }}
                            />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium line-clamp-2 group-hover:underline" data-testid={`text-news-article-title-${index}`}>
                            {article.title}
                          </h3>
                          <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground" data-testid={`text-news-article-meta-${index}`}>
                            <span>{article.source}</span>
                            <span>·</span>
                            <span>{formatDate(article.date)}</span>
                            <ExternalLink className="h-3 w-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="text-xs text-muted-foreground text-center pt-4 border-t" data-testid="text-news-footer">
        Headlines provided by Stock News API for informational purposes only.
      </div>
    </div>
  );
}
