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

interface CacheEntry {
  data: NewsResponse;
  timestamp: number;
}

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const CACHE_TTL_MS = 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 30;

const newsCache = new Map<string, CacheEntry>();
const rateLimitMap = new Map<string, RateLimitEntry>();

function getCacheKey(ticker: string, items: number): string {
  return `${ticker.toUpperCase()}_${items}`;
}

function getCachedResponse(ticker: string, items: number): NewsResponse | null {
  const key = getCacheKey(ticker, items);
  const entry = newsCache.get(key);
  
  if (!entry) return null;
  
  const now = Date.now();
  if (now - entry.timestamp > CACHE_TTL_MS) {
    newsCache.delete(key);
    return null;
  }
  
  return entry.data;
}

function setCachedResponse(ticker: string, items: number, data: NewsResponse): void {
  const key = getCacheKey(ticker, items);
  newsCache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  
  if (!entry) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return true;
  }
  
  if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return true;
  }
  
  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }
  
  entry.count++;
  return true;
}

function validateTicker(ticker: string): boolean {
  if (!ticker || typeof ticker !== "string") return false;
  const clean = ticker.trim().toUpperCase();
  if (clean.length < 1 || clean.length > 10) return false;
  return /^[A-Z][A-Z0-9.\-]*$/.test(clean);
}

export async function fetchNews(ticker: string, items: number = 10): Promise<NewsResponse> {
  const token = process.env.STOCKNEWSAPI_TOKEN;
  
  if (!token) {
    return { ok: false, error: "News service is not configured" };
  }
  
  const cleanTicker = ticker.trim().toUpperCase();
  
  if (!validateTicker(cleanTicker)) {
    return { ok: false, error: "Please enter a valid ticker symbol" };
  }
  
  const clampedItems = Math.max(1, Math.min(20, items));
  
  const cached = getCachedResponse(cleanTicker, clampedItems);
  if (cached) {
    return cached;
  }
  
  try {
    const url = `https://stocknewsapi.com/api/v1?tickers=${encodeURIComponent(cleanTicker)}&items=${clampedItems}&token=${token}`;
    
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
    });
    
    if (!response.ok) {
      return { ok: false, error: "Couldn't load headlines right now. Try again." };
    }
    
    const data = await response.json();
    
    if (!data || !Array.isArray(data.data)) {
      return { ok: false, error: "No headlines found for this ticker" };
    }
    
    const articles: NewsArticle[] = data.data.map((item: any) => ({
      title: item.title || "",
      source: item.source_name || item.source || "Unknown",
      date: item.date || new Date().toISOString(),
      url: item.news_url || item.url || "#",
      imageUrl: item.image_url || undefined,
    }));
    
    const result: NewsResponse = {
      ok: true,
      ticker: cleanTicker,
      items: clampedItems,
      articles,
    };
    
    setCachedResponse(cleanTicker, clampedItems, result);
    
    return result;
  } catch (error) {
    console.error("[NewsService] Error fetching news:", error);
    return { ok: false, error: "Couldn't load headlines right now. Try again." };
  }
}

export function isNewsConfigured(): boolean {
  return !!process.env.STOCKNEWSAPI_TOKEN;
}
