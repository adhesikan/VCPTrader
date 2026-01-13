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
              VCP Trader is a software platform designed to help traders and investors scan the financial markets for potential opportunities using widely recognized technical analysis strategies. The platform provides tools to explore, filter, and monitor market conditions based on objective data such as price, volume, and technical indicators.
            </p>

            <p>
              VCP Trader includes an in-app Strategy Guide that explains how each supported strategy works, allowing users to learn about different market patterns and select strategies that align with their individual trading style, experience level, and risk tolerance. Users control which strategies they apply, how they filter results, and how they interpret the information presented.
            </p>

            <p>
              All data, charts, alerts, and strategy outputs provided by VCP Trader are for educational and informational purposes only and do not constitute investment advice, trading recommendations, or a solicitation to buy or sell any security. VCP Trader does not manage, place, or execute trades on behalf of users and does not have access to user brokerage accounts.
            </p>

            <p>
              Users may choose to place trades manually through their own brokerage accounts, or they may optionally connect to InstaTrade™, a self-directed automation feature powered by AlgoPilotX, which allows users to automate trade execution based on their own predefined rules and risk settings. All automated trading activity is user-configured, user-authorized, and executed entirely through AlgoPilotX and the user's selected brokerage.
            </p>

            <p>
              Trading and investing involve substantial risk, including the potential loss of capital. Past performance of any strategy or market pattern does not guarantee future results. Users are solely responsible for all trading decisions, settings, and outcomes.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
