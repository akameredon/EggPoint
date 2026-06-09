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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, LogOut, Check, X, Truck, MapPin, Phone, Package } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatDate } from "@/lib/format";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800 border-yellow-300",
  CONFIRMED: "bg-blue-100 text-blue-800 border-blue-300",
  DISPATCHED: "bg-purple-100 text-purple-800 border-purple-300",
  DELIVERED: "bg-green-100 text-green-800 border-green-300",
  CANCELLED: "bg-red-100 text-red-800 border-red-300",
};

const DELIVERY_STATUSES = ["PENDING", "CONFIRMED", "DISPATCHED", "DELIVERED", "CANCELLED"];

export default function Admin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: user, isLoading: userLoading } = useGetMe({
    query: { retry: false, queryKey: ["/api/auth/me"] }
  });

  const { data: pendingFarms, isLoading: farmsLoading } = useListPendingFarms({
    query: { enabled: user?.role === "ADMIN", queryKey: getListPendingFarmsQueryKey() }
  });

  const { data: deliveryGroups, isLoading: groupsLoading } = useListDeliveryGroups({
    query: { enabled: user?.role === "ADMIN", queryKey: getListDeliveryGroupsQueryKey() }
  });

  const logout = useLogout();
  const verifyFarm = useVerifyFarm();
  const updateStatus = useUpdateDeliveryStatus();

  if (userLoading) return <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  if (!user || user.role !== "ADMIN") {
    return <Redirect to="/login" />;
  }

  function handleLogout() {
    logout.mutate(undefined, {
      onSuccess: () => {
        queryClient.setQueryData(["/api/auth/me"], null);
        setLocation("/");
      }
    });
  }

  function handleVerify(farmCode: string, verified: boolean) {
    verifyFarm.mutate(
      { farmCode, data: { verified } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPendingFarmsQueryKey() });
          toast({ title: verified ? "Farm approved" : "Farm rejected" });
        }
      }
    );
  }

  function handleStatusChange(id: number, status: string) {
    updateStatus.mutate(
      { id, data: { status: status as "PENDING" | "CONFIRMED" | "DISPATCHED" | "DELIVERED" | "CANCELLED" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListDeliveryGroupsQueryKey() });
          toast({ title: `Request updated to ${status}` });
        },
        onError: () => {
          toast({ variant: "destructive", title: "Update failed", description: "Could not update the delivery status." });
        }
      }
    );
  }

  const totalDeliveryRequests = deliveryGroups?.reduce((sum, g) => sum + g.requests.length, 0) ?? 0;
  const totalCratesRequested = deliveryGroups?.reduce((sum, g) => sum + g.totalCrates, 0) ?? 0;

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Admin Operations</h1>
          <p className="text-muted-foreground">Manage platform access, farm verifications, and logistics</p>
        </div>
        <Button variant="outline" onClick={handleLogout}>
          <LogOut className="w-4 h-4 mr-2" /> Logout
        </Button>
      </div>

      <Tabs defaultValue="verifications">
        <TabsList className="mb-6">
          <TabsTrigger value="verifications">
            Farm Verifications
            {(pendingFarms?.length ?? 0) > 0 && (
              <Badge className="ml-2 bg-primary text-primary-foreground text-xs px-1.5 py-0">
                {pendingFarms!.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="logistics">
            <Truck className="w-4 h-4 mr-2" /> Group Deliveries
            {totalDeliveryRequests > 0 && (
              <Badge className="ml-2 bg-primary text-primary-foreground text-xs px-1.5 py-0">
                {totalDeliveryRequests}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* --- Farm Verifications Tab --- */}
        <TabsContent value="verifications">
          <Card>
            <CardHeader>
              <CardTitle>Pending Verifications</CardTitle>
              <CardDescription>Review and approve new farm registrations</CardDescription>
            </CardHeader>
            <CardContent>
              {farmsLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
              ) : pendingFarms?.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">No pending farms to review.</div>
              ) : (
                <div className="space-y-4">
                  {pendingFarms?.map(farm => (
                    <div key={farm.id} className="flex flex-col md:flex-row justify-between md:items-center p-4 border rounded-lg gap-4 bg-card">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-lg">{farm.farmName}</h3>
                          <Badge variant="outline" className="font-mono text-xs">{farm.farmCode}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground mb-2">
                          {farm.lga}, {farm.state} &bull; Registered {formatDate(farm.createdAt)}
                        </div>
                        <div className="text-sm">
                          <span className="font-medium">Owner:</span> {farm.ownerName} ({farm.ownerPhone})
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

        {/* --- Group Deliveries Tab --- */}
        <TabsContent value="logistics">
          {groupsLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : !deliveryGroups || deliveryGroups.length === 0 ? (
            <div className="text-center py-20 bg-card rounded-lg border">
              <Truck className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground">No delivery requests yet</h3>
              <p className="mt-1 text-muted-foreground">When buyers request coordinated delivery, their grouped orders will appear here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary bar */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                  { label: "Total Requests", value: totalDeliveryRequests },
                  { label: "Total Crates", value: totalCratesRequested },
                  { label: "State Groups", value: deliveryGroups.length },
                ].map(({ label, value }) => (
                  <Card key={label}>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold">{value}</div>
                      <div className="text-sm text-muted-foreground">{label}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {deliveryGroups.map(group => (
                <Card key={group.groupKey} className="overflow-hidden">
                  <CardHeader className="pb-3 bg-muted/30">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <MapPin className="w-4 h-4 text-primary" />
                          <span className="font-bold text-lg">{group.deliveryState}</span>
                          <span className="text-muted-foreground">→</span>
                          <span className="font-semibold">{group.farmName}</span>
                          <Badge variant="secondary" className="font-mono text-xs">{group.farmCode}</Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Package className="w-3.5 h-3.5" />
                            {group.eggSize} eggs &bull; {group.requests.length} buyer{group.requests.length !== 1 ? "s" : ""} &bull; {group.totalCrates} crates total
                          </span>
                          <span>Collection: {formatDate(group.collectionDate)}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Farm location: {group.farmLga}, {group.farmState}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="space-y-3">
                      {group.requests.map((req, idx) => (
                        <div
                          key={req.id}
                          className="border rounded-lg p-4 bg-card"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <span className="text-xs text-muted-foreground font-mono">#{idx + 1}</span>
                                <span className="font-bold">{req.buyerName}</span>
                                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                                  <Phone className="w-3.5 h-3.5" /> {req.buyerPhone}
                                </span>
                                <Badge variant="secondary">{req.quantityCrates} crates</Badge>
                                <Badge className={`text-xs border ${STATUS_COLORS[req.status]}`}>
                                  {req.status}
                                </Badge>
                              </div>

                              {/* Full address breakdown */}
                              <div className="text-sm space-y-0.5">
                                <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                                  <span className="text-muted-foreground">State:</span>
                                  <span className="font-medium">{req.state}</span>
                                  <span className="text-muted-foreground">LGA:</span>
                                  <span className="font-medium">{req.lga}</span>
                                  <span className="text-muted-foreground">Town:</span>
                                  <span className="font-medium">{req.town}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Street: </span>
                                  <span className="font-medium">{req.streetAddress}</span>
                                </div>
                                {req.marketArea && (
                                  <div>
                                    <span className="text-muted-foreground">Market/Area: </span>
                                    <span className="font-medium">{req.marketArea}</span>
                                  </div>
                                )}
                                {req.village && (
                                  <div>
                                    <span className="text-muted-foreground">Village: </span>
                                    <span className="font-medium">{req.village}</span>
                                  </div>
                                )}
                                {req.landmark && (
                                  <div>
                                    <span className="text-muted-foreground">Landmark: </span>
                                    <span className="font-medium text-primary">{req.landmark}</span>
                                  </div>
                                )}
                                {req.notes && (
                                  <div className="mt-1 p-2 bg-muted rounded text-xs">
                                    <span className="font-medium">Notes: </span>{req.notes}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Status control */}
                            <div className="shrink-0 w-full sm:w-44">
                              <div className="text-xs text-muted-foreground mb-1">Update status</div>
                              <Select
                                value={req.status}
                                onValueChange={(v) => handleStatusChange(req.id, v)}
                                disabled={updateStatus.isPending}
                              >
                                <SelectTrigger className="text-xs h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {DELIVERY_STATUSES.map(s => (
                                    <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <div className="text-xs text-muted-foreground mt-1">
                                Added {formatDate(req.createdAt)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
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
