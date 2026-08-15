import { useCallback, useEffect, useRef, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useListListings, getListListingsQueryKey, useCreateDeliveryRequest } from "@workspace/api-client-react";
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

/**
 * Minimal form — no long address boxes.
 * Location comes from GPS or a one-tap map pin.
 */
const formSchema = z.object({
  buyerName: z.string().min(2, "Full name is required"),
  buyerPhone: z.string().min(10, "Valid phone number required"),
  quantityCrates: z.coerce.number().int().min(1, "At least 1 crate required"),
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
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });
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
  const [submitted, setSubmitted] = useState(false);
  const [submittedRef, setSubmittedRef] = useState<number | null>(null);

  const [loc, setLoc] = useState<ResolvedLocation | null>(null);
  const [locLoading, setLocLoading] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [mapDraft, setMapDraft] = useState<{ lat: number; lng: number } | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<{
    map: { setView: (c: [number, number], z: number) => void; on: (e: string, fn: (ev: { latlng: { lat: number; lng: number } }) => void) => void; remove: () => void };
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
    ? { eggSize: listing.eggSize, pricePerCrate: listing.pricePerCrate, collectionDate: listing.collectionDate }
    : null;

  const createRequest = useCreateDeliveryRequest();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      buyerName: "",
      buyerPhone: "",
      quantityCrates: 1,
      notes: "",
    },
  });

  const applyCoords = useCallback(async (lat: number, lng: number, source: "gps" | "map") => {
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
        description: geo.label || "We locked your pin for the delivery truck.",
      });
    } finally {
      setLocLoading(false);
    }
  }, [toast]);

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
      (pos) => {
        void applyCoords(pos.coords.latitude, pos.coords.longitude, "gps");
      },
      (err) => {
        setLocLoading(false);
        toast({
          variant: "destructive",
          title: "Could not get GPS",
          description: err.message || "Open the map and tap your shop location.",
        });
        setMapOpen(true);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  // Lightweight Leaflet map via CDN (no package.json change required)
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
          marker: (c: [number, number]) => { addTo: (m: unknown) => void; setLatLng: (c: [number, number]) => void; remove: () => void };
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

      // Default centre: Owerri, Imo (campaign HQ area) — user can pan/tap
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
        if (marker) {
          marker.setLatLng([lat, lng]);
        } else if (w.L) {
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

  function onSubmit(values: FormValues) {
    if (!loc) {
      toast({
        variant: "destructive",
        title: "Location needed",
        description: "Tap “Use my location” or pin your shop on the map. No long address form.",
      });
      return;
    }

    createRequest.mutate(
      {
        data: {
          batchCode,
          buyerName: values.buyerName,
          buyerPhone: values.buyerPhone,
          quantityCrates: values.quantityCrates,
          notes: values.notes || undefined,
          latitude: loc.latitude,
          longitude: loc.longitude,
          locationSource: loc.source,
          locationLabel: loc.label,
          state: loc.state,
          lga: loc.lga,
          town: loc.town,
          streetAddress: loc.streetAddress || loc.label,
        } as Parameters<typeof createRequest.mutate>[0]["data"],
      },
      {
        onSuccess: (data) => {
          setSubmittedRef(data.id);
          setSubmitted(true);
          toast({ title: "Delivery request submitted!" });
        },
        onError: (err) => {
          toast({
            variant: "destructive",
            title: "Could not submit request",
            description: (err as { error?: string }).error || "Please try again.",
          });
        },
      }
    );
  }

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
        </div>
        <h1 className="text-2xl font-bold mb-2">Request Submitted</h1>
        <p className="text-muted-foreground mb-2">
          Your delivery request #{submittedRef} is in. We group buyers by GPS pin so one truck
          serves a nearby cluster — you pick up at a spot close to your area.
        </p>
        <p className="text-sm text-muted-foreground mb-8">
          Keep your phone on. The team will confirm the pickup point and time.
        </p>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={() => setLocation("/suppliers")}>
            Browse More Farms
          </Button>
          <Button onClick={() => setLocation(`/suppliers/${farm?.farmCode ?? ""}`)}>
            Back to Farm Profile
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-primary text-sm font-medium mb-2">
          <Truck className="w-4 h-4" />
          Group Delivery Request
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-1">Quick request — no long forms</h1>
        <p className="text-muted-foreground">
          Name, phone, crates, and your pin. GPS or map — we cluster nearby buyers so one truck
          serves the route.
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
          <CardDescription>
            One tap GPS if you are at the shop. Not there? Open the map and tap the exact spot.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              className="flex-1 h-12"
              onClick={useGps}
              disabled={locLoading}
            >
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
              <div className="font-medium text-foreground flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                {loc.source === "gps" ? "GPS locked" : "Map pin saved"}
              </div>
              <p className="text-muted-foreground mt-1 leading-relaxed">{loc.label}</p>
              <p className="font-mono text-xs text-muted-foreground mt-1">
                {loc.latitude.toFixed(6)}, {loc.longitude.toFixed(6)}
              </p>
            </div>
          ) : (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
              No pin yet. Use GPS or the map — we do not ask you to type street, LGA, town one by
              one.
            </p>
          )}
        </CardContent>
      </Card>

      {mapOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
            <div>
              <p className="font-semibold">Tap your shop / usual spot</p>
              <p className="text-xs text-muted-foreground">One tap sets the pin for the truck cluster</p>
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
          <CardTitle>Almost done</CardTitle>
          <CardDescription>Only the essentials — nothing else to fill.</CardDescription>
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
                      <FormLabel>Phone Number</FormLabel>
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
                    <FormLabel>How many crates?</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} {...field} />
                    </FormControl>
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
                      <Textarea
                        placeholder="Anything the driver should know"
                        rows={2}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={createRequest.isPending || !loc}
              >
                {createRequest.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting…
                  </>
                ) : (
                  <>
                    <Truck className="w-4 h-4 mr-2" /> Submit delivery request
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
