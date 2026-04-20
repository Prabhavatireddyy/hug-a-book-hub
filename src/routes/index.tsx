import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, Store, Library, Heart, Sparkles, Search } from "lucide-react";
import { ConfettiBurst } from "@/components/ConfettiBurst";
import { Button } from "@/components/ui/button";
import { mostReadBooks } from "@/data/most-read-books";
import heroImg from "@/assets/book-hug-hero.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BookHug — Find your next book hug 🤗" },
      {
        name: "description",
        content:
          "Buy, sell and exchange books with cute pet usernames. Connect with readers, sellers and libraries near you on BookHug 🌸",
      },
      { property: "og:title", content: "BookHug — Find your next book hug 🤗" },
      {
        property: "og:description",
        content:
          "Buy, sell and exchange books with cute pet usernames. Connect with readers, sellers and libraries near you on BookHug 🌸",
      },
    ],
  }),
  component: LandingPage,
});

const tintMap = {
  peach: "bg-peach text-peach-foreground",
  mint: "bg-mint text-mint-foreground",
  butter: "bg-butter text-butter-foreground",
  blush: "bg-blush text-blush-foreground",
} as const;

function LandingPage() {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <ConfettiBurst />

      {/* Soft background blobs */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-24 -left-20 size-72 rounded-full bg-peach/40 blur-3xl" />
        <div className="absolute top-40 -right-24 size-80 rounded-full bg-mint/40 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 size-72 rounded-full bg-butter/40 blur-3xl" />
      </div>

      {/* Nav */}
      <header className="px-5 sm:px-8 lg:px-12 pt-6">
        <nav className="mx-auto max-w-6xl flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 group">
            <span className="text-3xl group-hover:animate-wiggle inline-block">📚</span>
            <span className="font-display text-2xl font-bold text-foreground">
              Book<span className="text-primary">Hug</span>
            </span>
          </a>
          <Button
            asChild
            className="rounded-full font-display font-semibold shadow-cute hover:scale-105 transition-transform"
          >
            <a href="/login">Get Started</a>
          </Button>
        </nav>
      </header>

      {/* Hero */}
      <section className="px-5 sm:px-8 lg:px-12 pt-10 pb-16">
        <div className="mx-auto max-w-6xl grid md:grid-cols-2 gap-10 items-center">
          <div className="text-center md:text-left">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blush/60 text-blush-foreground px-3 py-1 text-xs font-semibold mb-5">
              <Sparkles className="size-3.5" /> A cozy little book community
            </span>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] text-foreground">
              Find your next <span className="text-primary">book hug</span> 🤗
            </h1>
            <p className="mt-5 text-base sm:text-lg text-muted-foreground max-w-md mx-auto md:mx-0">
              Buy, sell, and exchange books with readers, sellers and libraries near you.
              No real names — just adorable pet usernames like{" "}
              <span className="font-semibold text-foreground">cat12 🐱</span> and{" "}
              <span className="font-semibold text-foreground">sunflower3 🌻</span>.
            </p>
            <div className="mt-7 flex flex-wrap gap-3 justify-center md:justify-start">
              <Button
                asChild
                size="lg"
                className="rounded-full font-display font-semibold text-base shadow-hug animate-heart-pulse"
              >
                <a href="/login">
                  <Heart className="size-5" /> Get my book buddy
                </a>
              </Button>
              <Button
                asChild
                size="lg"
                variant="secondary"
                className="rounded-full font-display font-semibold text-base"
              >
                <a href="#most-read">
                  <Search className="size-5" /> Browse books
                </a>
              </Button>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-peach/30 via-mint/20 to-blush/30 blur-2xl rounded-full" />
            <img
              src={heroImg}
              alt="A cute stack of pastel books smiling"
              width={1024}
              height={1024}
              className="relative w-full max-w-md mx-auto animate-float-slow drop-shadow-xl"
            />
          </div>
        </div>
      </section>

      {/* Most read */}
      <section id="most-read" className="px-5 sm:px-8 lg:px-12 py-14 bg-card/60 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-8">
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground">
              Most read on the internet 🌍📖
            </h2>
            <p className="mt-2 text-muted-foreground">
              The books everyone is hugging right now.
            </p>
          </div>

          <div className="-mx-5 sm:-mx-8 lg:-mx-12 px-5 sm:px-8 lg:px-12 overflow-x-auto pb-4">
            <ul className="flex gap-4 sm:gap-5 snap-x snap-mandatory">
              {mostReadBooks.map((book) => (
                <li
                  key={book.id}
                  className="snap-start shrink-0 w-36 sm:w-44 group"
                >
                  <div
                    className={`relative aspect-[2/3] rounded-2xl overflow-hidden shadow-cute transition-transform duration-300 group-hover:-translate-y-2 group-hover:rotate-[-2deg] ${tintMap[book.tint]}`}
                  >
                    <img
                      src={book.cover}
                      alt={`Cover of ${book.title} by ${book.author}`}
                      loading="lazy"
                      className="absolute inset-0 size-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>
                  <p className="mt-3 font-display font-semibold text-sm text-foreground line-clamp-2">
                    {book.title}
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-1">{book.author}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Roles */}
      <section className="px-5 sm:px-8 lg:px-12 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-10">
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground">
              Who are you, book friend? 💕
            </h2>
            <p className="mt-2 text-muted-foreground">Pick your role to start your cozy journey.</p>
          </div>

          <div className="grid sm:grid-cols-3 gap-5">
            <RoleCard
              emoji="📖"
              title="Reader"
              description="Trade, sell or grab a new read from a buddy nearby."
              icon={<BookOpen className="size-5" />}
              tint="bg-peach"
            />
            <RoleCard
              emoji="🏪"
              title="Book Seller"
              description="Run a shop? List your books and meet new readers."
              icon={<Store className="size-5" />}
              tint="bg-mint"
            />
            <RoleCard
              emoji="📚"
              title="Library Owner"
              description="Verified libraries can lend out & curate collections."
              icon={<Library className="size-5" />}
              tint="bg-butter"
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-5 sm:px-8 lg:px-12 py-10 border-t border-border/50">
        <div className="mx-auto max-w-6xl text-center">
          <p className="font-display text-sm text-muted-foreground">
            Made with <Heart className="inline size-4 text-primary fill-primary animate-heart-pulse" />{" "}
            for book lovers everywhere.
          </p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            © {new Date().getFullYear()} BookHug. Real names stay home — only pet names play here. 🐾
          </p>
        </div>
      </footer>
    </div>
  );
}

function RoleCard({
  emoji,
  title,
  description,
  icon,
  tint,
}: {
  emoji: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  tint: string;
}) {
  return (
    <a
      href="/login"
      className="group relative block rounded-3xl bg-card p-6 shadow-cute border border-border/50 hover:shadow-hug hover:-translate-y-1 transition-all duration-300"
    >
      <div
        className={`size-14 rounded-2xl ${tint} flex items-center justify-center text-3xl mb-4 group-hover:animate-hug-bounce`}
      >
        {emoji}
      </div>
      <h3 className="font-display text-xl font-bold text-foreground flex items-center gap-2">
        {title}
      </h3>
      <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
      <div className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
        {icon} Join as {title}
      </div>
    </a>
  );
}
