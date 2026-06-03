import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowRightLeft,
  BadgeCheck,
  Bell,
  BookHeart,
  CreditCard,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
  ShoppingBag,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "How BookHug works — Help & Guide" },
      {
        name: "description",
        content:
          "Step-by-step guide to buying, selling, exchanging and renting books on BookHug — how requests, notifications, the ₹5 connect fee and contact sharing work.",
      },
      { property: "og:title", content: "How BookHug works — Help & Guide" },
      {
        property: "og:description",
        content: "Learn how to buy, sell, exchange and rent books safely on BookHug.",
      },
    ],
  }),
  component: HelpPage,
});

const steps = [
  {
    icon: BookHeart,
    title: "1. Add your books",
    body:
      "Open My Books, add a cover photo, the book name and writer, then choose Sell (set a price) or Exchange. Your mobile number is required first — it stays private.",
  },
  {
    icon: MapPin,
    title: "2. Verify your area",
    body:
      "Save your address and tap 'Use my current location & verify'. We use Google to check your address is within 20 km of where you are, so nearby readers can trust the listing.",
  },
  {
    icon: ShoppingBag,
    title: "3. Find & request a book",
    body:
      "Search any title. You'll see nearby readers, local sellers, libraries and live online prices. Tap a book to send a buy, exchange or rent request.",
  },
  {
    icon: Bell,
    title: "4. Watch your notifications",
    body:
      "The bell (top-right) shows every request. If someone wants your book, you get Accept / Decline buttons. When the other person accepts, you'll get a 'Connect & pay' button.",
  },
  {
    icon: CreditCard,
    title: "5. Pay the small ₹5 connect fee",
    body:
      "To get someone's contact, pay a one-time ₹5 via UPI, QR or card (powered by Razorpay). Sellers and libraries connect instantly; reader-to-reader swaps connect after they accept.",
  },
  {
    icon: Phone,
    title: "6. Connect & arrange",
    body:
      "After payment, the other person's mobile and WhatsApp unlock so you can message and arrange the book directly. Home addresses always stay private.",
  },
];

function HelpPage() {
  return (
    <main className="min-h-screen bg-background px-5 py-8 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-4xl space-y-8">
        <Link to="/home" className="font-display text-lg font-semibold text-primary">
          ← Back to search
        </Link>

        <header className="space-y-3 text-center">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full bg-mint/60 px-4 py-1.5 text-xs font-semibold text-mint-foreground">
            <BookHeart className="size-4" /> Help & Guide
          </div>
          <h1 className="font-display text-4xl font-bold text-foreground sm:text-5xl">How BookHug works</h1>
          <p className="mx-auto max-w-2xl text-muted-foreground">
            BookHug helps you buy, sell, exchange and rent books with real people near you — plus check live online
            prices. Here's everything, step by step.
          </p>
        </header>

        <div className="grid gap-5 sm:grid-cols-2">
          {steps.map((step) => (
            <Card key={step.title} className="rounded-[1.75rem] border-border/70 shadow-cute">
              <CardHeader>
                <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <step.icon className="size-5" />
                </div>
                <CardTitle className="font-display text-xl">{step.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{step.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="rounded-[2rem] border-border/70 shadow-hug">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-2xl">
              <ArrowRightLeft className="size-5 text-primary" /> Buy, Exchange & Rent — what's the difference?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              <span className="font-semibold text-foreground">Buy:</span> Pay the seller or reader directly for a book you
              want to keep. The listing shows the price upfront.
            </p>
            <p>
              <span className="font-semibold text-foreground">Exchange:</span> Swap one of your books for someone else's.
              Both of you use your saved address to plan a safe meetup.
            </p>
            <p>
              <span className="font-semibold text-foreground">Rent (libraries):</span> Borrow from a verified local
              library and return it later. Look for the library badge on a listing.
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-border/70 shadow-cute">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-2xl">
              <ShieldCheck className="size-5 text-primary" /> Staying safe
            </CardTitle>
            <CardDescription>A few simple habits keep everyone happy.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p className="flex items-start gap-2">
              <BadgeCheck className="mt-0.5 size-4 shrink-0 text-primary" /> Meet in public, busy places for exchanges.
            </p>
            <p className="flex items-start gap-2">
              <BadgeCheck className="mt-0.5 size-4 shrink-0 text-primary" /> Check the book's condition before you pay.
            </p>
            <p className="flex items-start gap-2">
              <MessageCircle className="mt-0.5 size-4 shrink-0 text-primary" /> Keep chats on the contact numbers you
              unlocked — be polite and clear.
            </p>
            <p className="flex items-start gap-2">
              <BadgeCheck className="mt-0.5 size-4 shrink-0 text-primary" /> Something feel wrong? Report it — see below.
            </p>
          </CardContent>
        </Card>

        <div className="flex flex-col items-center gap-3 rounded-[2rem] bg-blush/40 p-8 text-center">
          <p className="font-display text-2xl font-bold text-foreground">Still have a problem?</p>
          <p className="max-w-xl text-sm text-muted-foreground">
            If someone has cheated you or behaved badly, tell us and we'll review it within 48 hours.
          </p>
          <Button asChild className="rounded-full">
            <Link to="/complaint">Report a problem</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
