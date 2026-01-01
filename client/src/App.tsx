import { useState, useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery as useReactQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppSidebar } from "@/components/app-sidebar";
import { MarketStatsBar } from "@/components/market-stats-bar";
import { LegalAcceptanceModal } from "@/components/legal-acceptance-modal";
import { Footer } from "@/components/footer";
import {
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar";
import { useQuery } from "@tanstack/react-query";
import type { MarketStats } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, User, Loader2 } from "lucide-react";

import Dashboard from "@/pages/dashboard";
import Scanner from "@/pages/scanner";
import Charts from "@/pages/charts";
import Alerts from "@/pages/alerts";
import Watchlists from "@/pages/watchlists";
import Backtest from "@/pages/backtest";
import Settings from "@/pages/settings";
import Signals from "@/pages/signals";
import AuthPage from "@/pages/auth";
import HomePage from "@/pages/home";
import TermsPage from "@/pages/terms";
import DisclaimerPage from "@/pages/disclaimer";
import PrivacyPage from "@/pages/privacy";
import OpenSourcePage from "@/pages/open-source";
import NotFound from "@/pages/not-found";

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/signals" component={Signals} />
      <Route path="/scanner" component={Scanner} />
      <Route path="/charts" component={Charts} />
      <Route path="/charts/:ticker" component={Charts} />
      <Route path="/alerts" component={Alerts} />
      <Route path="/watchlists" component={Watchlists} />
      <Route path="/backtest" component={Backtest} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function UserMenu() {
  const { user, logout, isLoggingOut } = useAuth();
  
  if (!user) return null;
  
  const initials = [user.firstName?.[0], user.lastName?.[0]]
    .filter(Boolean)
    .join("")
    .toUpperCase() || user.email?.[0]?.toUpperCase() || "U";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" data-testid="button-user-menu">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5">
          <p className="text-sm font-medium" data-testid="text-user-email">{user.email}</p>
          <p className="text-xs text-muted-foreground">
            {user.role === "admin" ? "Administrator" : "Member"}
          </p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href="/settings" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Settings
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          onClick={() => logout()} 
          disabled={isLoggingOut}
          data-testid="button-logout"
        >
          {isLoggingOut ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <LogOut className="mr-2 h-4 w-4" />
          )}
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AppHeader() {
  const { data: marketStats, isLoading } = useQuery<MarketStats>({
    queryKey: ["/api/market/stats"],
  });

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center justify-between gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
      <div className="flex items-center gap-4">
        <SidebarTrigger data-testid="button-sidebar-toggle" />
        <MarketStatsBar stats={marketStats} isLoading={isLoading} />
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}

interface LegalStatus {
  accepted: boolean;
  currentVersion: string;
  acceptedVersion: string | null;
  acceptedAt: string | null;
}

function AppLayout() {
  const [showLegalModal, setShowLegalModal] = useState(false);
  const { user } = useAuth();
  
  const { data: legalStatus, isLoading: legalLoading } = useReactQuery<LegalStatus>({
    queryKey: ["/api/auth/legal-status"],
    enabled: !!user,
  });

  useEffect(() => {
    if (legalStatus && !legalStatus.accepted) {
      setShowLegalModal(true);
    }
  }, [legalStatus]);

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  } as React.CSSProperties;

  if (legalLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <SidebarProvider style={sidebarStyle}>
        <div className="flex h-screen w-full">
          <AppSidebar />
          <SidebarInset className="flex flex-col flex-1 min-w-0">
            <AppHeader />
            <main className="flex-1 overflow-auto">
              <AppRouter />
            </main>
            <Footer />
          </SidebarInset>
        </div>
      </SidebarProvider>
      <LegalAcceptanceModal
        open={showLegalModal}
        onAccepted={() => setShowLegalModal(false)}
      />
    </>
  );
}

function PublicRoutes() {
  const [location] = useLocation();
  
  if (location === "/") return <HomePage />;
  if (location === "/terms") return <TermsPage />;
  if (location === "/disclaimer") return <DisclaimerPage />;
  if (location === "/privacy") return <PrivacyPage />;
  if (location === "/open-source") return <OpenSourcePage />;
  if (location === "/auth") return <AuthPage />;
  
  return null;
}

function AuthenticatedApp() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();

  const publicRoutes = ["/", "/terms", "/disclaimer", "/privacy", "/open-source", "/auth"];
  const isPublicRoute = publicRoutes.includes(location);
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isPublicRoute && !isAuthenticated) {
    return <PublicRoutes />;
  }

  if (!isAuthenticated) {
    return <AuthPage />;
  }

  return <AppLayout />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <AuthenticatedApp />
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
