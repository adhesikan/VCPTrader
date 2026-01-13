import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  Zap, Settings, CheckCircle2, XCircle, RefreshCw, Trash2, Plus, 
  ExternalLink, Shield, Clock, AlertTriangle, History, ChevronRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface AlgoPilotxConnection {
  connected: boolean;
  connectionType?: string;
  webhookUrl?: string;
  apiBaseUrl?: string;
  lastTestedAt?: string;
  lastTestSuccess?: boolean;
  createdAt?: string;
}

interface ExecutionRequest {
  id: string;
  userId: string;
  symbol: string;
  strategyId: string;
  timeframe?: string;
  setupPayload?: any;
  automationProfileId?: string;
  status: string;
  algoPilotxReference?: string;
  redirectUrl?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export default function AutomationPage() {
  const { toast } = useToast();
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");

  const { data: connection, isLoading: connectionLoading } = useQuery<AlgoPilotxConnection>({
    queryKey: ["/api/algo-pilotx/connection"],
  });

  const { data: executionRequests, isLoading: requestsLoading } = useQuery<ExecutionRequest[]>({
    queryKey: ["/api/execution-requests"],
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/algo-pilotx/connect", {
        connectionType: "WEBHOOK",
        webhookUrl,
        webhookSecret: webhookSecret || undefined,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Connected",
        description: "AlgoPilotX connection established successfully",
      });
      setConnectDialogOpen(false);
      setWebhookUrl("");
      setWebhookSecret("");
      queryClient.invalidateQueries({ queryKey: ["/api/algo-pilotx/connection"] });
    },
    onError: (error: any) => {
      toast({
        title: "Connection Failed",
        description: error.message || "Could not connect to AlgoPilotX",
        variant: "destructive",
      });
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/algo-pilotx/test", {});
      return response.json();
    },
    onSuccess: (data: any) => {
      if (data.success) {
        toast({
          title: "Test Successful",
          description: "Connection to AlgoPilotX verified",
        });
      } else {
        toast({
          title: "Test Failed",
          description: data.message || "Could not verify connection",
          variant: "destructive",
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/algo-pilotx/connection"] });
    },
    onError: (error: any) => {
      toast({
        title: "Test Failed",
        description: error.message || "Could not test connection",
        variant: "destructive",
      });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/algo-pilotx/disconnect", {});
    },
    onSuccess: () => {
      toast({
        title: "Disconnected",
        description: "AlgoPilotX connection removed",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/algo-pilotx/connection"] });
    },
    onError: (error: any) => {
      toast({
        title: "Disconnect Failed",
        description: error.message || "Could not disconnect",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { className: string; label: string }> = {
      CREATED: { className: "bg-gray-500/10 text-gray-600 dark:text-gray-400", label: "Created" },
      SENT: { className: "bg-blue-500/10 text-blue-600 dark:text-blue-400", label: "Sent" },
      ACKED: { className: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400", label: "Acknowledged" },
      EXECUTED: { className: "bg-green-500/10 text-green-600 dark:text-green-400", label: "Executed" },
      REJECTED: { className: "bg-red-500/10 text-red-600 dark:text-red-400", label: "Rejected" },
      FAILED: { className: "bg-red-500/10 text-red-600 dark:text-red-400", label: "Failed" },
    };
    const variant = variants[status] || variants.CREATED;
    return <Badge className={variant.className}>{variant.label}</Badge>;
  };

  return (
    <div className="p-6 space-y-6" data-testid="automation-page">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Zap className="h-6 w-6" />
          Automation
        </h1>
        <p className="text-sm text-muted-foreground">
          Connect AlgoPilotX to execute setups with InstaTrade™
        </p>
      </div>

      <Tabs defaultValue="connection" className="space-y-6">
        <TabsList>
          <TabsTrigger value="connection" className="gap-2" data-testid="tab-connection">
            <Settings className="h-4 w-4" />
            Connection
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2" data-testid="tab-history">
            <History className="h-4 w-4" />
            Execution History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="connection" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ExternalLink className="h-5 w-5" />
                AlgoPilotX Connection
              </CardTitle>
              <CardDescription>
                VCP Trader provides market intelligence. Trade execution occurs in AlgoPilotX after you confirm.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {connectionLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Loading connection status...
                </div>
              ) : connection?.connected ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="font-medium">Connected</p>
                      <p className="text-sm text-muted-foreground">
                        {connection.connectionType === "WEBHOOK" ? "Webhook" : "OAuth"} connection active
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Webhook URL</span>
                      <span className="font-mono text-xs truncate max-w-[200px]">
                        {connection.webhookUrl || "Not set"}
                      </span>
                    </div>
                    {connection.lastTestedAt && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Last Tested</span>
                        <span className="flex items-center gap-2">
                          {connection.lastTestSuccess ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                          {format(new Date(connection.lastTestedAt), "MMM d, h:mm a")}
                        </span>
                      </div>
                    )}
                    {connection.createdAt && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Connected Since</span>
                        <span>{format(new Date(connection.createdAt), "MMM d, yyyy")}</span>
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => testMutation.mutate()}
                      disabled={testMutation.isPending}
                      className="gap-2"
                      data-testid="button-test-connection"
                    >
                      <RefreshCw className={cn("h-4 w-4", testMutation.isPending && "animate-spin")} />
                      Test Connection
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => disconnectMutation.mutate()}
                      disabled={disconnectMutation.isPending}
                      className="gap-2"
                      data-testid="button-disconnect"
                    >
                      <Trash2 className="h-4 w-4" />
                      Disconnect
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                      <XCircle className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">Not Connected</p>
                      <p className="text-sm text-muted-foreground">
                        Connect AlgoPilotX to execute setups with InstaTrade™
                      </p>
                    </div>
                  </div>

                  <Dialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="gap-2" data-testid="button-connect-algopilotx">
                        <Plus className="h-4 w-4" />
                        Connect AlgoPilotX
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Connect AlgoPilotX</DialogTitle>
                        <DialogDescription>
                          Enter your AlgoPilotX webhook URL to enable InstaTrade™ integration.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="webhookUrl">Webhook URL</Label>
                          <Input
                            id="webhookUrl"
                            placeholder="https://app.algopilotx.com/webhook/..."
                            value={webhookUrl}
                            onChange={(e) => setWebhookUrl(e.target.value)}
                            data-testid="input-webhook-url"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="webhookSecret">Webhook Secret (optional)</Label>
                          <Input
                            id="webhookSecret"
                            type="password"
                            placeholder="Your webhook secret"
                            value={webhookSecret}
                            onChange={(e) => setWebhookSecret(e.target.value)}
                            data-testid="input-webhook-secret"
                          />
                          <p className="text-xs text-muted-foreground">
                            Stored encrypted. Used to sign webhook payloads.
                          </p>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setConnectDialogOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={() => connectMutation.mutate()}
                          disabled={!webhookUrl || connectMutation.isPending}
                          data-testid="button-save-connection"
                        >
                          {connectMutation.isPending ? "Connecting..." : "Connect"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                How It Works
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="flex gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-sm font-medium">1</span>
                  </div>
                  <div>
                    <p className="font-medium">Find Setups</p>
                    <p className="text-sm text-muted-foreground">
                      Use Opportunity Engine to discover trading setups
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-sm font-medium">2</span>
                  </div>
                  <div>
                    <p className="font-medium">Send to AlgoPilotX</p>
                    <p className="text-sm text-muted-foreground">
                      Click "Open in AlgoPilotX" to pre-fill InstaTrade™
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-sm font-medium">3</span>
                  </div>
                  <div>
                    <p className="font-medium">Confirm & Execute</p>
                    <p className="text-sm text-muted-foreground">
                      Review and confirm in AlgoPilotX with risk controls
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <p>
                  VCP Trader provides market intelligence only. All trade execution happens in AlgoPilotX 
                  after your explicit confirmation. This is educational and informational only, not investment advice.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Execution History
              </CardTitle>
              <CardDescription>
                Track setups sent to AlgoPilotX and their execution status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {requestsLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Loading history...
                </div>
              ) : !executionRequests || executionRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No execution requests yet</p>
                  <p className="text-sm">
                    Send a setup from the{" "}
                    <Link href="/" className="text-primary underline" data-testid="link-opportunity-engine">
                      Opportunity Engine
                    </Link>
                    {" "}to get started
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {executionRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card hover-elevate"
                    >
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="font-semibold">{request.symbol}</p>
                          <p className="text-sm text-muted-foreground">
                            {request.strategyId} • {format(new Date(request.createdAt), "MMM d, h:mm a")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {getStatusBadge(request.status)}
                        {request.redirectUrl && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => window.open(request.redirectUrl, "_blank")}
                            data-testid={`button-open-request-${request.id}`}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
