import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Search,
  Bell,
  BarChart3,
  Smartphone,
  Link2,
  SlidersHorizontal,
  Target,
  Zap,
  Check,
  ArrowRight,
  Menu,
  X,
} from "lucide-react";
import logoUrl from "@assets/ChatGPT_Image_Jan_1,_2026,_01_38_07_PM_1767292703801.png";
import { useState } from "react";

function NavBar() {
  const { isAuthenticated } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: "#features", label: "Features" },
    { href: "#how-it-works", label: "How It Works" },
    { href: "#pricing", label: "Pricing" },
    { href: "#faq", label: "FAQ" },
    { href: "/terms", label: "Legal" },
  ];

  return (
    <nav className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <img src={logoUrl} alt="VCP Trader" className="h-8 w-auto" data-testid="img-logo" />
            </Link>
            <div className="hidden md:flex items-center gap-6">
              {navLinks.map((link) => (
                link.href.startsWith("#") ? (
                  <a
                    key={link.href}
                    href={link.href}
                    className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                    data-testid={`link-nav-${link.label.toLowerCase().replace(/\s/g, "-")}`}
                  >
                    {link.label}
                  </a>
                ) : (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                    data-testid={`link-nav-${link.label.toLowerCase().replace(/\s/g, "-")}`}
                  >
                    {link.label}
                  </Link>
                )
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="hidden sm:flex items-center gap-3">
              {isAuthenticated ? (
                <Link href="/dashboard">
                  <Button data-testid="button-go-to-dashboard">Go to Dashboard</Button>
                </Link>
              ) : (
                <>
                  <Link href="/auth">
                    <Button variant="ghost" data-testid="button-sign-in">Sign In</Button>
                  </Link>
                  <Link href="/auth">
                    <Button data-testid="button-start-trial">Start Free Trial</Button>
                  </Link>
                </>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              data-testid="button-mobile-menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t">
            <div className="flex flex-col gap-3">
              {navLinks.map((link) => (
                link.href.startsWith("#") ? (
                  <a
                    key={link.href}
                    href={link.href}
                    className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-2"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {link.label}
                  </a>
                ) : (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-2"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                )
              ))}
              <div className="flex flex-col gap-2 pt-4 border-t">
                {isAuthenticated ? (
                  <Link href="/dashboard">
                    <Button className="w-full" data-testid="button-go-to-dashboard-mobile">Go to Dashboard</Button>
                  </Link>
                ) : (
                  <>
                    <Link href="/auth">
                      <Button variant="outline" className="w-full" data-testid="button-sign-in-mobile">Sign In</Button>
                    </Link>
                    <Link href="/auth">
                      <Button className="w-full" data-testid="button-start-trial-mobile">Start Free Trial</Button>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

function HeroSection() {
  const { isAuthenticated } = useAuth();

  return (
    <section className="py-16 md:py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight max-w-4xl mx-auto" data-testid="text-hero-headline">
          Institutional-Grade Breakout Intelligence for Self-Directed Traders
        </h1>
        <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto" data-testid="text-hero-subheadline">
          Scan the entire market, detect tightening bases, and get real-time alerts when momentum ignites — with full control over every trade.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          {isAuthenticated ? (
            <Link href="/dashboard">
              <Button size="lg" data-testid="button-hero-dashboard">
                Go to Dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          ) : (
            <>
              <Link href="/auth">
                <Button size="lg" data-testid="button-hero-trial">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <a href="#pricing">
                <Button variant="outline" size="lg" data-testid="button-hero-pricing">
                  View Pricing
                </Button>
              </a>
            </>
          )}
        </div>
        <p className="mt-4 text-sm text-muted-foreground" data-testid="text-hero-disclaimer">
          Educational & informational only — not investment advice.
        </p>
      </div>
    </section>
  );
}

function TrustStrip() {
  const features = [
    { icon: Search, text: "Market-wide scanning" },
    { icon: Bell, text: "Real-time alerts (push + email)" },
    { icon: Link2, text: "Broker-connected data (optional)" },
  ];

  return (
    <section className="py-8 border-y bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-12">
          {features.map((feature, index) => (
            <div key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
              <feature.icon className="h-4 w-4 text-primary" />
              <span data-testid={`text-trust-${index}`}>{feature.text}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingTiersSection() {
  const { isAuthenticated } = useAuth();

  const tiers = [
    {
      id: "scanner",
      title: "Scanner",
      subtitle: "Run your own scans. Set your own alerts.",
      price: "$79",
      features: [
        "Scan thousands of stocks with price/volume filters",
        "Detect FORMING / READY / BREAKOUT patterns",
        "Resistance & stop levels plotted automatically",
      ],
      cta: "Get Scanner",
      popular: false,
    },
    {
      id: "education",
      title: "Education Alerts",
      subtitle: "Model-generated educational alerts.",
      price: "$59",
      features: [
        "Daily watchlists: Forming, Ready, Breakout",
        "Push alerts when educational conditions trigger",
        "AI explanation for every alert",
      ],
      disclaimer: "Educational examples only. Not personalized recommendations.",
      cta: "Get Education Alerts",
      popular: false,
    },
    {
      id: "pro",
      title: "Pro",
      subtitle: "Scanner + Education Alerts together.",
      price: "$129",
      features: [
        "Everything in Scanner + Education Alerts",
        "Compare your scans vs the model feed",
        "Best for active traders",
      ],
      cta: "Go Pro",
      popular: true,
    },
  ];

  return (
    <section className="py-16 md:py-24" id="choose-mode">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold" data-testid="text-mode-heading">Choose Your Mode</h2>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            Select the subscription that matches your trading style
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {tiers.map((tier) => (
            <Card key={tier.id} className={`relative flex flex-col ${tier.popular ? "border-primary" : ""}`}>
              {tier.popular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2" data-testid="badge-popular">
                  Most Popular
                </Badge>
              )}
              <CardHeader>
                <CardTitle data-testid={`text-tier-title-${tier.id}`}>{tier.title}</CardTitle>
                <CardDescription data-testid={`text-tier-subtitle-${tier.id}`}>{tier.subtitle}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <div className="mb-6">
                  <span className="text-3xl font-bold" data-testid={`text-tier-price-${tier.id}`}>{tier.price}</span>
                  <span className="text-muted-foreground">/mo</span>
                </div>
                <ul className="space-y-3 mb-6 flex-1">
                  {tier.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <span data-testid={`text-tier-feature-${tier.id}-${index}`}>{feature}</span>
                    </li>
                  ))}
                </ul>
                {tier.disclaimer && (
                  <p className="text-xs text-muted-foreground mb-4 p-2 bg-muted/50 rounded" data-testid={`text-tier-disclaimer-${tier.id}`}>
                    {tier.disclaimer}
                  </p>
                )}
                <Link href={isAuthenticated ? "/settings" : "/auth"}>
                  <Button
                    className="w-full"
                    variant={tier.popular ? "default" : "outline"}
                    data-testid={`button-tier-cta-${tier.id}`}
                  >
                    {tier.cta}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  const features = [
    { icon: Search, title: "Entire-market scanning", description: "Scan thousands of US equities in seconds" },
    { icon: SlidersHorizontal, title: "Powerful filters", description: "Price, volume, RVOL, ATR% and more" },
    { icon: Target, title: "Breakout + stop-loss alerts", description: "Get notified when setups trigger" },
    { icon: BarChart3, title: "Interactive charts", description: "Full charting inside the app" },
    { icon: Smartphone, title: "PWA mobile install", description: "Install on phone + push notifications" },
    { icon: Link2, title: "Broker connections", description: "Optional market data from your broker" },
  ];

  return (
    <section className="py-16 md:py-24 bg-muted/30" id="features">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold" data-testid="text-features-heading">Features</h2>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            Everything you need for systematic market scanning
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <Card key={index} className="bg-background">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-md bg-primary/10">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium" data-testid={`text-feature-title-${index}`}>{feature.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1" data-testid={`text-feature-desc-${index}`}>{feature.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const steps = [
    { number: "1", title: "Filter the market", description: "Set your criteria for price, volume, and pattern stage" },
    { number: "2", title: "Identify VCP setups", description: "The scanner detects volatility contraction patterns forming" },
    { number: "3", title: "Get alerts and act on your plan", description: "Receive notifications when conditions are met" },
  ];

  return (
    <section className="py-16 md:py-24" id="how-it-works">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold" data-testid="text-hiw-heading">How It Works</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step, index) => (
            <div key={index} className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-lg font-bold mx-auto mb-4" data-testid={`text-step-number-${index}`}>
                {step.number}
              </div>
              <h3 className="font-semibold text-lg mb-2" data-testid={`text-step-title-${index}`}>{step.title}</h3>
              <p className="text-muted-foreground text-sm" data-testid={`text-step-desc-${index}`}>{step.description}</p>
            </div>
          ))}
        </div>
        <p className="text-center mt-10 text-sm text-muted-foreground" data-testid="text-hiw-note">
          You control the rules. You control the trades.
        </p>
      </div>
    </section>
  );
}

function PricingSection() {
  const { isAuthenticated } = useAuth();

  const plans = [
    { name: "Scanner", price: "$79" },
    { name: "Education Alerts", price: "$59" },
    { name: "Pro", price: "$129" },
  ];

  return (
    <section className="py-16 md:py-24 bg-muted/30" id="pricing">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold" data-testid="text-pricing-heading">Simple Pricing</h2>
          <p className="mt-4 text-muted-foreground">Cancel anytime. No long-term commitment.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-8">
          {plans.map((plan, index) => (
            <div key={index} className="text-center">
              <p className="text-lg font-semibold" data-testid={`text-plan-name-${index}`}>{plan.name}</p>
              <p className="text-2xl font-bold" data-testid={`text-plan-price-${index}`}>{plan.price}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
            </div>
          ))}
        </div>
        <div className="text-center">
          <Link href={isAuthenticated ? "/settings" : "/auth"}>
            <Button size="lg" data-testid="button-pricing-cta">
              {isAuthenticated ? "Manage Subscription" : "Start Free Trial"}
            </Button>
          </Link>
          <p className="mt-4 text-xs text-muted-foreground max-w-md mx-auto" data-testid="text-pricing-disclaimer">
            No guarantees. Past performance does not predict future results.
          </p>
        </div>
      </div>
    </section>
  );
}

function FAQSection() {
  const faqs = [
    {
      question: "Is this investment advice?",
      answer: "No. VCP Trader is an educational and informational platform for self-directed traders. We do not provide personalized investment recommendations or advice. All alerts and scan results are for educational purposes only.",
    },
    {
      question: "What is a VCP setup?",
      answer: "VCP stands for Volatility Contraction Pattern. It's a technical market structure where price ranges tighten as a stock consolidates near resistance. This behavior can reflect decreasing selling pressure while buyers remain active, and may precede a breakout when demand overwhelms supply.",
    },
    {
      question: "Do I need a brokerage connection?",
      answer: "No, it's optional. You can use the platform without connecting a broker. If you do connect, you'll get real-time market data from your broker instead of delayed data.",
    },
    {
      question: "How do alerts work?",
      answer: "Alerts are delivered via push notifications (mobile/desktop), email, and in-app notifications. You can configure which alert types you want to receive in your settings.",
    },
    {
      question: "Can I use it on mobile?",
      answer: "Yes! VCP Trader is a Progressive Web App (PWA). You can install it on your phone's home screen for a native app-like experience with push notifications.",
    },
    {
      question: "What markets do you support?",
      answer: "Currently we support US equities. We plan to expand to other markets in the future based on user demand.",
    },
  ];

  return (
    <section className="py-16 md:py-24" id="faq">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold" data-testid="text-faq-heading">Frequently Asked Questions</h2>
        </div>
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq, index) => (
            <AccordionItem key={index} value={`item-${index}`}>
              <AccordionTrigger className="text-left" data-testid={`button-faq-question-${index}`}>
                {faq.question}
              </AccordionTrigger>
              <AccordionContent data-testid={`text-faq-answer-${index}`}>
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

function LandingFooter() {
  return (
    <footer className="py-12 border-t">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <img src={logoUrl} alt="VCP Trader" className="h-6 w-auto" />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6 text-sm">
            <Link href="/terms" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-terms">
              Terms
            </Link>
            <Link href="/disclaimer" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-disclaimer">
              Disclaimer
            </Link>
            <Link href="/privacy" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-privacy">
              Privacy
            </Link>
            <Link href="/open-source" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-open-source">
              Open Source
            </Link>
            <a href="mailto:support@vcptrader.com" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-contact">
              Contact
            </a>
          </div>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-8" data-testid="text-footer-disclaimer">
          VCP Trader is an educational market-analysis and alerting platform. Not investment advice.
        </p>
      </div>
    </footer>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <HeroSection />
      <TrustStrip />
      <PricingTiersSection />
      <FeaturesSection />
      <HowItWorksSection />
      <PricingSection />
      <FAQSection />
      <LandingFooter />
    </div>
  );
}
