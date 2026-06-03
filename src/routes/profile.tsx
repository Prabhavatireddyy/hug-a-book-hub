import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  ArrowRightLeft,
  BadgeCheck,
  BookPlus,
  Camera,
  CircleAlert,
  ImagePlus,
  LoaderCircle,
  LocateFixed,
  MapPin,
  MessageCircle,
  Phone,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { bookhugApi, type MyListing, type VerifyLocationResult } from "@/lib/bookhug-api";
import { useBookHugAuth } from "@/lib/bookhug-auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "My Books — BookHug" },
      {
        name: "description",
        content: "Add your books with photos, set your avatar, verify your address, and choose to sell or exchange on BookHug.",
      },
      { property: "og:title", content: "My Books — BookHug" },
      {
        property: "og:description",
        content: "Add your books with photos, set your avatar, verify your address, and choose to sell or exchange on BookHug.",
      },
    ],
  }),
  component: ProfilePage,
});

const ROLE_LIMIT_FALLBACK: Record<string, number> = {
  reader: 20,
  seller: 100,
  library: 1000,
  admin: 5000,
};

function ProfilePage() {
  const navigate = useNavigate();
  const { user, loading, isAuthenticated, hasCompletedOnboarding, refreshSession, applyUser } = useBookHugAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  // Listings
  const [listings, setListings] = useState<MyListing[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  // Add-book form
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [listingType, setListingType] = useState<"sell" | "exchange">("sell");
  const [price, setPrice] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | number | null>(null);

  // Profile (avatar + bio)
  const [bio, setBio] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  // Address & verification
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [verifyResult, setVerifyResult] = useState<VerifyLocationResult | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);

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

  // Pull fresh profile extras (bio/address/verified) once authenticated.
  useEffect(() => {
    if (isAuthenticated) void refreshSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // Seed editable fields from the user.
  useEffect(() => {
    if (user) {
      setBio(user.bio ?? "");
      setAddress(user.address ?? "");
      if (user.latitude != null && user.longitude != null) {
        setCoords({ lat: Number(user.latitude), lng: Number(user.longitude) });
      }
    }
  }, [user]);

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

  const role = user?.role ?? "reader";
  const limit = user?.listingLimit ?? ROLE_LIMIT_FALLBACK[role] ?? 20;
  const usedCount = listings.length;
  const limitReached = usedCount >= limit;
  const addressVerified = Boolean(user?.addressVerified);
  const savedAddress = user?.address ?? "";

  const limitPercent = useMemo(() => Math.min(100, Math.round((usedCount / limit) * 100)), [usedCount, limit]);

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setPhoto(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  };

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setAvatarFile(file);
    setAvatarPreview(file ? URL.createObjectURL(file) : null);
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

  const buildProfileFormData = (includeAvatar: boolean) => {
    const formData = new FormData();
    formData.append("bio", bio.trim());
    formData.append("address", address.trim());
    if (coords) {
      formData.append("latitude", String(coords.lat));
      formData.append("longitude", String(coords.lng));
    }
    formData.append("addressVerified", String(Boolean(verifyResult?.verified ?? addressVerified)));
    if (includeAvatar && avatarFile) formData.append("avatar", avatarFile);
    return formData;
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const response = await bookhugApi.updateProfile(buildProfileFormData(true));
      applyUser(response.user);
      setAvatarFile(null);
      setAvatarPreview(null);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
      toast.success("Profile saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save your profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleVerifyLocation = async () => {
    if (!address.trim()) {
      toast.error("Please enter your address first.");
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error("Location is not available in this browser.");
      return;
    }

    setVerifying(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setCoords({ lat, lng });
        try {
          const result = await bookhugApi.verifyLocation({ address: address.trim(), latitude: lat, longitude: lng });
          setVerifyResult(result);
          if (result.verified) {
            toast.success(result.message ?? "Address matches your location.");
          } else {
            toast.warning(result.message ?? "Address does not match your current location.");
          }
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Could not verify your location.");
        } finally {
          setVerifying(false);
        }
      },
      () => {
        setVerifying(false);
        toast.error("Please allow location access so we can verify your address.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleSaveAddress = async () => {
    if (!address.trim()) {
      toast.error("Please enter your address first.");
      return;
    }
    setSavingAddress(true);
    try {
      const response = await bookhugApi.updateProfile(buildProfileFormData(false));
      applyUser(response.user);
      toast.success("Address saved & confirmed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save your address.");
    } finally {
      setSavingAddress(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (limitReached) {
      toast.error(`You've reached your limit of ${limit} books.`);
      return;
    }
    if (!title.trim()) {
      toast.error("Please enter the book name.");
      return;
    }
    if (listingType === "sell" && (!price.trim() || Number(price) <= 0)) {
      toast.error("Please enter a valid price to sell.");
      return;
    }
    if (listingType === "exchange" && !savedAddress) {
      toast.error("Please save your address above before listing a book for exchange.");
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

  const currentAvatar = avatarPreview ?? user?.avatarUrl ?? "";

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

        {/* Profile: avatar + bio */}
        <Card className="rounded-[2rem] border-border/70 shadow-hug">
          <CardHeader>
            <CardTitle className="font-display text-3xl">My profile</CardTitle>
            <CardDescription>Set your avatar and a short note that other readers will see.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-[auto_1fr]">
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <Avatar className="h-28 w-28 border border-border bg-peach/50">
                  <AvatarImage src={currentAvatar} alt={user?.petName ?? "avatar"} />
                  <AvatarFallback className="bg-peach text-peach-foreground text-2xl">
                    {(user?.petName ?? "BH").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-cute"
                  aria-label="Change avatar"
                >
                  <Camera className="size-4" />
                </button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </div>
              <p className="font-display text-lg font-semibold text-foreground">{user?.petName}</p>
              <Badge variant="secondary" className="rounded-full px-3 py-1 capitalize">
                {role}
              </Badge>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="bio" className="text-sm font-medium text-foreground">
                  About me <span className="text-muted-foreground">(shown publicly)</span>
                </label>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                  placeholder="Tell other readers what kind of books you love, swap, or sell..."
                  className="min-h-28 rounded-2xl bg-background"
                  maxLength={600}
                />
                <p className="text-right text-xs text-muted-foreground">{bio.length}/600</p>
              </div>
              <Button
                type="button"
                className="rounded-full"
                onClick={() => void handleSaveProfile()}
                disabled={savingProfile}
              >
                {savingProfile ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" /> Saving...
                  </>
                ) : (
                  "Save profile"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Address & location verification */}
        <Card className="rounded-[2rem] border-border/70 shadow-cute">
          <CardHeader>
            <div className="inline-flex w-fit items-center gap-2 rounded-full bg-mint/60 px-3 py-1 text-xs font-semibold text-mint-foreground">
              <MapPin className="size-3.5" /> Your address
            </div>
            <CardTitle className="font-display text-3xl">Address & location</CardTitle>
            <CardDescription>
              Save your real address so nearby readers, sellers and libraries find you. We check it against your current
              location (within {verifyResult?.thresholdKm ?? 20} km).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="address" className="text-sm font-medium text-foreground">
                Full address
              </label>
              <Textarea
                id="address"
                value={address}
                onChange={(event) => {
                  setAddress(event.target.value);
                  setVerifyResult(null);
                }}
                placeholder="House / street, area, city, pincode"
                className="min-h-20 rounded-2xl bg-background"
                maxLength={500}
              />
            </div>

            {verifyResult ? (
              <div
                className={cn(
                  "flex items-start gap-3 rounded-3xl p-4 text-sm",
                  verifyResult.verified ? "bg-mint/40 text-mint-foreground" : "bg-butter/60 text-butter-foreground",
                )}
              >
                {verifyResult.verified ? (
                  <BadgeCheck className="mt-0.5 size-5 shrink-0" />
                ) : (
                  <CircleAlert className="mt-0.5 size-5 shrink-0" />
                )}
                <div>
                  <p className="font-semibold">
                    {verifyResult.verified ? "Address matches your location" : "Address does not match"}
                  </p>
                  <p className="mt-1">{verifyResult.message}</p>
                  {verifyResult.geocodedLabel ? (
                    <p className="mt-1 text-xs opacity-80">Found: {verifyResult.geocodedLabel}</p>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-3xl bg-muted/40 p-4 text-sm text-muted-foreground">
                <BadgeCheck className={cn("size-4", addressVerified ? "text-primary" : "opacity-50")} />
                {addressVerified ? "Your saved address is verified." : "Your address is not verified yet."}
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="secondary"
                className="rounded-full"
                onClick={() => void handleVerifyLocation()}
                disabled={verifying}
              >
                {verifying ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" /> Checking...
                  </>
                ) : (
                  <>
                    <LocateFixed className="size-4" /> Use my current location & verify
                  </>
                )}
              </Button>
              <Button
                type="button"
                className="rounded-full"
                onClick={() => void handleSaveAddress()}
                disabled={savingAddress}
              >
                {savingAddress ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" /> Saving...
                  </>
                ) : (
                  "Save & confirm"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <Card className="rounded-[2rem] border-border/70 shadow-hug">
            <CardHeader>
              <div className="inline-flex w-fit items-center gap-2 rounded-full bg-blush/70 px-3 py-1 text-xs font-semibold text-blush-foreground">
                <BookPlus className="size-3.5" /> Add a book
              </div>
              <CardTitle className="font-display text-3xl">Put a book on your shelf</CardTitle>
              <CardDescription>Add a name, writer, photo, and choose to sell or exchange it.</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Limit banner */}
              <div className="mb-5 rounded-3xl border border-border/70 bg-muted/40 p-4">
                <div className="flex items-center justify-between text-sm font-semibold text-foreground">
                  <span>
                    Books used ({role} limit)
                  </span>
                  <span className={cn(limitReached && "text-destructive")}>
                    {usedCount} / {limit}
                  </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className={cn("h-full rounded-full", limitReached ? "bg-destructive" : "bg-primary")}
                    style={{ width: `${limitPercent}%` }}
                  />
                </div>
                {limitReached ? (
                  <p className="mt-2 text-xs text-destructive">
                    You've reached your limit. Remove a book before adding a new one.
                  </p>
                ) : null}
              </div>

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
                    Writer name <span className="text-muted-foreground">(optional)</span>
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
                ) : (
                  <div
                    className={cn(
                      "flex items-start gap-3 rounded-3xl p-4 text-sm",
                      savedAddress ? "bg-mint/40 text-mint-foreground" : "bg-butter/60 text-butter-foreground",
                    )}
                  >
                    <MapPin className="mt-0.5 size-4 shrink-0" />
                    {savedAddress ? (
                      <span>Exchange uses your saved address: {savedAddress}</span>
                    ) : (
                      <span>Save your address above first — exchange books need a meetup address.</span>
                    )}
                  </div>
                )}

                <Button
                  type="submit"
                  size="lg"
                  className="h-12 w-full rounded-full font-display text-base"
                  disabled={submitting || limitReached}
                >
                  {submitting ? (
                    <>
                      <LoaderCircle className="size-4 animate-spin" /> Adding...
                    </>
                  ) : limitReached ? (
                    "Limit reached"
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
                      <p className="text-sm text-muted-foreground">{listing.author || "Writer not listed"}</p>
                      {listing.listingType === "exchange" && listing.exchangeAddress ? (
                        <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
                          <MapPin className="mt-0.5 size-3.5 shrink-0" /> {listing.exchangeAddress}
                        </p>
                      ) : null}
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
