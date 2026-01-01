import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ArrowLeft, ExternalLink, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";

export default function OpenSourcePage() {
  const [licenseText, setLicenseText] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/legal/apache-2.0.txt")
      .then((res) => res.text())
      .then((text) => {
        setLicenseText(text);
        setIsLoading(false);
      })
      .catch(() => {
        setLicenseText("Unable to load license text. Please visit http://www.apache.org/licenses/LICENSE-2.0");
        setIsLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-4" data-testid="button-back">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Open Source Notices</h1>
          <p className="mt-2 text-muted-foreground">
            This application uses the following open-source software.
          </p>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle data-testid="text-tradingview-heading">TradingView Lightweight Charts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground" data-testid="text-tradingview-attribution">
              This product includes the TradingView Lightweight Charts library, which is licensed under the Apache License, Version 2.0.
            </p>
            <p className="text-sm text-muted-foreground">
              Copyright © TradingView, Inc.
            </p>
            <div className="rounded-md bg-muted p-4 text-sm">
              <p className="mb-2">
                Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
              </p>
              <p className="mb-2">
                You may obtain a copy of the License at:
              </p>
              <a 
                href="http://www.apache.org/licenses/LICENSE-2.0" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
                data-testid="link-apache-license"
              >
                http://www.apache.org/licenses/LICENSE-2.0
                <ExternalLink className="h-3 w-3" />
              </a>
              <p className="mt-2">
                Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
              </p>
              <p className="mt-2">
                See the License for the specific language governing permissions and limitations under the License.
              </p>
            </div>
          </CardContent>
        </Card>

        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="apache-license">
            <AccordionTrigger data-testid="button-expand-license">
              Apache License 2.0 (Full Text)
            </AccordionTrigger>
            <AccordionContent>
              <div className="rounded-md bg-muted p-4 overflow-x-auto">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <pre className="text-xs font-mono whitespace-pre-wrap" data-testid="text-license-full">
                    {licenseText}
                  </pre>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="mt-8 pt-8 border-t">
          <h2 className="text-lg font-semibold mb-4">Additional Legal Information</h2>
          <div className="flex flex-wrap gap-4 text-sm">
            <Link href="/terms" className="text-primary hover:underline" data-testid="link-terms">
              Terms of Use
            </Link>
            <Link href="/disclaimer" className="text-primary hover:underline" data-testid="link-disclaimer">
              Disclaimer
            </Link>
            <Link href="/privacy" className="text-primary hover:underline" data-testid="link-privacy">
              Privacy Policy
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
