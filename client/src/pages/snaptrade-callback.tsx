import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function SnaptradeCallback() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<"syncing" | "success" | "error">("syncing");
  const [message, setMessage] = useState("Syncing your brokerage connection...");

  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/snaptrade/sync", { method: "POST" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to sync");
      }
      return response.json();
    },
    onSuccess: (data: any) => {
      setStatus("success");
      setMessage(data.message || "Brokerage connected successfully!");
      queryClient.invalidateQueries({ queryKey: ["/api/snaptrade/connections"] });
      setTimeout(() => {
        setLocation("/settings");
      }, 2000);
    },
    onError: (error: any) => {
      setStatus("error");
      setMessage(error.message || "Failed to sync brokerage connection");
    },
  });

  useEffect(() => {
    syncMutation.mutate();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            {status === "syncing" && (
              <>
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                Connecting Brokerage
              </>
            )}
            {status === "success" && (
              <>
                <CheckCircle2 className="h-6 w-6 text-green-500" />
                Connected!
              </>
            )}
            {status === "error" && (
              <>
                <XCircle className="h-6 w-6 text-red-500" />
                Connection Failed
              </>
            )}
          </CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {status === "syncing" && (
            <p className="text-sm text-muted-foreground">
              Please wait while we sync your brokerage account...
            </p>
          )}
          {status === "success" && (
            <p className="text-sm text-muted-foreground">
              Redirecting you to settings...
            </p>
          )}
          {status === "error" && (
            <div className="space-y-3">
              <Button
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
                data-testid="button-retry-sync"
              >
                {syncMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Retrying...
                  </>
                ) : (
                  "Try Again"
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setLocation("/settings")}
                data-testid="button-go-settings"
              >
                Go to Settings
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
