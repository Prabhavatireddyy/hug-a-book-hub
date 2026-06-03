import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BadgeCheck, CreditCard, LoaderCircle, MessageCircle, Phone, Receipt } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { bookhugApi, type PaymentHistoryItem } from "@/lib/bookhug-api";
import { useBookHugAuth } from "@/lib/bookhug-auth";

export const Route = createFileRoute("/payments")({
  head: () => ({
    meta: [
      { title: "My payments — BookHug" },
      {
        name: "description",
        content: "See your BookHug connect payments and the contacts you've unlocked for buying, selling and exchanging books.",
      },
      { property: "og:title", content: "My payments — BookHug" },
      { property: "og:description", content: "Your BookHug connect payments and unlocked contacts." },
    ],
  }),
  component: PaymentsPage,
});

const statusStyles: Record<string, string> = {
  paid: "bg-mint/50 text-mint-foreground",
  created: "bg-butter/60 text-butter-foreground",
  failed: "bg-destructive/10 text-destructive",
};

function PaymentsPage() {
  const navigate = useNavigate();
  const { loading: authLoading, isAuthenticated } = useBookHugAuth();
  const [payments, setPayments] = useState<PaymentHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) void navigate({ to: "/login" });
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const load = async () => {
      setLoading(true);
      try {
        const response = await bookhugApi.getPaymentHistory();
        setPayments(response.payments);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not load your payments.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [isAuthenticated]);

  return (
    <main className="min-h-screen bg-background px-5 py-8 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-3xl space-y-6">
        <Link to="/home" className="font-display text-lg font-semibold text-primary">
          ← Back to search
        </Link>

        <header className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-peach/70 px-3 py-1 text-xs font-semibold text-peach-foreground">
            <Receipt className="size-3.5" /> Payments
          </div>
          <h1 className="font-display text-4xl font-bold text-foreground">My payments</h1>
          <p className="text-muted-foreground">
            Every ₹5 connect fee you've paid, and the contacts it unlocked. Keep this as your record.
          </p>
        </header>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
            <LoaderCircle className="size-6 animate-spin" /> Loading your payments...
          </div>
        ) : payments.length === 0 ? (
          <Card className="rounded-[2rem] border-border/70 shadow-cute">
            <CardContent className="p-10 text-center">
              <CreditCard className="mx-auto size-10 text-primary" />
              <p className="mt-3 font-display text-xl font-semibold text-foreground">No payments yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                When you connect with someone to buy or exchange a book, your ₹5 payment will show up here.
              </p>
              <Button asChild className="mt-5 rounded-full">
                <Link to="/home">Find a book</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {payments.map((payment) => (
              <Card key={payment.id} className="rounded-[1.75rem] border-border/70 shadow-cute">
                <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                  <div>
                    <CardTitle className="font-display text-xl">{payment.bookTitle}</CardTitle>
                    <CardDescription>
                      With <span className="font-semibold capitalize">{payment.ownerPetName}</span> ·{" "}
                      {new Date(payment.createdAt).toLocaleString()}
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-xl font-bold text-foreground">
                      ₹{(payment.amountPaise / 100).toFixed(0)}
                    </p>
                    <Badge className={`rounded-full px-3 py-0.5 text-[11px] capitalize ${statusStyles[payment.status] ?? ""}`}>
                      {payment.status === "paid" ? "Paid" : payment.status}
                    </Badge>
                  </div>
                </CardHeader>
                {payment.status === "paid" && payment.contact ? (
                  <CardContent className="space-y-2">
                    <div className="flex items-center gap-2 font-display text-sm font-semibold text-foreground">
                      <BadgeCheck className="size-4 text-primary" /> Contact unlocked
                    </div>
                    {payment.contact.mobile ? (
                      <a
                        href={`tel:${payment.contact.mobile}`}
                        className="flex items-center gap-2 rounded-2xl bg-background px-4 py-3 text-sm text-foreground"
                      >
                        <Phone className="size-4 text-primary" /> {payment.contact.mobile}
                      </a>
                    ) : null}
                    {payment.contact.whatsapp ? (
                      <a
                        href={`https://wa.me/${payment.contact.whatsapp.replace(/[^\d]/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 rounded-2xl bg-background px-4 py-3 text-sm text-foreground"
                      >
                        <MessageCircle className="size-4 text-primary" /> WhatsApp {payment.contact.whatsapp}
                      </a>
                    ) : null}
                  </CardContent>
                ) : payment.status !== "paid" ? (
                  <CardContent>
                    <Button asChild variant="outline" className="rounded-full">
                      <Link to="/connect/$requestId" params={{ requestId: String(payment.requestId) }}>
                        Finish connecting
                      </Link>
                    </Button>
                  </CardContent>
                ) : null}
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
