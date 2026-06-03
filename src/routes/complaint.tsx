import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { LoaderCircle, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { bookhugApi } from "@/lib/bookhug-api";
import { useBookHugAuth } from "@/lib/bookhug-auth";

export const Route = createFileRoute("/complaint")({
  head: () => ({
    meta: [
      { title: "Report a problem — BookHug" },
      {
        name: "description",
        content:
          "Report fraud, a fake book, no-show or bad behaviour on BookHug. Our team reviews every complaint within 48 hours.",
      },
      { property: "og:title", content: "Report a problem — BookHug" },
      { property: "og:description", content: "Tell us about fraud or bad behaviour. We review within 48 hours." },
    ],
  }),
  component: ComplaintPage,
});

const CATEGORIES = [
  { value: "fraud", label: "Fraud / money cheated" },
  { value: "fake_book", label: "Fake or wrong book" },
  { value: "no_show", label: "Person didn't show up" },
  { value: "bad_behaviour", label: "Rude or unsafe behaviour" },
  { value: "spam", label: "Spam or fake listing" },
  { value: "other", label: "Something else" },
];

function ComplaintPage() {
  const navigate = useNavigate();
  const { loading, isAuthenticated } = useBookHugAuth();
  const [targetPetName, setTargetPetName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!loading && !isAuthenticated) void navigate({ to: "/login" });
  }, [loading, isAuthenticated, navigate]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!category) {
      toast.error("Please pick what went wrong.");
      return;
    }
    if (description.trim().length < 10) {
      toast.error("Please describe what happened (at least a sentence).");
      return;
    }
    setSubmitting(true);
    try {
      await bookhugApi.submitComplaint({
        targetPetName: targetPetName.trim() || undefined,
        category,
        description: description.trim(),
      });
      setSubmitted(true);
      toast.success("Thank you — we'll review this within 48 hours.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send your report.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-background px-5 py-8 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-2xl space-y-6">
        <Link to="/home" className="font-display text-lg font-semibold text-primary">
          ← Back to search
        </Link>

        <Card className="rounded-[2rem] border-border/70 shadow-hug">
          <CardHeader>
            <div className="inline-flex w-fit items-center gap-2 rounded-full bg-butter/70 px-3 py-1 text-xs font-semibold text-butter-foreground">
              <ShieldAlert className="size-3.5" /> Report a problem
            </div>
            <CardTitle className="font-display text-3xl">Tell us what happened</CardTitle>
            <CardDescription>
              If someone cheated you or behaved badly, report them here. We review every complaint within 48 hours and may
              block accounts that misbehave. Your report is private.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {submitted ? (
              <div className="space-y-4 rounded-3xl bg-mint/40 p-6 text-center text-mint-foreground">
                <p className="font-display text-2xl font-bold">Report received</p>
                <p className="text-sm">
                  Thank you for keeping BookHug safe. Our team will look into this within 48 hours.
                </p>
                <Button asChild className="rounded-full">
                  <Link to="/home">Back to search</Link>
                </Button>
              </div>
            ) : (
              <form className="space-y-5" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <label htmlFor="target" className="text-sm font-medium text-foreground">
                    Who is this about? <span className="text-muted-foreground">(their pet name, optional)</span>
                  </label>
                  <Input
                    id="target"
                    value={targetPetName}
                    onChange={(event) => setTargetPetName(event.target.value)}
                    placeholder="e.g. mango7"
                    className="h-11 rounded-2xl bg-background"
                    maxLength={80}
                  />
                </div>

                <div className="space-y-2">
                  <span className="text-sm font-medium text-foreground">What went wrong?</span>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="h-11 rounded-2xl bg-background">
                      <SelectValue placeholder="Choose a reason" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="description" className="text-sm font-medium text-foreground">
                    Describe what happened
                  </label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Tell us the full story — dates, the book, what was promised, and what went wrong."
                    className="min-h-32 rounded-2xl bg-background"
                    maxLength={1500}
                  />
                  <p className="text-right text-xs text-muted-foreground">{description.length}/1500</p>
                </div>

                <Button
                  type="submit"
                  size="lg"
                  className="h-12 w-full rounded-full font-display text-base"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <LoaderCircle className="size-4 animate-spin" /> Sending...
                    </>
                  ) : (
                    "Send report"
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
