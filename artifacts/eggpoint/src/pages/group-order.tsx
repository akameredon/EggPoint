import { useCallback, useEffect, useRef, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useListListings, getListListingsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Truck,
  MapPin,
  CheckCircle2,
  Package,
  Navigation,
  Crosshair,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";

const formSchema = z.object({
  buyerName: z.string().min(2, "Full name is required"),
  buyerPhone: z.string().min(10, "Valid phone number required"),
  quantityCrates: z.coerce.number().int().min(1, "At least 1 crate required"),
  payMethod: z.enum(["ONLINE", "COD"]),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

type ResolvedLocation = {
  latitude: number;
  longitude: number;
  source: "gps" | "map";
  label: string;
  state?: string;
  lga?: string;
  town?: string;
  streetAddress?: string;
};

async function reverseGeocode(lat: number, lng: number): Promise<Partial<ResolvedLocation>> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return {};
    const data = (await res.json()) as {
      display_name?: string;
      address?: Record<string, string>;
    };
    const a = data.address || {};
    const street =
      [a.house_number, a.road || a.pedestrian || a.path].filter(Boolean).join(" ") ||
      a.neighbourhood ||
      a.suburb;
    return {
      label: data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      state: a.state || a.region,
      lga: a.county || a.municipality || a.city_district,
      town: a.city || a.town || a.village || a.suburb,
      streetAddress: street,
    };
  } catch {
    return { label: `${lat.toFixed(5)}, ${lng.toFixed(5)}` };
  }
}

export default function GroupOrder() {
  const [, params] = useRoute("/group-order/:batchCode");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ orderCode: string; trackUrl: string; payMethod: string } | null>(
    null
  );

  const [loc, setLoc] = useState<ResolvedLocation | null>(null);
  const [locLoading, setLocLoading] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [mapDraft, setMapDraft] = useState<{ lat: number; lng: number } | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<{
    map: {
      setView: (c: [number, number], z: number) => void;
      on: (e: string, fn: (ev: { latlng: { lat: number; lng: number } }) => void) => void;
      remove: () => void;
    };
    marker: { setLatLng: (c: [number, number]) => void; remove: () => void } | null;
  } | null>(null);

  const batchCode = params?.batchCode || "";

  const { data: listings } = useListListings(undefined, {
    query: { enabled: !!batchCode, queryKey: getListListingsQueryKey(undefined) },
  });

  const listing = listings?.find((l) => l.batchCode === batchCode);
  const farm = listing
    ? { farmName: listing.farmName, lga: listing.lga, state: listing.state, farmCode: listing.farmCode }
    : null;
  const batch = listing
    ? {
        eggSize: listing.eggSize,
        pricePerCrate: listing.pricePerCrate,
        collectionDate: listing.collectionDate,
      }
    : null;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      buyerName: "",
      buyerPhone: "",
      quantityCrates: 1,
      payMethod: "ONLINE",
      notes: "",
    },
  });

  const qty = form.watch("quantityCrates") || 1;
  const estimate =
    batch && Number.isFinite(Number(batch.pricePerCrate))
      ? Number(batch.pricePerCrate) * Number(qty)
      : null;

  const applyCoords = useCallback(
    async (lat: number, lng: number, source: "gps" | "map") => {
      setLocLoading(true);
      try {
        const geo = await reverseGeocode(lat, lng);
        setLoc({
          latitude: lat,
          longitude: lng,
          source,
          label: geo.label || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
          state: geo.state,
          lga: geo.lga,
          town: geo.town,
          streetAddress: geo.streetAddress,
        });
        toast({
          title: source === "gps" ? "Location captured" : "Pin saved",
          description: geo.label || "Pin locked for truck clustering.",
        });
      } finally {
        setLocLoading(false);
      }
    },
    [toast]
  );

  function useGps() {
    if (!navigator.geolocation) {
      toast({
        variant: "destructive",
        title: "GPS not available",
        description: "Use the map pin instead.",
      });
      setMapOpen(true);
      return;
    }
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => void applyCoords(pos.coords.latitude, pos.coords.longitude, "gps"),
      (err) => {
        setLocLoading(false);
        toast({
          variant: "destructive",
          title: "Could not get GPS",
          description: err.message || "Open the map and tap your shop.",
        });
        setMapOpen(true);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  useEffect(() => {
    if (!mapOpen) return;
    let cancelled = false;

    async function bootMap() {
      const w = window as unknown as {
        L?: {
          map: (el: HTMLElement) => {
            setView: (c: [number, number], z: number) => void;
            on: (e: string, fn: (ev: { latlng: { lat: number; lng: number } }) => void) => void;
            remove: () => void;
            addLayer: (layer: unknown) => void;
          };
          tileLayer: (url: string, opts: Record<string, unknown>) => { addTo: (m: unknown) => void };
          marker: (c: [number, number]) => {
            addTo: (m: unknown) => void;
            setLatLng: (c: [number, number]) => void;
            remove: () => void;
          };
        };
      };

      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      if (!w.L) {
        await new Promise<void>((resolve, reject) => {
          const existing = document.getElementById("leaflet-js");
          if (existing) {
            existing.addEventListener("load", () => resolve());
            return;
          }
          const script = document.createElement("script");
          script.id = "leaflet-js";
          script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Failed to load map"));
          document.body.appendChild(script);
        });
      }

      if (cancelled || !mapContainerRef.current || !w.L) return;

      const startLat = loc?.latitude ?? mapDraft?.lat ?? 5.484;
      const startLng = loc?.longitude ?? mapDraft?.lng ?? 7.035;

      const map = w.L.map(mapContainerRef.current);
      map.setView([startLat, startLng], 15);
      w.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      let marker: ReturnType<typeof w.L.marker> | null = null;
      if (loc || mapDraft) {
        marker = w.L.marker([startLat, startLng]);
        marker.addTo(map);
      }

      map.on("click", (ev) => {
        const { lat, lng } = ev.latlng;
        setMapDraft({ lat, lng });
        if (marker) marker.setLatLng([lat, lng]);
        else if (w.L) {
          marker = w.L.marker([lat, lng]);
          marker.addTo(map);
        }
      });

      leafletMapRef.current = { map, marker };
    }

    void bootMap().catch(() => {
      toast({
        variant: "destructive",
        title: "Map failed to load",
        description: "Check your connection and try again.",
      });
    });

    return () => {
      cancelled = true;
      if (leafletMapRef.current) {
        try {
          leafletMapRef.current.map.remove();
        } catch {
          /* ignore */
        }
        leafletMapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapOpen]);

  function confirmMapPin() {
    if (!mapDraft && !loc) {
      toast({
        variant: "destructive",
        title: "Tap the map",
        description: "Tap once on your shop or usual pickup spot.",
      });
      return;
    }
    const pin = mapDraft || (loc ? { lat: loc.latitude, lng: loc.longitude } : null);
    if (!pin) return;
    setMapOpen(false);
    void applyCoords(pin.lat, pin.lng, "map");
  }

  async function onSubmit(values: FormValues) {
    if (!loc) {
      toast({
        variant: "destructive",
        title: "Location needed",
        description: "Use GPS or pin on map first.",
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchCode,
          buyerName: values.buyerName,
          buyerPhone: values.buyerPhone,
          quantityCrates: values.quantityCrates,
          payMethod: values.payMethod,
          notes: values.notes || undefined,
          latitude: loc.latitude,
          longitude: loc.longitude,
          locationSource: loc.source,
          locationLabel: loc.label,
          state: loc.state,
          lga: loc.lga,
          town: loc.town,
          streetAddress: loc.streetAddress || loc.label,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || "Could not create order");
      }

      if (body.paymentLink) {
        window.location.href = body.paymentLink as string;
        return;
      }

      setDone({
        orderCode: body.order.orderCode,
        trackUrl: body.trackUrl,
        payMethod: values.payMethod,
      });
      toast({ title: "Order placed" });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Order failed",
        description: e instanceof Error ? e.message : "Try again",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
        </div>
        <h1 className="text-2xl font-bold mb-2">Order {done.orderCode}</h1>
        <p className="text-muted-foreground mb-4">
          {done.payMethod === "COD"
            ? "Pay on delivery / pickup. Save your tracking link."
            : "Order recorded."}
        </p>
        <Button className="w-full mb-3" onClick={() => setLocation(done.trackUrl.replace(/^https?:\/\/[^/]+/, "") || "/")}>
          Open tracking page
        </Button>
        <Button variant="outline" onClick={() => setLocation("/suppliers")}>
          Browse more farms
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-primary text-sm font-medium mb-2">
          <Truck className="w-4 h-4" />
          Order + group delivery
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-1">Pay · pin · pickup</h1>
        <p className="text-muted-foreground">
          GPS or map pin. We cluster nearby buyers for one truck. Dual confirm at handover.
        </p>
      </div>

      {batch && farm && (
        <Card className="mb-6 border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Package className="w-4 h-4 text-primary" />
                  <span className="font-bold">{farm.farmName}</span>
                  <Badge variant="secondary">{batch.eggSize}</Badge>
                </div>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="w-3.5 h-3.5" />
                  {farm.lga}, {farm.state}
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-lg">
                  {formatCurrency(batch.pricePerCrate)}
                  <span className="text-sm font-normal text-muted-foreground"> / crate</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  Collection: {formatDate(batch.collectionDate)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Crosshair className="w-4 h-4 text-primary" />
            Your location (required)
          </CardTitle>
          <CardDescription>One tap GPS, or pin your shop on the map. No long form.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <Button type="button" className="flex-1 h-12" onClick={useGps} disabled={locLoading}>
              {locLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Getting GPS…
                </>
              ) : (
                <>
                  <Navigation className="w-4 h-4 mr-2" /> Use my location
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1 h-12"
              onClick={() => {
                setMapDraft(loc ? { lat: loc.latitude, lng: loc.longitude } : null);
                setMapOpen(true);
              }}
            >
              <MapPin className="w-4 h-4 mr-2" /> Pin on map
            </Button>
          </div>
          {loc ? (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
              <div className="font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                {loc.source === "gps" ? "GPS locked" : "Map pin saved"}
              </div>
              <p className="text-muted-foreground mt-1">{loc.label}</p>
            </div>
          ) : (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
              Pin required before checkout.
            </p>
          )}
        </CardContent>
      </Card>

      {mapOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
            <div>
              <p className="font-semibold">Tap your shop / usual spot</p>
              <p className="text-xs text-muted-foreground">One tap sets the cluster pin</p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setMapOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={confirmMapPin}>
                Save pin
              </Button>
            </div>
          </div>
          <div ref={mapContainerRef} className="flex-1 w-full min-h-0" />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Checkout</CardTitle>
          <CardDescription>Name, phone, crates, pay method — that is all.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="buyerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Emeka Okafor" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="buyerPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="08012345678" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="quantityCrates"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Crates</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {estimate != null && (
                <p className="text-sm font-semibold">
                  Total: {formatCurrency(estimate)}
                </p>
              )}

              <FormField
                control={form.control}
                name="payMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment</FormLabel>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant={field.value === "ONLINE" ? "default" : "outline"}
                        className="h-12"
                        onClick={() => field.onChange("ONLINE")}
                      >
                        Pay online
                      </Button>
                      <Button
                        type="button"
                        variant={field.value === "COD" ? "default" : "outline"}
                        className="h-12"
                        onClick={() => field.onChange("COD")}
                      >
                        Pay on delivery
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Note <span className="text-muted-foreground font-normal">(optional)</span>
                    </FormLabel>
                    <FormControl>
                      <Textarea rows={2} placeholder="Anything for the driver" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" size="lg" disabled={submitting || !loc}>
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing…
                  </>
                ) : form.watch("payMethod") === "ONLINE" ? (
                  "Pay & place order"
                ) : (
                  "Place COD order"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
