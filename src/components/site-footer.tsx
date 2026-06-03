import { Link } from "@tanstack/react-router";
import { BookHeart } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="mt-4 border-t border-border/60 bg-card/60">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 sm:px-8 md:flex-row md:items-start md:justify-between lg:px-12">
        <div className="max-w-sm space-y-2">
          <div className="flex items-center gap-2 font-display text-xl font-bold text-foreground">
            <BookHeart className="size-5 text-primary" /> BookHug
          </div>
          <p className="text-sm text-muted-foreground">
            Buy, sell, exchange and rent books with real readers, sellers and libraries near you — and compare live online
            prices before you deal.
          </p>
        </div>

        <nav className="grid grid-cols-2 gap-x-10 gap-y-2 text-sm" aria-label="Footer">
          <Link to="/home" className="text-muted-foreground transition-colors hover:text-foreground">
            Search books
          </Link>
          <Link to="/profile" className="text-muted-foreground transition-colors hover:text-foreground">
            My Books
          </Link>
          <Link to="/help" className="text-muted-foreground transition-colors hover:text-foreground">
            How it works
          </Link>
          <Link to="/payments" className="text-muted-foreground transition-colors hover:text-foreground">
            My payments
          </Link>
          <Link to="/complaint" className="text-muted-foreground transition-colors hover:text-foreground">
            Report a problem
          </Link>
        </nav>
      </div>
      <div className="border-t border-border/60 px-5 py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} BookHug — read more, spend less, meet your neighbours.
      </div>
    </footer>
  );
}
