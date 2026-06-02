import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BadgeCheck, CreditCard, LoaderCircle, MessageCircle, Phone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { bookhugApi, type ContactInfo, type RequestDetail } from "@/lib/bookhug-api";
import { useBookHugAuth } from "@/lib/bookhug-auth";

export const Route = createFileRoute("/connect/$requestId")({
  head: () => ({
    meta: [
      { title: "Connect & pay — BookHug" },
      { name: "description", content: "Pay the small ₹5 connection fee to unlock the contact and arrange your book." },
    ],
  }),
  component: ConnectPage,
});

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function ConnectPage() {
  const { requestId } = Route.useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading, isAuthenticated } = useBookHugAuth();
  const [detail, setDetail] = useState<RequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [contact, setContact] = useState<ContactInfo | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) void navigate({ to: "/login" });
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await bookhugApi.getRequest(requestId);
        setDetail(response);
        if (response.contact) setContact(response.contact);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load this request.");
      } finally {
        setLoading(false);
      }
    };
    if (isAuthenticated) void load();
  }, [requestId, isAuthenticated]);

  const handlePay = async () => {
    if (!detail) return;
    setPaying(true);
    try {
      const ok = await loadRazorpayScript();
      if (!ok || !window.Razorpay) {
        throw new Error("Could not load the payment window. Check your connection and try again.");
      }
      const order = await bookhugApi.createPaymentOrder(detail.id);
      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amountPaise,
        currency: order.currency,
        name: "BookHug",
        description: `Unlock ${detail.ownerPetName}'s contact`,
        order_id: order.orderId,
        prefill: { name: user?.petName ?? "", email: user?.email ?? "" },
        theme: { color: "#e57373" },
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            const result = await bookhugApi.verifyPayment(response);
            setContact(result.contact);
            setDetail((prev) => (prev ? { ...prev, contactUnlocked: true } : prev));
            toast.success("Payment successful — contact unlocked!");
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Payment could not be verified.");
          } finally {
            setPaying(false);
          }
        },
        modal: { ondismiss: () => setPaying(false) },
      });
      rzp.open();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start payment.");
      setPaying(false);
    }
  };

  return (
    <main className="min-h-screen bg-background px-5 py-8 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-2xl space-y-6">
        <Link to="/home" className="font-display text-lg font-semibold text-primary">
          ← Back to search
        </Link>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
            <LoaderCircle className="size-6 animate-spin" /> Loading request...
          </div>
        ) : error || !detail ? (
          <Card className="rounded-[2rem] border-border/70 shadow-cute">
            <CardContent className="p-8 text-center">
              <p className="font-display text-2xl font-semibold text-foreground">Something went wrong</p>
              <p className="mt-2 text-muted-foreground">{error ?? "Request not found."}</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-[2rem] border-border/70 shadow-hug">
            <CardHeader>
              <CardTitle className="font-display text-3xl">Connect & pay</CardTitle>
              <CardDescription>
                A small ₹5 fee unlocks {detail.ownerPetName}'s mobile and WhatsApp so you can arrange the book directly.
                Their home address always stays private.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex gap-4 rounded-3xl border border-border/70 bg-background p-4">
                <img
                  src={detail.coverUrl || "https://covers.openlibrary.org/b/isbn/0547928227-L.jpg"}
                  alt={`${detail.bookTitle} cover`}
                  className="h-28 w-20 rounded-2xl object-cover"
                  loading="lazy"
                />
                <div>
                  <p className="font-display text-xl font-bold text-foreground">{detail.bookTitle}</p>
                  <p className="text-sm text-muted-foreground">
                    {detail.requestType === "exchange" ? "Exchange" : "Buy"} with{" "}
                    <span className="font-semibold capitalize">{detail.ownerPetName}</span> ({detail.ownerRole})
                  </p>
                  <p className="mt-2 font-display text-2xl font-bold text-foreground">
                    ₹{(detail.amountPaise / 100).toFixed(0)}
                  </p>
                </div>
              </div>

              {contact ? (
                <div className="space-y-3 rounded-3xl bg-mint/40 p-5 text-mint-foreground">
                  <div className="flex items-center gap-2 font-display text-lg font-semibold">
                    <BadgeCheck className="size-5" /> Contact unlocked
                  </div>
                  {contact.mobile ? (
                    <a
                      href={`tel:${contact.mobile}`}
                      className="flex items-center gap-2 rounded-2xl bg-background px-4 py-3 text-foreground"
                    >
                      <Phone className="size-4 text-primary" /> {contact.mobile}
                    </a>
                  ) : null}
                  {contact.whatsapp ? (
                    <a
                      href={`https://wa.me/${contact.whatsapp.replace(/[^\d]/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 rounded-2xl bg-background px-4 py-3 text-foreground"
                    >
                      <MessageCircle className="size-4 text-primary" /> WhatsApp {contact.whatsapp}
                    </a>
                  ) : null}
                  <p className="text-xs opacity-80">
                    Please be kind and respectful when you reach out. Misuse can get your account blocked.
                  </p>
                </div>
              ) : !detail.razorpayConfigured ? (
                <div className="rounded-3xl bg-butter/60 p-5 text-sm text-butter-foreground">
                  Payments aren't switched on yet. Add your Razorpay keys to the PC server's .env and restart.
                </div>
              ) : (
                <Button
                  size="lg"
                  className="h-12 w-full rounded-full font-display text-base"
                  onClick={() => void handlePay()}
                  disabled={paying}
                >
                  {paying ? (
                    <>
                      <LoaderCircle className="size-4 animate-spin" /> Opening payment...
                    </>
                  ) : (
                    <>
                      <CreditCard className="size-4" /> Pay ₹{(detail.amountPaise / 100).toFixed(0)} with UPI / card
                    </>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
