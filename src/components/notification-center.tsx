import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bell, BookHeart, Check, CreditCard, RefreshCcw, X } from "lucide-react";
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
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actingId, setActingId] = useState<string | number | null>(null);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isAuthenticated]);

  // Light polling so the bell badge stays fresh while signed in.
  useEffect(() => {
    if (!isAuthenticated) return;
    void loadNotifications();
    const id = window.setInterval(() => void loadNotifications(), 30000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return null;
  }

  const handleRespond = async (notification: AppNotification, action: "accept" | "reject") => {
    if (!notification.requestId) return;
    setActingId(notification.id);
    try {
      await bookhugApi.respondToRequest(notification.requestId, action);
      toast.success(action === "accept" ? "Request accepted." : "Request declined.");
      await loadNotifications();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the request.");
    } finally {
      setActingId(null);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await bookhugApi.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not mark as read.");
    }
  };

  const goToConnect = async (requestId: number | string) => {
    setOpen(false);
    await navigate({ to: "/connect/$requestId", params: { requestId: String(requestId) } });
  };

  const isIncomingPending = (n: AppNotification) =>
    n.type.endsWith("_request_received") && n.requestStatus === "pending";
  const isReadyToPay = (n: AppNotification) =>
    n.type === "request_accepted" && !n.contactUnlocked;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          size="icon"
          variant="outline"
          className="fixed right-4 top-4 z-40 h-11 w-11 rounded-full bg-card shadow-cute"
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
            Buy, sell and exchange requests, plus when someone accepts and you can connect.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 flex items-center justify-between">
          <Badge variant="secondary" className="rounded-full px-3 py-1">
            {unreadCount} unread
          </Badge>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" className="rounded-full" onClick={() => void handleMarkAllRead()}>
              Mark all read
            </Button>
            <Button variant="outline" size="sm" className="rounded-full" onClick={() => void loadNotifications()}>
              <RefreshCcw className={cn("size-4", loading && "animate-spin")} /> Refresh
            </Button>
          </div>
        </div>

        <div className="mt-5 max-h-[calc(100vh-220px)] space-y-3 overflow-y-auto pb-8">
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

              {isIncomingPending(notification) ? (
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    className="rounded-full"
                    onClick={() => void handleRespond(notification, "accept")}
                    disabled={actingId === notification.id}
                  >
                    <Check className="size-4" /> Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => void handleRespond(notification, "reject")}
                    disabled={actingId === notification.id}
                  >
                    <X className="size-4" /> Decline
                  </Button>
                </div>
              ) : null}

              {isReadyToPay(notification) && notification.requestId ? (
                <Button
                  size="sm"
                  className="mt-3 rounded-full"
                  onClick={() => void goToConnect(notification.requestId!)}
                >
                  <CreditCard className="size-4" /> Connect & pay ₹5
                </Button>
              ) : null}

              {notification.type === "request_accepted" && notification.contactUnlocked ? (
                <Badge variant="secondary" className="mt-3 rounded-full px-3 py-1 text-xs">
                  Contact unlocked
                </Badge>
              ) : null}

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
