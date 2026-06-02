import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, BookOpen, ExternalLink, LoaderCircle, LogOut, Search, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { bookhugApi, type SearchListing, type SearchResponse } from "@/lib/bookhug-api";
import { useBookHugAuth } from "@/lib/bookhug-auth";

export const Route = createFileRoute("/home")({
  head: () => ({
    meta: [
      { title: "Home — BookHug" },
      {
        name: "description",
        content: "Search nearby readers, sellers, and libraries while comparing online prices on BookHug.",
      },
      { property: "og:title", content: "Home — BookHug" },
      {
        property: "og:description",
        content: "Search nearby readers, sellers, and libraries while comparing online prices on BookHug.",
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAuthenticated, hasCompletedOnboarding, logout } = useBookHugAuth();
  const [query, setQuery] = useState("Harry Potter");
  const [mode, setMode] = useState("all");
  const [searchData, setSearchData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [requestingId, setRequestingId] = useState<string | number | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated && !hasCompletedOnboarding) {
      void navigate({ to: "/onboarding" });
    }
  }, [authLoading, hasCompletedOnboarding, isAuthenticated, navigate]);

  useEffect(() => {
    const loadSearch = async () => {
      setLoading(true);
      try {
        const response = await bookhugApi.searchBooks(query, mode);
        setSearchData(response);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not load search results.");
      } finally {
        setLoading(false);
      }
    };

    void loadSearch();
  }, [mode]);

  const handleSearch = async () => {
    setLoading(true);
    try {
      const response = await bookhugApi.searchBooks(query, mode);
      setSearchData(response);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not run the search.");
    } finally {
      setLoading(false);
    }
  };

  const handleRequest = async (type: "buy" | "exchange", listing: SearchListing) => {
    if (!isAuthenticated) {
      toast.error("Please sign in first.");
      await navigate({ to: "/login" });
      return;
    }

    setRequestingId(listing.id);
    try {
      await bookhugApi.sendRequest(type, { listingId: listing.id, toPetName: listing.ownerPetName });
      toast.success(`${type === "buy" ? "Buy" : "Exchange"} request sent to ${listing.ownerPetName}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send request.");
    } finally {
      setRequestingId(null);
    }
  };

  const sections = useMemo(
    () => [
      { title: "Nearby readers", items: searchData?.nearby ?? [], fallback: "No nearby readers yet." },
      { title: "Book sellers", items: searchData?.sellers ?? [], fallback: "No sellers matched this search." },
      { title: "Libraries", items: searchData?.libraries ?? [], fallback: "No libraries to show yet." },
    ],
    [searchData],
  );

  return (
    <main className="min-h-screen bg-background px-5 py-6 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 rounded-[2rem] border border-border/70 bg-card/90 p-5 shadow-cute md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12 border border-border bg-peach/50">
              <AvatarImage src={user?.avatarUrl} alt={user?.petName ?? "BookHug user"} />
              <AvatarFallback className="bg-peach text-peach-foreground">
                {(user?.petName ?? "BH").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-display text-2xl font-bold text-foreground">
                {user?.petName ? `Hi, ${user.petName}` : "Explore BookHug"}
              </p>
              <p className="text-sm text-muted-foreground">
                {user?.city ? `Searching around ${user.city}` : "Browse readers, sellers, libraries, and online prices."}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {user?.role ? <Badge className="rounded-full px-3 py-1 capitalize">{user.role}</Badge> : null}
            {isAuthenticated ? (
              <>
                <Button asChild className="rounded-full">
                  <Link to="/profile">
                    <BookOpen className="size-4" /> My Books
                  </Link>
                </Button>
                <Button asChild variant="outline" className="rounded-full">
                  <Link to="/u/$petname" params={{ petname: user?.petName ?? "mango7" }}>
                    My profile
                  </Link>
                </Button>
                <Button variant="outline" className="rounded-full" onClick={() => void logout()}>
                  <LogOut className="size-4" /> Logout
                </Button>
              </>
            ) : (
              <Button asChild className="rounded-full">
                <Link to="/login">Sign in</Link>
              </Button>
            )}
          </div>
        </header>

        <section className="grid gap-6 xl:grid-cols-[1.6fr_0.8fr]">
          <div className="space-y-6">
            <Card className="rounded-[2rem] border-border/70 shadow-hug">
              <CardHeader>
                <CardTitle className="font-display text-3xl">Search your next book hug</CardTitle>
                <CardDescription>
                  Split view for nearby readers and sellers, plus quick online price checks.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex flex-col gap-3 md:flex-row">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search for a title or author"
                      className="h-12 rounded-full bg-background pl-11"
                    />
                  </div>
                  <Button className="h-12 rounded-full px-6 font-display" onClick={() => void handleSearch()}>
                    Search
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {[
                    { value: "all", label: "All" },
                    { value: "buy-reader", label: "Buy from reader" },
                    { value: "buy-seller", label: "Buy from seller" },
                    { value: "exchange", label: "Exchange" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setMode(option.value)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                        mode === option.value
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {loading ? (
              <div className="flex min-h-52 items-center justify-center rounded-[2rem] border border-border/70 bg-card/60">
                <LoaderCircle className="size-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-6">
                {sections.map((section) => (
                  <section key={section.title} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h2 className="font-display text-2xl font-bold text-foreground">{section.title}</h2>
                      <Badge variant="secondary" className="rounded-full px-3 py-1">
                        {section.items.length} results
                      </Badge>
                    </div>
                    {section.items.length === 0 ? (
                      <Card className="rounded-[2rem] border-border/70 bg-muted/30 shadow-sm">
                        <CardContent className="p-6">
                          <p className="font-display text-xl font-semibold text-foreground">No book buddies here yet 🥲</p>
                          <p className="mt-2 text-sm text-muted-foreground">{section.fallback}</p>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="grid gap-4 lg:grid-cols-2">
                        {section.items.map((listing) => (
                          <Card key={`${section.title}-${listing.id}`} className="rounded-[2rem] border-border/70 shadow-cute">
                            <CardContent className="p-4">
                              <div className="flex gap-4">
                                <img
                                  src={listing.coverUrl || "https://covers.openlibrary.org/b/isbn/0547928227-L.jpg"}
                                  alt={`${listing.title} cover`}
                                  className="h-32 w-24 rounded-2xl object-cover"
                                  loading="lazy"
                                />
                                <div className="flex flex-1 flex-col">
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <Link
                                        to="/u/$petname"
                                        params={{ petname: listing.ownerPetName }}
                                        className="font-display text-lg font-semibold text-foreground hover:text-primary"
                                      >
                                        {listing.ownerPetName}
                                      </Link>
                                      <p className="text-sm text-muted-foreground">{listing.city || "Nearby"} · {listing.distanceKm} km</p>
                                    </div>
                                    <Badge variant="secondary" className="rounded-full px-3 py-1 capitalize">
                                      {listing.ownerRole}
                                    </Badge>
                                  </div>
                                  <p className="mt-3 font-display text-xl font-bold text-foreground">{listing.title}</p>
                                  <p className="text-sm text-muted-foreground">{listing.author || "Author not listed"}</p>
                                  <div className="mt-4 flex items-center justify-between">
                                    <div>
                                      <p className="text-xs uppercase tracking-wide text-muted-foreground">{listing.listingType}</p>
                                      <p className="font-display text-lg font-semibold text-foreground">
                                        {listing.price ? `₹${listing.price}` : "Swap / Ask"}
                                      </p>
                                    </div>
                                    <div className="flex gap-2">
                                      {listing.listingType !== "library" ? (
                                        <Button
                                          size="sm"
                                          className="rounded-full"
                                          onClick={() => void handleRequest(listing.listingType === "exchange" ? "exchange" : "buy", listing)}
                                          disabled={requestingId === listing.id}
                                        >
                                          {listing.listingType === "exchange" ? (
                                            <ArrowRightLeft className="size-4" />
                                          ) : (
                                            <ShoppingBag className="size-4" />
                                          )}
                                          {requestingId === listing.id
                                            ? "Sending..."
                                            : listing.listingType === "exchange"
                                              ? "Request swap"
                                              : "Send request"}
                                        </Button>
                                      ) : (
                                        <Button asChild size="sm" variant="secondary" className="rounded-full">
                                          <Link to="/u/$petname" params={{ petname: listing.ownerPetName }}>
                                            View profile
                                          </Link>
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </section>
                ))}
              </div>
            )}
          </div>

          <aside>
            <Card className="sticky top-6 rounded-[2rem] border-border/70 shadow-cute">
              <CardHeader>
                <CardTitle className="font-display text-2xl">Online prices</CardTitle>
                <CardDescription>Live comparison for "{searchData?.query || query}" so you know a fair price.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(searchData?.onlinePrices ?? []).map((price) => (
                  <a
                    key={price.store}
                    href={price.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between rounded-3xl border border-border/70 bg-background px-4 py-4 transition-colors hover:bg-muted/40"
                  >
                    <div>
                      <p className="font-display text-lg font-semibold text-foreground">{price.store}</p>
                      <p className="text-sm text-muted-foreground">
                        {price.price != null ? "Live price found" : "Tap to see prices"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-xl font-bold text-foreground">
                        {price.price != null ? `₹${price.price}` : "Search"}
                      </p>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                        Visit <ExternalLink className="size-3.5" />
                      </span>
                    </div>
                  </a>
                ))}

                <div className="rounded-3xl bg-blush/50 p-4">
                  <p className="font-display text-lg font-semibold text-foreground">Why compare?</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Checking the online price helps you offer a fair deal to nearby readers and sellers.
                  </p>
                </div>
              </CardContent>
            </Card>
          </aside>
        </section>
      </div>
    </main>
  );
}
