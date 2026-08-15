import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, MapPin, Phone } from "lucide-react";
import { formatCurrency } from "@/lib/format";

type DriverStop = {
  orderCode: string;
  buyerName: string;
  buyerPhone: string;
  quantityCrates: number;
  locationLabel: string | null;
  latitude: number | null;
  longitude: number | null;
  pickupPointLabel: string | null;
  status: string;
  driverConfirmedAt: string | null;
  buyerConfirmedAt: string | null;
  totalNgn: number;
  payMethod: string;
};

export default function DriverPage() {
  const [, params] = useRoute("/driver/:driverToken");
  const token = params?.driverToken || "";
  const { toast } = useToast();
  const [stop, setStop] = useState<DriverStop | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/driver/${token}`);
      if (!res.ok) throw new Error("missing");
      setStop(await res.json());
    } catch {
      setStop(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) void load();
  }, [token]);

  async function confirmHandover() {
    setSaving(true);
    try {
      const res = await fetch(`/api/orders/driver/${token}/confirm-handover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: note || undefined }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed");
      toast({
        title: body.dualComplete ? "Both confirmed — complete" : "Handover marked",
      });
      await load();
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Could not save",
        description: e instanceof Error ? e.message : "Try again",
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-16 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!stop) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <h1 className="text-xl font-bold">Stop not found</h1>
      </div>
    );
  }

  const maps =
    stop.latitude != null && stop.longitude != null
      ? `https://www.google.com/maps?q=${stop.latitude},${stop.longitude}`
      : null;

  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-4">
      <div>
        <p className="text-sm text-muted-foreground">Driver stop</p>
        <h1 className="text-2xl font-bold">{stop.orderCode}</h1>
        <Badge className="mt-1">{stop.status}</Badge>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3 text-sm">
          <div>
            <p className="text-muted-foreground">Buyer</p>
            <p className="font-semibold text-base">{stop.buyerName}</p>
          </div>
          <a
            href={`tel:${stop.buyerPhone}`}
            className="flex items-center gap-2 text-primary font-medium"
          >
            <Phone className="w-4 h-4" />
            {stop.buyerPhone}
          </a>
          <p>
            <span className="text-muted-foreground">Crates: </span>
            <strong>{stop.quantityCrates}</strong>
          </p>
          <p>
            <span className="text-muted-foreground">Amount: </span>
            <strong>{formatCurrency(stop.totalNgn)}</strong> ({stop.payMethod})
          </p>
          {(stop.pickupPointLabel || stop.locationLabel) && (
            <div className="flex gap-2">
              <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <span>{stop.pickupPointLabel || stop.locationLabel}</span>
            </div>
          )}
          {maps && (
            <a
              href={maps}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex text-primary underline text-sm"
            >
              Open in Maps
            </a>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Confirm handover</CardTitle>
          <CardDescription>
            Mark when you hand eggs to this buyer. They must also confirm on their link.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm space-y-1">
            <p className="flex items-center gap-2">
              {stop.driverConfirmedAt ? (
                <CheckCircle2 className="w-4 h-4 text-green-600" />
              ) : (
                <span className="w-4 h-4 rounded-full border" />
              )}
              Driver {stop.driverConfirmedAt ? "done" : "pending"}
            </p>
            <p className="flex items-center gap-2">
              {stop.buyerConfirmedAt ? (
                <CheckCircle2 className="w-4 h-4 text-green-600" />
              ) : (
                <span className="w-4 h-4 rounded-full border" />
              )}
              Buyer {stop.buyerConfirmedAt ? "done" : "pending"}
            </p>
          </div>

          {!stop.driverConfirmedAt && stop.status !== "CANCELLED" && (
            <>
              <Textarea
                placeholder="Optional note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
              />
              <Button className="w-full h-12" onClick={confirmHandover} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…
                  </>
                ) : (
                  "Handed to buyer"
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
