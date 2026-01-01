import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Search,
  BarChart3,
  Bell,
  List,
  FlaskConical,
  Settings,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import type { BrokerConnection, Alert } from "@shared/schema";

const mainNavItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Trade Signals", url: "/signals", icon: Zap },
  { title: "Scanner", url: "/scanner", icon: Search },
  { title: "Charts", url: "/charts", icon: BarChart3 },
  { title: "Alerts", url: "/alerts", icon: Bell },
  { title: "Watchlists", url: "/watchlists", icon: List },
];

const toolsNavItems = [
  { title: "Backtest", url: "/backtest", icon: FlaskConical },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const [location] = useLocation();

  const { data: brokerStatus } = useQuery<BrokerConnection | null>({
    queryKey: ["/api/broker/status"],
  });

  const { data: alerts } = useQuery<Alert[]>({
    queryKey: ["/api/alerts"],
  });

  const unreadAlerts = alerts?.filter(a => !a.isRead).length || 0;
  const isConnected = brokerStatus?.isConnected ?? false;

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <Link href="/" data-testid="link-home">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="VCP Trader" className="h-8 w-auto" />
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Trading
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                  >
                    <Link href={item.url} data-testid={`link-${item.title.toLowerCase()}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                      {item.title === "Alerts" && unreadAlerts > 0 && (
                        <Badge variant="destructive" className="ml-auto text-xs">
                          {unreadAlerts}
                        </Badge>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Tools
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {toolsNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                  >
                    <Link href={item.url} data-testid={`link-${item.title.toLowerCase()}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <div className="flex items-center gap-2 rounded-md bg-sidebar-accent/50 p-3">
          {isConnected ? (
            <Wifi className="h-4 w-4 text-status-online" />
          ) : (
            <WifiOff className="h-4 w-4 text-muted-foreground" />
          )}
          <div className="flex flex-col">
            <span className="text-xs font-medium">
              {isConnected ? "Connected" : "Disconnected"}
            </span>
            <span className="text-xs text-muted-foreground">
              {brokerStatus?.provider || "No broker"}
            </span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
