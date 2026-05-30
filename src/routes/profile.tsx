import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowRightLeft, BookPlus, ImagePlus, LoaderCircle, ShoppingBag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { bookhugApi, type MyListing } from "@/lib/bookhug-api";
import { useBookHugAuth } from "@/lib/bookhug-auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "My Books — BookHug" },
      {
        name: "description",
        content: "Add your books with photos and choose to sell or exchange them on BookHug.",
      },
      { property: "og:title", content: "My Books — BookHug" },
      {
        property: "og:description",
        content: "Add your books with photos and choose to sell or exchange them on BookHug.",
      },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const navigate = useNavigate();
  const { user, loading, isAuthenticated, hasCompletedOnboarding } = useBookHugAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [listings, setListings] = useState<MyListing[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [listingType, setListingType] = useState<"sell" | "exchange">("sell");
  const [price, setPrice] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | number | null>(null);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      void navigate({ to: "/login" });
    }
  }, [isAuthenticated, loading, navigate]);

  useEffect(() => {
    if (!loading && isAuthenticated && !hasCompletedOnboarding) {
      void navigate({ to: "/onboarding" });
    }
  }, [hasCompletedOnboarding, isAuthenticated, loading, navigate]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const loadListings = async () => {
      setLoadingList(true);
      try {
        const response = await bookhugApi.getMyListings();
        setListings(response.listings);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not load your books.");
      } finally {
        setLoadingList(false);
      }
    };
    void loadListings();
  }, [isAuthenticated]);

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setPhoto(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  };

  const resetForm = () => {
    setTitle("");
    setAuthor("");
    setListingType("sell");
    setPrice("");
    setPhoto(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) {
      toast.error("Please enter the book name.");
      return;
    }
    if (listingType === "sell" && (!price.trim() || Number(price) <= 0)) {
      toast.error("Please enter a valid price to sell.");
      return;
    }

    const formData = new FormData();
    formData.append("title", title.trim());
    formData.append("author", author.trim());
    formData.append("listingType", listingType);
    if (listingType === "sell") formData.append("price", price.trim());
    if (photo) formData.append("photo", photo);

    setSubmitting(true);
    try {
      const response = await bookhugApi.createListing(formData);
      setListings((prev) => [response.listing, ...prev]);
      toast.success("Book added to your shelf.");
      resetForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add the book.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string | number) => {
    setDeletingId(id);
    try {
      await bookhugApi.deleteListing(id);
      setListings((prev) => prev.filter((item) => item.id !== id));
      toast.success("Book removed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove the book.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <main className="min-h-screen bg-background px-5 py-8 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link to="/home" className="font-display text-lg font-semibold text-primary">
            ← Back to search
          </Link>
          {user?.petName ? (
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/u/$petname" params={{ petname: user.petName }}>
                View public profile
              </Link>
            </Button>
          ) : null}
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <Card className="rounded-[2rem] border-border/70 shadow-hug">
            <CardHeader>
              <div className="inline-flex w-fit items-center gap-2 rounded-full bg-blush/70 px-3 py-1 text-xs font-semibold text-blush-foreground">
                <BookPlus className="size-3.5" /> Add a book
              </div>
              <CardTitle className="font-display text-3xl">Put a book on your shelf</CardTitle>
              <CardDescription>Add a name, photo, and choose to sell or exchange it.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-5" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <label htmlFor="title" className="text-sm font-medium text-foreground">
                    Book name
                  </label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="The Alchemist"
                    className="h-11 rounded-2xl bg-background"
                    maxLength={255}
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="author" className="text-sm font-medium text-foreground">
                    Author <span className="text-muted-foreground">(optional)</span>
                  </label>
                  <Input
                    id="author"
                    value={author}
                    onChange={(event) => setAuthor(event.target.value)}
                    placeholder="Paulo Coelho"
                    className="h-11 rounded-2xl bg-background"
                    maxLength={255}
                  />
                </div>

                <div className="space-y-2">
                  <span className="text-sm font-medium text-foreground">Book photo</span>
                  <input
                    ref={fileInputRef}
                    id="photo"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoChange}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex w-full items-center gap-4 rounded-3xl border border-dashed border-border bg-muted/40 p-4 text-left transition-colors hover:bg-muted/60"
                  >
                    {photoPreview ? (
                      <img src={photoPreview} alt="Selected book" className="h-20 w-16 rounded-xl object-cover" />
                    ) : (
                      <span className="flex h-20 w-16 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
                        <ImagePlus className="size-6" />
                      </span>
                    )}
                    <span className="text-sm text-muted-foreground">
                      {photo ? photo.name : "Tap to choose a cover photo (optional)"}
                    </span>
                  </button>
                </div>

                <div className="space-y-2">
                  <span className="text-sm font-medium text-foreground">What do you want to do?</span>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setListingType("sell")}
                      className={cn(
                        "flex items-center gap-2 rounded-2xl border px-4 py-3 font-display font-semibold transition-all",
                        listingType === "sell"
                          ? "border-primary bg-primary/10 shadow-cute"
                          : "border-border/70 bg-background hover:bg-muted/40",
                      )}
                    >
                      <ShoppingBag className="size-4" /> Sell
                    </button>
                    <button
                      type="button"
                      onClick={() => setListingType("exchange")}
                      className={cn(
                        "flex items-center gap-2 rounded-2xl border px-4 py-3 font-display font-semibold transition-all",
                        listingType === "exchange"
                          ? "border-primary bg-primary/10 shadow-cute"
                          : "border-border/70 bg-background hover:bg-muted/40",
                      )}
                    >
                      <ArrowRightLeft className="size-4" /> Exchange
                    </button>
                  </div>
                </div>

                {listingType === "sell" ? (
                  <div className="space-y-2">
                    <label htmlFor="price" className="text-sm font-medium text-foreground">
                      Price (₹)
                    </label>
                    <Input
                      id="price"
                      type="number"
                      min="1"
                      value={price}
                      onChange={(event) => setPrice(event.target.value)}
                      placeholder="250"
                      className="h-11 rounded-2xl bg-background"
                    />
                  </div>
                ) : null}

                <Button
                  type="submit"
                  size="lg"
                  className="h-12 w-full rounded-full font-display text-base"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <LoaderCircle className="size-4 animate-spin" /> Adding...
                    </>
                  ) : (
                    "Add book"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="rounded-[2rem] border-border/70 shadow-cute">
            <CardHeader>
              <CardTitle className="font-display text-3xl">My shelf</CardTitle>
              <CardDescription>Books you are selling or exchanging.</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingList ? (
                <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
                  <LoaderCircle className="size-5 animate-spin" /> Loading your books...
                </div>
              ) : listings.length === 0 ? (
                <div className="rounded-3xl bg-muted/40 p-8 text-center text-muted-foreground">
                  <p className="font-display text-lg font-semibold text-foreground">No books yet</p>
                  <p className="mt-1 text-sm">Add your first book using the form on the left.</p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {listings.map((listing) => (
                    <article key={listing.id} className="rounded-[1.5rem] border border-border/70 bg-background p-4">
                      <img
                        src={listing.coverUrl || "https://covers.openlibrary.org/b/isbn/0547928227-L.jpg"}
                        alt={`${listing.title} cover`}
                        className="h-48 w-full rounded-[1.25rem] object-cover"
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
                      <h2 className="mt-3 font-display text-xl font-bold text-foreground">{listing.title}</h2>
                      <p className="text-sm text-muted-foreground">{listing.author || "Author not listed"}</p>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <p className="font-display text-lg font-semibold text-foreground">
                          {listing.price ? `₹${listing.price}` : "For exchange"}
                        </p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="rounded-full text-destructive hover:bg-destructive/10"
                          onClick={() => void handleDelete(listing.id)}
                          disabled={deletingId === listing.id}
                        >
                          {deletingId === listing.id ? (
                            <LoaderCircle className="size-4 animate-spin" />
                          ) : (
                            <Trash2 className="size-4" />
                          )}
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
