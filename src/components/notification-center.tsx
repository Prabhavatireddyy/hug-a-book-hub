import { useEffect, useMemo, useState } from "react";
import { Bell, BookHeart, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { bookhugApi, type AppNotification } from "@/lib/bookhug-api";
import { cn } from "@/lib/utils";
import { useBookHugAuth } from "@/lib/bookhug-auth";

export function NotificationCenter() {
  const { isAuthenticated } = useBookHugAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.isRead).length,
    [notifications],
  );

  const loadNotifications = async () => {
    if (!isAuthenticated) {
      setNotifications([]);
      return;
    }

    setLoading(true);
    try {
      const response = await bookhugApi.getNotifications();
      setNotifications(response.notifications);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load notifications.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      void loadNotifications();
    }
  }, [open, isAuthenticated]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          size="icon"
          className="fixed bottom-5 right-5 z-40 h-12 w-12 rounded-full shadow-hug"
          aria-label="Open notifications"
        >
          <Bell className="size-5" />
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-blush px-1.5 text-[10px] font-bold text-blush-foreground">
              {unreadCount}
            </span>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full max-w-md border-border bg-card sm:max-w-md">
        <SheetHeader className="pr-10">
          <SheetTitle className="font-display text-2xl">Your book buzz</SheetTitle>
          <SheetDescription>
            Buy requests sent, incoming swaps, and new activity from BookHug.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 flex items-center justify-between">
          <Badge variant="secondary" className="rounded-full px-3 py-1">
            {unreadCount} unread
          </Badge>
          <Button variant="outline" size="sm" className="rounded-full" onClick={() => void loadNotifications()}>
            <RefreshCcw className={cn("size-4", loading && "animate-spin")} /> Refresh
          </Button>
        </div>

        <div className="mt-5 space-y-3 overflow-y-auto pb-8">
          {notifications.length === 0 && !loading ? (
            <div className="rounded-3xl border border-border bg-muted/40 p-6 text-center">
              <BookHeart className="mx-auto size-10 text-primary" />
              <p className="mt-3 font-display text-lg font-semibold text-foreground">No requests yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Once people send buy or exchange requests, they will appear here.
              </p>
            </div>
          ) : null}

          {notifications.map((notification) => (
            <article
              key={notification.id}
              className="rounded-3xl border border-border/70 bg-background/80 p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-base font-semibold text-foreground">{notification.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{notification.body}</p>
                </div>
                {!notification.isRead ? (
                  <Badge className="rounded-full px-2 py-0.5 text-[10px]">New</Badge>
                ) : null}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {new Date(notification.createdAt).toLocaleString()}
              </p>
            </article>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
