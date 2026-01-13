import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";
import { Link } from "wouter";

export default function DisclaimerPage() {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6 print:hidden">
          <Link href="/">
            <Button variant="ghost" size="sm" data-testid="button-back">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={handlePrint} data-testid="button-print">
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl" data-testid="text-page-title">Disclaimer</CardTitle>
            <p className="text-sm text-muted-foreground">Last updated: January 2026</p>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-4">
            <p>
              VCP Trader is an educational market-analysis and alerting platform developed by Sunfish Technologies LLC, designed to help users identify technical patterns and market conditions.
            </p>

            <p>
              VCP Trader does not provide investment advice, personalized recommendations, or trade instructions. All information, alerts, pattern detections, rankings, and analytics are provided for educational and informational purposes only.
            </p>

            <p>
              Nothing on this platform should be interpreted as a recommendation to buy, sell, or hold any security, option, or financial instrument. You are solely responsible for your trading decisions and any resulting gains or losses.
            </p>

            <p>
              Trading stocks, options, and other financial instruments involves substantial risk and may result in partial or total loss of capital. Past performance, back-tested results, and historical patterns do not guarantee future outcomes.
            </p>

            <p>
              Market data and alerts may be delayed, incomplete, or inaccurate due to exchange, brokerage, or technology limitations. VCP Trader makes no guarantee regarding the timeliness or accuracy of any data, alerts, or analysis.
            </p>

            <p>
              By using this platform, you acknowledge and agree that Sunfish Technologies LLC, VCP Trader, its operators, developers, and affiliates shall not be liable for any trading losses, missed opportunities, or decisions made based on information provided by the platform.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
