import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BadgeCheck, Library, MapPin, Store } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { bookhugApi, type PublicProfile } from "@/lib/bookhug-api";

export const Route = createFileRoute("/u/$petname")({
  head: () => ({
    meta: [
      { title: "Public profile — BookHug" },
      {
        name: "description",
        content: "See a BookHug user's public shelf, role, and available book listings.",
      },
      { property: "og:title", content: "Public profile — BookHug" },
      {
        property: "og:description",
        content: "See a BookHug user's public shelf, role, and available book listings.",
      },
    ],
  }),
  component: PublicProfilePage,
});

function PublicProfilePage() {
  const { petname } = Route.useParams();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await bookhugApi.getUserProfile(petname);
        setProfile(response);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load this profile.");
      } finally {
        setLoading(false);
      }
    };

    void loadProfile();
  }, [petname]);

  if (loading) {
    return (
      <main className="min-h-screen bg-background px-5 py-8 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-5xl rounded-[2rem] border border-border/70 bg-card p-8 text-center shadow-cute">
          <p className="font-display text-2xl font-semibold text-foreground">Loading public shelf...</p>
        </div>
      </main>
    );
  }

  if (error || !profile) {
    return (
      <main className="min-h-screen bg-background px-5 py-8 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-5xl rounded-[2rem] border border-border/70 bg-card p-8 text-center shadow-cute">
          <p className="font-display text-2xl font-semibold text-foreground">Profile not found</p>
          <p className="mt-2 text-muted-foreground">{error || "This reader has not shared a public profile yet."}</p>
          <Button asChild className="mt-6 rounded-full">
            <Link to="/home">Back to search</Link>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-5 py-8 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link to="/home" className="font-display text-lg font-semibold text-primary">
            ← Back to search
          </Link>
          <Button asChild variant="outline" className="rounded-full">
            <Link to="/login">Sign in to request a book</Link>
          </Button>
        </div>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <Card className="rounded-[2rem] border-border/70 shadow-hug">
            <CardContent className="flex flex-col items-center p-8 text-center">
              <Avatar className="h-24 w-24 border border-border bg-peach/50">
                <AvatarImage src={profile.avatarUrl} alt={profile.petName} />
                <AvatarFallback className="bg-peach text-peach-foreground">
                  {profile.petName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <h1 className="mt-5 font-display text-4xl font-bold text-foreground">{profile.petName}</h1>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                {profile.role ? <Badge className="rounded-full px-3 py-1 capitalize">{profile.role}</Badge> : null}
                {profile.libraryStatus ? (
                  <Badge variant="secondary" className="rounded-full px-3 py-1 capitalize">
                    {profile.libraryStatus}
                  </Badge>
                ) : null}
              </div>

              <div className="mt-6 w-full space-y-3 text-left">
                {profile.city ? (
                  <div className="flex items-center gap-2 rounded-3xl bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                    <MapPin className="size-4 text-primary" /> {profile.city}
                  </div>
                ) : null}
                {profile.storeName ? (
                  <div className="flex items-center gap-2 rounded-3xl bg-mint/50 px-4 py-3 text-sm text-mint-foreground">
                    <Store className="size-4" /> {profile.storeName}
                  </div>
                ) : null}
                {profile.libraryName ? (
                  <div className="flex items-center gap-2 rounded-3xl bg-butter/60 px-4 py-3 text-sm text-butter-foreground">
                    <Library className="size-4" /> {profile.libraryName}
                  </div>
                ) : null}
                {profile.bio ? (
                  <div className="rounded-3xl bg-peach/40 px-4 py-3 text-sm text-foreground">{profile.bio}</div>
                ) : null}
                <div className="flex items-center gap-2 rounded-3xl bg-blush/50 px-4 py-3 text-sm text-blush-foreground">
                  <BadgeCheck className="size-4" /> No personal name or private details are shown here.
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[2rem] border-border/70 shadow-cute">
            <CardHeader>
              <CardTitle className="font-display text-3xl">Public shelf</CardTitle>
              <CardDescription>Books available to sell, exchange, or lend.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                {profile.listings.map((listing) => (
                  <article key={listing.id} className="rounded-[1.5rem] border border-border/70 bg-background p-4">
                    <img
                      src={listing.coverUrl || "https://covers.openlibrary.org/b/isbn/0547928227-L.jpg"}
                      alt={`${listing.title} cover`}
                      className="h-56 w-full rounded-[1.25rem] object-cover"
                      loading="lazy"
                    />
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <Badge variant="secondary" className="rounded-full px-3 py-1 capitalize">
                        {listing.listingType}
                      </Badge>
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {listing.status || "available"}
                      </span>
                    </div>
                    <h2 className="mt-3 font-display text-2xl font-bold text-foreground">{listing.title}</h2>
                    <p className="text-sm text-muted-foreground">{listing.author || "Author not listed"}</p>
                    <p className="mt-3 font-display text-xl font-semibold text-foreground">
                      {listing.price ? `₹${listing.price}` : "Ask to exchange"}
                    </p>
                  </article>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
