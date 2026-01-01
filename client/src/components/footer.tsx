import { Link } from "wouter";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-background/95 py-4 px-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
        <p data-testid="text-copyright">
          {currentYear} VCP Trader. All rights reserved.
        </p>
        <nav className="flex items-center gap-4">
          <Link href="/terms">
            <a className="hover:text-foreground transition-colors" data-testid="link-footer-terms">
              Terms of Use
            </a>
          </Link>
          <Link href="/disclaimer">
            <a className="hover:text-foreground transition-colors" data-testid="link-footer-disclaimer">
              Disclaimer
            </a>
          </Link>
          <Link href="/privacy">
            <a className="hover:text-foreground transition-colors" data-testid="link-footer-privacy">
              Privacy Policy
            </a>
          </Link>
        </nav>
      </div>
    </footer>
  );
}
