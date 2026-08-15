import { useEffect, useState } from "react";
import { useLocation, Redirect } from "wouter";
import {
  useGetMe,
  useListPendingFarms,
  getListPendingFarmsQueryKey,
  useVerifyFarm,
  useLogout,
  useListDeliveryGroups,
  getListDeliveryGroupsQueryKey,
  useUpdateDeliveryStatus,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, LogOut, Check, X, Truck, MapPin, Phone, Package, Copy, ExternalLink } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatDate, formatCurrency } from "@/lib/format";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800 border-yellow-300",
  CONFIRMED: "bg-blue-100 text-blue-800 border-blue-300",
  DISPATCHED: "bg-purple-100 text-purple-800 border-purple-300",
  DELIVERED: "bg-green-100 text-green-800 border-green-300",
  CANCELLED: "bg-red-100 text-red-800 border-red-300",
  PAID: "bg-green-100 text-green-800 border-green-300",
  COD: "bg-amber-100 text-amber-800 border-amber-300",
  AWAITING_PICKUP: "bg-purple-100 text-purple-800 border-purple-300",
  COMPLETED: "bg-green-100 text-green-800 border-green-300",
};

const DELIVERY_STATUSES = ["PENDING", "CONFIRMED", "DISPATCHED", "DELIVERED", "CANCELLED"];

type OrderGroup = {
  groupKey: string;
  totalCrates: number;
  orderCount: number;
  label: string;
  centerLat: number | null;
  centerLng: number | null;
  orders: {
    orderCode: string;
    buyerName: string;
    buyerPhone: string;
    quantityCrates: number;
    status: string;
    totalNgn: number;
    payMethod: string;
    locationLabel: string | null;
  }[];
  driverLinks: { orderCode: string; url: string; buyerName: string }[];
};

