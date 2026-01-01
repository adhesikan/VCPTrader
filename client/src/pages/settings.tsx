import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Settings as SettingsIcon, Bell, Wifi, Shield, Database, FileText, Printer, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { BrokerConnection, BrokerProviderType } from "@shared/schema";

const brokerProviders = [
  { id: "tradier", name: "Tradier", description: "Commission-free trading platform" },
  { id: "alpaca", name: "Alpaca", description: "API-first stock trading" },
  { id: "ibkr", name: "Interactive Brokers", description: "Professional trading platform" },
  { id: "schwab", name: "Charles Schwab", description: "Full-service brokerage" },
  { id: "polygon", name: "Polygon.io", description: "Market data only" },
];

export default function Settings() {
  const { toast } = useToast();
  const [pushEnabled, setPushEnabled] = useState(false);

  const { data: brokerStatus } = useQuery<BrokerConnection | null>({
    queryKey: ["/api/broker/status"],
  });

  const connectBrokerMutation = useMutation({
    mutationFn: async (provider: string) => {
      const response = await apiRequest("POST", "/api/broker/connect", { provider });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/broker/status"] });
      toast({
        title: "Broker Connected",
        description: `Successfully connected to ${data.provider}`,
      });
    },
    onError: (error) => {
      toast({
        title: "Connection Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const disconnectBrokerMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/broker/disconnect", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/broker/status"] });
      toast({
        title: "Broker Disconnected",
      });
    },
  });

  const enablePushMutation = useMutation({
    mutationFn: async () => {
      if ("Notification" in window && "serviceWorker" in navigator) {
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: "demo-vapid-key",
          });
          await apiRequest("POST", "/api/push/subscribe", subscription.toJSON());
          return true;
        }
      }
      return false;
    },
    onSuccess: (enabled) => {
      setPushEnabled(enabled);
      if (enabled) {
        toast({
          title: "Push Notifications Enabled",
          description: "You will receive alerts on this device",
        });
      }
    },
    onError: () => {
      toast({
        title: "Push Notifications Failed",
        description: "Could not enable push notifications",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="p-6 space-y-6" data-testid="settings-page">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure your trading preferences and connections
        </p>
      </div>

      <Tabs defaultValue="broker" className="space-y-6">
        <TabsList>
          <TabsTrigger value="broker" className="gap-2" data-testid="tab-broker">
            <Wifi className="h-4 w-4" />
            Broker
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2" data-testid="tab-notifications">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="scanner" className="gap-2" data-testid="tab-scanner">
            <Database className="h-4 w-4" />
            Scanner
          </TabsTrigger>
          <TabsTrigger value="legal" className="gap-2" data-testid="tab-legal">
            <FileText className="h-4 w-4" />
            Legal
          </TabsTrigger>
        </TabsList>

        <TabsContent value="broker">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-medium">Connection Status</CardTitle>
                <CardDescription>
                  Current market data connection
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`h-3 w-3 rounded-full ${brokerStatus?.isConnected ? "bg-status-online" : "bg-status-offline"}`} />
                    <div>
                      <p className="font-medium">
                        {brokerStatus?.isConnected ? "Connected" : "Not Connected"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {brokerStatus?.provider
                          ? brokerProviders.find(b => b.id === brokerStatus.provider)?.name || brokerStatus.provider
                          : "No broker selected"
                        }
                      </p>
                    </div>
                  </div>
                  {brokerStatus?.isConnected && (
                    <Button
                      variant="outline"
                      onClick={() => disconnectBrokerMutation.mutate()}
                      disabled={disconnectBrokerMutation.isPending}
                      data-testid="button-disconnect"
                    >
                      Disconnect
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base font-medium">Data Providers</CardTitle>
                <CardDescription>
                  Connect to a brokerage for live market data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {brokerProviders.map((broker) => {
                    const isConnected = brokerStatus?.provider === broker.id && brokerStatus?.isConnected;
                    return (
                      <Card 
                        key={broker.id}
                        className={`cursor-pointer hover-elevate ${isConnected ? "border-primary" : ""}`}
                        onClick={() => !isConnected && connectBrokerMutation.mutate(broker.id)}
                        data-testid={`broker-${broker.id}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="font-medium">{broker.name}</h3>
                              <p className="text-xs text-muted-foreground mt-1">
                                {broker.description}
                              </p>
                            </div>
                            {isConnected && (
                              <Badge variant="default" className="text-xs">
                                Active
                              </Badge>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">Push Notifications</CardTitle>
              <CardDescription>
                Receive instant alerts on your device
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Enable Push Notifications</p>
                  <p className="text-sm text-muted-foreground">
                    Get notified when breakouts occur
                  </p>
                </div>
                <Switch
                  checked={pushEnabled}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      enablePushMutation.mutate();
                    } else {
                      setPushEnabled(false);
                    }
                  }}
                  data-testid="switch-push-notifications"
                />
              </div>

              <div className="space-y-4 pt-4 border-t">
                <h4 className="text-sm font-medium">Alert Types</h4>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="breakout-alerts">Breakout Alerts</Label>
                  <Switch id="breakout-alerts" defaultChecked data-testid="switch-breakout-alerts" />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="stop-alerts">Stop Loss Alerts</Label>
                  <Switch id="stop-alerts" defaultChecked data-testid="switch-stop-alerts" />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="ema-alerts">EMA Exit Alerts</Label>
                  <Switch id="ema-alerts" defaultChecked data-testid="switch-ema-alerts" />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="approaching-alerts">Approaching Breakout</Label>
                  <Switch id="approaching-alerts" defaultChecked data-testid="switch-approaching-alerts" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scanner">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">Default Scanner Settings</CardTitle>
              <CardDescription>
                Configure default filters for VCP scans
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="default-universe">Default Universe</Label>
                  <Select defaultValue="all">
                    <SelectTrigger id="default-universe" data-testid="select-default-universe">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All US Stocks</SelectItem>
                      <SelectItem value="sp500">S&P 500</SelectItem>
                      <SelectItem value="nasdaq100">Nasdaq 100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="scan-interval">Auto-scan Interval</Label>
                  <Select defaultValue="5">
                    <SelectTrigger id="scan-interval" data-testid="select-scan-interval">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Every 1 minute</SelectItem>
                      <SelectItem value="5">Every 5 minutes</SelectItem>
                      <SelectItem value="15">Every 15 minutes</SelectItem>
                      <SelectItem value="30">Every 30 minutes</SelectItem>
                      <SelectItem value="0">Manual only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="min-price">Min Price ($)</Label>
                  <Input id="min-price" type="number" defaultValue="5" className="font-mono" data-testid="input-min-price" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max-price">Max Price ($)</Label>
                  <Input id="max-price" type="number" defaultValue="500" className="font-mono" data-testid="input-max-price" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="min-volume">Min Volume</Label>
                  <Input id="min-volume" type="number" defaultValue="500000" className="font-mono" data-testid="input-min-volume" />
                </div>
              </div>

              <Button data-testid="button-save-settings">Save Settings</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="legal">
          <LegalSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface LegalStatus {
  accepted: boolean;
  currentVersion: string;
  acceptedVersion: string | null;
  acceptedAt: string | null;
}

function LegalSettings() {
  const { data: legalStatus, isLoading } = useQuery<LegalStatus>({
    queryKey: ["/api/auth/legal-status"],
  });

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">Loading legal information...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Legal Acceptance Status</CardTitle>
          <CardDescription>
            Your acceptance of our legal agreements
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Current Policy Version</p>
              <p className="font-mono font-medium" data-testid="text-legal-version">
                {legalStatus?.currentVersion || "Unknown"}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Your Accepted Version</p>
              <p className="font-mono font-medium" data-testid="text-accepted-version">
                {legalStatus?.acceptedVersion || "Not accepted"}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge 
                variant={legalStatus?.accepted ? "default" : "destructive"}
                data-testid="badge-legal-status"
              >
                {legalStatus?.accepted ? "Up to date" : "Acceptance required"}
              </Badge>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Accepted On</p>
              <p className="font-medium" data-testid="text-accepted-date">
                {legalStatus?.acceptedAt 
                  ? new Date(legalStatus.acceptedAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "Not available"
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Legal Documents</CardTitle>
          <CardDescription>
            Review our terms, disclaimer, and privacy policy
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Link href="/terms">
              <a className="block" data-testid="link-settings-terms">
                <Card className="hover-elevate cursor-pointer h-full">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Terms of Use</p>
                        <p className="text-xs text-muted-foreground">Service agreement</p>
                      </div>
                      <ExternalLink className="h-4 w-4 ml-auto text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </a>
            </Link>

            <Link href="/disclaimer">
              <a className="block" data-testid="link-settings-disclaimer">
                <Card className="hover-elevate cursor-pointer h-full">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Disclaimer</p>
                        <p className="text-xs text-muted-foreground">Educational only</p>
                      </div>
                      <ExternalLink className="h-4 w-4 ml-auto text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </a>
            </Link>

            <Link href="/privacy">
              <a className="block" data-testid="link-settings-privacy">
                <Card className="hover-elevate cursor-pointer h-full">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Privacy Policy</p>
                        <p className="text-xs text-muted-foreground">Data handling</p>
                      </div>
                      <ExternalLink className="h-4 w-4 ml-auto text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </a>
            </Link>
          </div>

          <div className="pt-4 border-t">
            <Button variant="outline" onClick={handlePrint} data-testid="button-print-legal">
              <Printer className="mr-2 h-4 w-4" />
              Print All Documents
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
