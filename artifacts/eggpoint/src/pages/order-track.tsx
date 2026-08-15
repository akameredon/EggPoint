import { useEffect, useState } from "react";
import { useRoute, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, Package, MapPin, Truck } from "lucide-react";
import { formatCurrency } from "@/lib/format";

type OrderPayload = {
  order: {
    orderCode: string;
    status: string;
    quantityCrates: number;
    totalNgn: number;
    unitPriceNgn: number;
    payMethod: string;
    locationLabel: string | null;
    pickupPointLabel: string | null;
    pickupWindow: string | null;
    driverConfirmedAt: string | null;
    buyerConfirmedAt: string | null;
    buyerToken: string;
  };
  farmName?: string;
  eggSize?: string;
};

export default function OrderTrack() {
  const [, params] = useRoute("/order/:buyerToken");
  const search = useSearch();
  const token = params?.buyerToken || "";
  const { toast } = useToast();
  const [data, setData] = useState<OrderPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [note, setNote] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/by-token/${token}`, { credentials: "include" });
      if (!res.ok) throw new Error("not found");
      setData(await res.json());
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    void load();
  }, [token]);

  // After Flutterwave redirect: ?payment=return&transaction_id=...
  useEffect(() => {
    if (!token || !data) return;
    const qs = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
    if (qs.get("payment") !== "return") return;
    const transactionId = qs.get("transaction_id") || qs.get("transactionId");
    const txRef = qs.get("tx_ref") || qs.get("txRef") || undefined;
    if (!transactionId || data.order.status !== "PENDING_PAYMENT") return;

    setVerifying(true);
    fetch("/api/orders/verify-payment", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactionId, txRef, buyerToken: token }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error("verify failed");
        toast({ title: "Payment confirmed" });
        await load();
      })
      .catch(() => {
        toast({
          variant: "destructive",
          title: "Could not verify payment",
          description: "If you paid, refresh in a minute or contact support with your order code.",
        });
      })
      .finally(() => setVerifying(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, data?.order.status, search]);

  async function confirmPickup() {
    setConfirming(true);
    try {
      const res = await fetch(`/api/orders/by-token/${token}/confirm-pickup`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: note || undefined }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed");
      toast({
        title: body.dualComplete ? "Complete — both sides confirmed" : "You confirmed pickup",
      });
      await load();
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Could not confirm",
        description: e instanceof Error ? e.message : "Try again",
      });
    } finally {
      setConfirming(false);
    }
  }

  if (loading) {
    return (
      <div className="p-16 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <h1 className="text-xl font-bold mb-2">Order not found</h1>
        <p className="text-muted-foreground">Check the link from your SMS / payment receipt.</p>
      </div>
    );
  }

  const o = data.order;
  const dual = Boolean(o.driverConfirmedAt && o.buyerConfirmedAt);

  return (
    <div className="max-w-lg mx-auto px-4 py-10 space-y-4">
      <div>
        <p className="text-sm text-primary font-medium flex items-center gap-2">
          <Package className="w-4 h-4" /> Order tracking
        </p>
        <h1 className="text-2xl font-bold">{o.orderCode}</h1>
        <p className="text-muted-foreground text-sm">
          {data.farmName} {data.eggSize ? `· ${data.eggSize}` : ""}
        </p>
      </div>

      {verifying && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Verifying payment…
        </div>
      )}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Status</span>
            <Badge>{o.status}</Badge>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Crates</span>
            <span className="font-medium">{o.quantityCrates}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total</span>
            <span className="font-bold">{formatCurrency(o.totalNgn)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Pay</span>
            <span>{o.payMethod}</span>
          </div>
          {o.locationLabel && (
            <div className="text-sm flex gap-2">
              <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <span>{o.locationLabel}</span>
            </div>
          )}
          {(o.pickupPointLabel || o.pickupWindow) && (
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-sm">
              <div className="font-medium flex items-center gap-2 mb-1">
                <Truck className="w-4 h-4" /> Pickup point
              </div>
              {o.pickupPointLabel && <p>{o.pickupPointLabel}</p>}
              {o.pickupWindow && (
                <p className="text-muted-foreground">Window: {o.pickupWindow}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Dual confirmation</CardTitle>
          <CardDescription>
            Driver marks handover. You mark received. Order completes only when both confirm — no
            one-sided disputes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            {o.driverConfirmedAt ? (
              <CheckCircle2 className="w-4 h-4 text-green-600" />
            ) : (
              <span className="w-4 h-4 rounded-full border" />
            )}
            Driver handover {o.driverConfirmedAt ? "confirmed" : "pending"}
          </div>
          <div className="flex items-center gap-2 text-sm">
            {o.buyerConfirmedAt ? (
              <CheckCircle2 className="w-4 h-4 text-green-600" />
            ) : (
              <span className="w-4 h-4 rounded-full border" />
            )}
            You received {o.buyerConfirmedAt ? "confirmed" : "pending"}
          </div>

          {dual ? (
            <p className="text-sm font-medium text-green-700 bg-green-50 rounded-lg p-3">
              Order complete. Thank you.
            </p>
          ) : !o.buyerConfirmedAt && o.status !== "CANCELLED" && o.status !== "PENDING_PAYMENT" ? (
            <div className="space-y-2">
              <Textarea
                placeholder="Optional note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
              />
              <Button className="w-full" onClick={confirmPickup} disabled={confirming}>
                {confirming ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…
                  </>
                ) : (
                  "I have picked up my eggs"
                )}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
