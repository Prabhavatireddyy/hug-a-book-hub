import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, Library, MapPinned, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useBookHugAuth } from "@/lib/bookhug-auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Login — BookHug" },
      {
        name: "description",
        content: "Sign in with Google to start buying, selling, and exchanging books on BookHug.",
      },
      { property: "og:title", content: "Login — BookHug" },
      {
        property: "og:description",
        content: "Sign in with Google to start buying, selling, and exchanging books on BookHug.",
      },
    ],
  }),
  component: LoginPage,
});

const roles = [
  {
    title: "Reader",
    description: "Find nearby readers, buy books, and swap your shelf favorites.",
    icon: BookOpen,
    surface: "bg-peach",
  },
  {
    title: "Book Seller",
    description: "Show your shop stock, respond to buyers, and build your local book crowd.",
    icon: Store,
    surface: "bg-mint",
  },
  {
    title: "Library Owner",
    description: "Create a public collection, manage discovery, and verify your library profile.",
    icon: Library,
    surface: "bg-butter",
  },
] as const;

function LoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated, hasCompletedOnboarding, loading, startGoogleLogin, backendUrl } = useBookHugAuth();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && isAuthenticated) {
      void navigate({ to: hasCompletedOnboarding ? "/home" : "/onboarding" });
    }
  }, [hasCompletedOnboarding, isAuthenticated, loading, navigate]);

  const handleGoogleLogin = async () => {
    setSubmitting(true);
    try {
      await startGoogleLogin("/onboarding");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-background px-5 py-8 sm:px-8 lg:px-12">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-6">
          <Link to="/" className="inline-flex items-center gap-2 font-display text-xl font-bold text-foreground">
            <span className="text-2xl">📚</span>
            Book<span className="text-primary">Hug</span>
          </Link>

          <div className="space-y-4">
            <p className="inline-flex rounded-full bg-blush/70 px-3 py-1 text-xs font-semibold text-blush-foreground">
              Google sign-in with your own PC server
            </p>
            <h1 className="font-display text-4xl font-bold text-foreground sm:text-5xl">
              Sign in, then choose how you share books.
            </h1>
            <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
              Your frontend stays here, while your Google login and MySQL data live on your own PC-hosted BookHug server.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {roles.map((role) => {
              const Icon = role.icon;
              return (
                <Card key={role.title} className="rounded-3xl border-border/70 shadow-cute">
                  <CardHeader className="pb-3">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${role.surface}`}>
                      <Icon className="size-5 text-foreground" />
                    </div>
                    <CardTitle className="font-display text-xl">{role.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{role.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <section>
          <Card className="rounded-[2rem] border-border/70 bg-card shadow-hug">
            <CardHeader>
              <CardTitle className="font-display text-3xl">Continue with Google</CardTitle>
              <CardDescription>
                BookHug will redirect through your PC server so Google can authenticate securely.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <Button
                type="button"
                size="lg"
                className="h-12 w-full rounded-full font-display text-base"
                onClick={() => void handleGoogleLogin()}
                disabled={submitting}
              >
                <span className="text-lg">🌐</span>
                {submitting ? "Redirecting to Google..." : "Continue with Google"}
                <ArrowRight className="size-4" />
              </Button>

              <div className="rounded-3xl border border-border/70 bg-muted/40 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary">
                    <MapPinned className="size-5 text-secondary-foreground" />
                  </div>
                  <div>
                    <p className="font-display text-lg font-semibold text-foreground">Backend target</p>
                    <p className="mt-1 break-all text-sm text-muted-foreground">{backendUrl}</p>
                  </div>
                </div>
              </div>

              <ol className="space-y-3 text-sm text-muted-foreground">
                <li>1. Your PC server starts the Google OAuth flow.</li>
                <li>2. Google returns to your public HTTPS tunnel callback URL.</li>
                <li>3. BookHug creates a cookie session and sends you into onboarding.</li>
              </ol>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