export default function Admin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: user, isLoading: userLoading } = useGetMe({
    query: { retry: false, queryKey: ["/api/auth/me"] },
  });

  const { data: pendingFarms, isLoading: farmsLoading } = useListPendingFarms({
    query: { enabled: user?.role === "ADMIN", queryKey: getListPendingFarmsQueryKey() },
  });

  const { data: deliveryGroups, isLoading: groupsLoading } = useListDeliveryGroups({
    query: { enabled: user?.role === "ADMIN", queryKey: getListDeliveryGroupsQueryKey() },
  });

  const [orderGroups, setOrderGroups] = useState<OrderGroup[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [dispatching, setDispatching] = useState<string | null>(null);
  const [pickupLabel, setPickupLabel] = useState<Record<string, string>>({});
  const [pickupWindow, setPickupWindow] = useState<Record<string, string>>({});

  async function loadOrderGroups() {
    setOrdersLoading(true);
    try {
      const res = await fetch("/api/admin/order-groups", { credentials: "include" });
      if (!res.ok) throw new Error("failed");
      setOrderGroups(await res.json());
    } catch {
      setOrderGroups([]);
    } finally {
      setOrdersLoading(false);
    }
  }

  useEffect(() => {
    if (user?.role === "ADMIN") void loadOrderGroups();
  }, [user?.role]);

  const logout = useLogout();
  const verifyFarm = useVerifyFarm();
  const updateStatus = useUpdateDeliveryStatus();

  if (userLoading)
    return (
      <div className="p-12 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );

  if (!user || user.role !== "ADMIN") {
    return <Redirect to="/login" />;
  }

  function handleLogout() {
    logout.mutate(undefined, {
      onSuccess: () => {
        queryClient.setQueryData(["/api/auth/me"], null);
        setLocation("/");
      },
    });
  }

  function handleVerify(farmCode: string, verified: boolean) {
    verifyFarm.mutate(
      { farmCode, data: { verified } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPendingFarmsQueryKey() });
          toast({ title: verified ? "Farm approved" : "Farm rejected" });
        },
      }
    );
  }

  function handleStatusChange(id: number, status: string) {
    updateStatus.mutate(
      {
        id,
        data: {
          status: status as "PENDING" | "CONFIRMED" | "DISPATCHED" | "DELIVERED" | "CANCELLED",
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListDeliveryGroupsQueryKey() });
          toast({ title: `Request updated to ${status}` });
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: "Update failed",
            description: "Could not update the delivery status.",
          });
        },
      }
    );
  }

  async function dispatchGroup(groupKey: string) {
    setDispatching(groupKey);
    try {
      const res = await fetch("/api/admin/order-groups/dispatch", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupKey,
          pickupPointLabel: pickupLabel[groupKey] || undefined,
          pickupWindow: pickupWindow[groupKey] || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Dispatch failed");
      toast({ title: `Dispatched ${body.updated} order(s)` });
      await loadOrderGroups();
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Dispatch failed",
        description: e instanceof Error ? e.message : "Try again",
      });
    } finally {
      setDispatching(null);
    }
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied" });
    } catch {
      window.prompt("Copy:", text);
    }
  }

  const totalDeliveryRequests = deliveryGroups?.reduce((sum, g) => sum + g.requests.length, 0) ?? 0;
  const totalCratesRequested = deliveryGroups?.reduce((sum, g) => sum + g.totalCrates, 0) ?? 0;

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Admin Operations</h1>
          <p className="text-muted-foreground">
            Farms · interest clusters · paid order truck groups
          </p>
        </div>
        <Button variant="outline" onClick={handleLogout}>
          <LogOut className="w-4 h-4 mr-2" /> Logout
        </Button>
      </div>

      <Tabs defaultValue="orders">
        <TabsList className="mb-6 flex flex-wrap h-auto gap-1">
          <TabsTrigger value="orders">
            <Truck className="w-4 h-4 mr-2" /> Paid / COD orders
            {orderGroups.length > 0 && (
              <Badge className="ml-2 bg-primary text-primary-foreground text-xs px-1.5 py-0">
                {orderGroups.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="verifications">
            Farm Verifications
            {(pendingFarms?.length ?? 0) > 0 && (
              <Badge className="ml-2 bg-primary text-primary-foreground text-xs px-1.5 py-0">
                {pendingFarms!.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="logistics">
            Interest requests
            {totalDeliveryRequests > 0 && (
              <Badge className="ml-2 bg-primary text-primary-foreground text-xs px-1.5 py-0">
                {totalDeliveryRequests}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Paid order geo groups — main launch ops */}
        <TabsContent value="orders">
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-muted-foreground">
              GPS clusters ready for one truck. Set pickup point → Dispatch → copy driver links.
            </p>
            <Button variant="outline" size="sm" onClick={() => void loadOrderGroups()}>
              Refresh
            </Button>
          </div>

          {ordersLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : orderGroups.length === 0 ? (
            <div className="text-center py-20 bg-card rounded-lg border">
              <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No active paid / COD orders</h3>
              <p className="text-muted-foreground mt-1 text-sm">
                When buyers checkout with a pin, geo groups show up here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {orderGroups.map((g) => (
                <Card key={g.groupKey}>
                  <CardHeader className="pb-3 bg-muted/30">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-primary" />
                          {g.label}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {g.orderCount} order(s) · {g.totalCrates} crates
                          {g.centerLat != null && g.centerLng != null
                            ? ` · ${g.centerLat.toFixed(4)}, ${g.centerLng.toFixed(4)}`
                            : ""}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-4">
                    <div className="space-y-2">
                      {g.orders.map((o) => (
                        <div
                          key={o.orderCode}
                          className="flex flex-wrap items-center justify-between gap-2 border rounded-lg p-3 text-sm"
                        >
                          <div>
                            <span className="font-mono text-xs text-muted-foreground">
                              {o.orderCode}
                            </span>
                            <div className="font-semibold">
                              {o.buyerName} · {o.buyerPhone}
                            </div>
                            <div className="text-muted-foreground">
                              {o.quantityCrates} crates · {formatCurrency(o.totalNgn)} ·{" "}
                              {o.payMethod}
                            </div>
                          </div>
                          <Badge className={`border ${STATUS_COLORS[o.status] || ""}`}>
                            {o.status}
                          </Badge>
                        </div>
                      ))}
                    </div>

                    <div className="grid sm:grid-cols-2 gap-2">
                      <Input
                        placeholder="Pickup point (e.g. Wetheral junction bus stop)"
                        value={pickupLabel[g.groupKey] || ""}
                        onChange={(e) =>
                          setPickupLabel((s) => ({ ...s, [g.groupKey]: e.target.value }))
                        }
                      />
                      <Input
                        placeholder="Window (e.g. Sat 2–4pm)"
                        value={pickupWindow[g.groupKey] || ""}
                        onChange={(e) =>
                          setPickupWindow((s) => ({ ...s, [g.groupKey]: e.target.value }))
                        }
                      />
                    </div>

                    <Button
                      onClick={() => void dispatchGroup(g.groupKey)}
                      disabled={dispatching === g.groupKey}
                    >
                      {dispatching === g.groupKey ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Dispatching…
                        </>
                      ) : (
                        <>
                          <Truck className="w-4 h-4 mr-2" /> Dispatch this group
                        </>
                      )}
                    </Button>

                    {g.driverLinks.length > 0 && (
                      <div className="border-t pt-3 space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase">
                          Driver links (send on WhatsApp)
                        </p>
                        {g.driverLinks.map((d) => (
                          <div
                            key={d.orderCode}
                            className="flex flex-wrap items-center gap-2 text-sm"
                          >
                            <span className="font-medium">{d.buyerName}</span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void copyText(d.url)}
                            >
                              <Copy className="w-3 h-3 mr-1" /> Copy
                            </Button>
                            <a
                              href={d.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary text-xs inline-flex items-center gap-1"
                            >
                              Open <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="verifications">
          <Card>
            <CardHeader>
              <CardTitle>Pending Verifications</CardTitle>
              <CardDescription>Review and approve new farm registrations</CardDescription>
            </CardHeader>
            <CardContent>
              {farmsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : pendingFarms?.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No pending farms to review.
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingFarms?.map((farm) => (
                    <div
                      key={farm.id}
                      className="flex flex-col md:flex-row justify-between md:items-center p-4 border rounded-lg gap-4 bg-card"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-lg">{farm.farmName}</h3>
                          <Badge variant="outline" className="font-mono text-xs">
                            {farm.farmCode}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground mb-2">
                          {farm.lga}, {farm.state} &bull; Registered {formatDate(farm.createdAt)}
                        </div>
                        <div className="text-sm">
                          <span className="font-medium">Owner:</span> {farm.ownerName} (
                          {farm.ownerPhone})
                        </div>
                        {farm.description && (
                          <p className="text-sm mt-2 p-2 bg-muted rounded">{farm.description}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleVerify(farm.farmCode, false)}
                          disabled={verifyFarm.isPending}
                        >
                          <X className="w-4 h-4 mr-1" /> Reject
                        </Button>
                        <Button
                          onClick={() => handleVerify(farm.farmCode, true)}
                          disabled={verifyFarm.isPending}
                        >
                          <Check className="w-4 h-4 mr-1" /> Approve
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logistics">
          {groupsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : !deliveryGroups || deliveryGroups.length === 0 ? (
            <div className="text-center py-20 bg-card rounded-lg border">
              <Truck className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground">No interest requests</h3>
              <p className="mt-1 text-muted-foreground text-sm">
                Legacy delivery-request clusters (pre-checkout). Paid flow uses Paid / COD tab.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                  { label: "Total Requests", value: totalDeliveryRequests },
                  { label: "Total Crates", value: totalCratesRequested },
                  { label: "Groups", value: deliveryGroups.length },
                ].map(({ label, value }) => (
                  <Card key={label}>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold">{value}</div>
                      <div className="text-sm text-muted-foreground">{label}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {deliveryGroups.map((group) => (
                <Card key={group.groupKey} className="overflow-hidden">
                  <CardHeader className="pb-3 bg-muted/30">
                    <div className="flex items-center gap-2 mb-1">
                      <MapPin className="w-4 h-4 text-primary" />
                      <span className="font-bold text-lg">{group.deliveryState}</span>
                      <span className="font-semibold">{group.farmName}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {group.eggSize} · {group.requests.length} buyers · {group.totalCrates} crates
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-3">
                    {group.requests.map((req) => (
                      <div key={req.id} className="border rounded-lg p-4">
                        <div className="flex flex-col sm:flex-row justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold">{req.buyerName}</span>
                              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Phone className="w-3.5 h-3.5" /> {req.buyerPhone}
                              </span>
                              <Badge variant="secondary">{req.quantityCrates} crates</Badge>
                              <Badge className={`text-xs border ${STATUS_COLORS[req.status]}`}>
                                {req.status}
                              </Badge>
                            </div>
                            <p className="text-sm mt-1">
                              {req.streetAddress}, {req.town}, {req.lga}
                            </p>
                          </div>
                          <Select
                            value={req.status}
                            onValueChange={(v) => handleStatusChange(req.id, v)}
                            disabled={updateStatus.isPending}
                          >
                            <SelectTrigger className="text-xs h-8 w-full sm:w-44">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {DELIVERY_STATUSES.map((s) => (
                                <SelectItem key={s} value={s} className="text-xs">
                                  {s}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
