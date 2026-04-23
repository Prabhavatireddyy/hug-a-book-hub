import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { LocateFixed, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useBookHugAuth } from "@/lib/bookhug-auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Onboarding — BookHug" },
      {
        name: "description",
        content: "Pick your BookHug role, choose a pet username, and save your public profile.",
      },
      { property: "og:title", content: "Onboarding — BookHug" },
      {
        property: "og:description",
        content: "Pick your BookHug role, choose a pet username, and save your public profile.",
      },
    ],
  }),
  component: OnboardingPage,
});

const roleChoices = [
  { value: "reader", label: "Reader", helper: "Buy, swap, and browse nearby shelves.", tint: "bg-peach" },
  { value: "seller", label: "Book Seller", helper: "Show your shop name and city.", tint: "bg-mint" },
  { value: "library", label: "Library Owner", helper: "Appear as pending until verified.", tint: "bg-butter" },
] as const;

const petNameIdeas = ["cat12", "mango7", "sunflower3", "pearlfox4", "berrybook5"];

function OnboardingPage() {
  const navigate = useNavigate();
  const { user, loading, isAuthenticated, hasCompletedOnboarding, completeOnboarding } = useBookHugAuth();
  const [role, setRole] = useState<"reader" | "seller" | "library">("reader");
  const [petName, setPetName] = useState(user?.petName ?? petNameIdeas[0]);
  const [city, setCity] = useState(user?.city ?? "");
  const [storeName, setStoreName] = useState(user?.storeName ?? "");
  const [libraryName, setLibraryName] = useState(user?.libraryName ?? "");
  const [locationGranted, setLocationGranted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      void navigate({ to: "/login" });
    }
  }, [isAuthenticated, loading, navigate]);

  useEffect(() => {
    if (!loading && hasCompletedOnboarding) {
      void navigate({ to: "/home" });
    }
  }, [hasCompletedOnboarding, loading, navigate]);

  const helperText = useMemo(() => {
    if (role === "seller") return "Store name and city will be public.";
    if (role === "library") return "Libraries are marked pending until you verify them later.";
    return "Only your pet username will be shown publicly.";
  }, [role]);

  const requestLocation = async () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error("Geolocation is not available in this browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      () => {
        setLocationGranted(true);
        toast.success("Location permission granted.");
      },
      () => {
        toast.error("Please allow location so BookHug can find nearby book buddies.");
      },
      { enableHighAccuracy: false, timeout: 10000 },
    );
  };

  const handleSubmit = async () => {
    if (!petName.trim() || !city.trim()) {
      toast.error("Pet username and city are required.");
      return;
    }
    if (!locationGranted) {
      toast.error("Please allow location before continuing.");
      return;
    }
    if (role === "seller" && !storeName.trim()) {
      toast.error("Store name is required for sellers.");
      return;
    }
    if (role === "library" && !libraryName.trim()) {
      toast.error("Library name is required for libraries.");
      return;
    }

    setSubmitting(true);
    try {
      await completeOnboarding({
        role,
        petName: petName.trim(),
        city: city.trim(),
        storeName: storeName.trim(),
        libraryName: libraryName.trim(),
      });
      toast.success("Your BookHug profile is ready.");
      await navigate({ to: "/home" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save onboarding.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-background px-5 py-8 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-4xl">
        <Link to="/" className="inline-flex items-center gap-2 font-display text-xl font-bold text-foreground">
          <span className="text-2xl">📚</span>
          Book<span className="text-primary">Hug</span>
        </Link>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="rounded-[2rem] border-border/70 shadow-hug">
            <CardHeader>
              <div className="inline-flex w-fit items-center gap-2 rounded-full bg-blush/70 px-3 py-1 text-xs font-semibold text-blush-foreground">
                <Sparkles className="size-3.5" /> Tell us about your shelf
              </div>
              <CardTitle className="font-display text-3xl">Set up your public BookHug profile</CardTitle>
              <CardDescription>{helperText}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-3">
                {roleChoices.map((choice) => (
                  <button
                    key={choice.value}
                    type="button"
                    onClick={() => setRole(choice.value)}
                    className={cn(
                      "rounded-3xl border px-4 py-4 text-left transition-all",
                      role === choice.value
                        ? "border-primary bg-primary/10 shadow-cute"
                        : "border-border/70 bg-background hover:bg-muted/40",
                    )}
                  >
                    <div className={cn("mb-3 h-10 w-10 rounded-2xl", choice.tint)} />
                    <p className="font-display text-lg font-semibold text-foreground">{choice.label}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{choice.helper}</p>
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <label htmlFor="petName" className="text-sm font-medium text-foreground">
                  Pet username
                </label>
                <Input id="petName" value={petName} onChange={(event) => setPetName(event.target.value)} placeholder="cat12" className="h-11 rounded-2xl bg-background" />
                <div className="flex flex-wrap gap-2">
                  {petNameIdeas.map((idea) => (
                    <button
                      key={idea}
                      type="button"
                      className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground"
                      onClick={() => setPetName(idea)}
                    >
                      {idea}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="city" className="text-sm font-medium text-foreground">
                  City
                </label>
                <Input id="city" value={city} onChange={(event) => setCity(event.target.value)} placeholder="Bengaluru" className="h-11 rounded-2xl bg-background" />
              </div>

              {role === "seller" ? (
                <div className="space-y-2">
                  <label htmlFor="storeName" className="text-sm font-medium text-foreground">
                    Store name
                  </label>
                  <Input id="storeName" value={storeName} onChange={(event) => setStoreName(event.target.value)} placeholder="Cozy Corner Books" className="h-11 rounded-2xl bg-background" />
                </div>
              ) : null}

              {role === "library" ? (
                <div className="space-y-2">
                  <label htmlFor="libraryName" className="text-sm font-medium text-foreground">
                    Library name
                  </label>
                  <Input id="libraryName" value={libraryName} onChange={(event) => setLibraryName(event.target.value)} placeholder="Moonlight Library" className="h-11 rounded-2xl bg-background" />
                </div>
              ) : null}

              <div className="rounded-3xl border border-border/70 bg-muted/40 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary">
                    <LocateFixed className="size-5 text-secondary-foreground" />
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="font-display text-lg font-semibold text-foreground">Location permission</p>
                      <p className="text-sm text-muted-foreground">
                        We need your location to find book buddies near you. Pretty please? 🗺️🐾
                      </p>
                    </div>
                    <Button type="button" variant="secondary" className="rounded-full" onClick={() => void requestLocation()}>
                      {locationGranted ? "Location ready" : "Allow location"}
                    </Button>
                  </div>
                </div>
              </div>

              <Button type="button" size="lg" className="h-12 w-full rounded-full font-display text-base" onClick={() => void handleSubmit()} disabled={submitting}>
                {submitting ? "Saving your profile..." : "Enter BookHug"}
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-[2rem] border-border/70 shadow-cute">
            <CardHeader>
              <CardTitle className="font-display text-2xl">What gets saved</CardTitle>
              <CardDescription>Your PC server stores this in MySQL after Google sign-in.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <div className="rounded-3xl bg-peach/50 p-4">
                <p className="font-semibold text-foreground">Public</p>
                <p className="mt-1">Pet username, role, city, and your visible book listings.</p>
              </div>
              <div className="rounded-3xl bg-mint/50 p-4">
                <p className="font-semibold text-foreground">Protected</p>
                <p className="mt-1">Google email, session cookie, and role-linked onboarding details.</p>
              </div>
              <div className="rounded-3xl bg-butter/60 p-4">
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <ShieldCheck className="size-4" /> Library verification
                </div>
                <p className="mt-1">Library owners can browse immediately but stay pending until approved.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
