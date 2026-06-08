import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  useGetMe,
  useGetFarm,
  getGetFarmQueryKey,
  useListBatches,
  getListBatchesQueryKey,
  useCreateBatch,
  useUpdateBatch,
  useListInquiries,
  getListInquiriesQueryKey,
  useUpdateInquiry,
  useLogout,
  useInitiatePayment,
  useVerifyPayment,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, LogOut, Egg, MessageSquare, Star, CheckCircle2, Zap } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { useQueryClient } from "@tanstack/react-query";

const batchSchema = z.object({
  quantityCrates: z.coerce.number().min(1),
  eggSize: z.enum(["SMALL", "MEDIUM", "LARGE", "JUMBO"]),
  pricePerCrate: z.coerce.number().min(1),
  collectionDate: z.string().min(1),
});

function FeaturedUpgradeCard({
  farmCode,
  onUpgraded,
}: {
  farmCode: string;
  onUpgraded: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const initiatePayment = useInitiatePayment();
  const verifyPayment = useVerifyPayment();
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") !== "complete") return;

    const txRef = sessionStorage.getItem("ep_tx_ref");
    const txId = sessionStorage.getItem("ep_tx_id");

    if (!txRef) return;

    setVerifying(true);

    verifyPayment.mutate(
      { data: { txRef, transactionId: txId || "" } },
      {
        onSuccess: () => {
          sessionStorage.removeItem("ep_tx_ref");
          sessionStorage.removeItem("ep_tx_id");
          queryClient.invalidateQueries({ queryKey: getGetFarmQueryKey(farmCode) });
          toast({ title: "Payment confirmed!", description: "Your farm is now a Featured listing." });
          onUpgraded();
          window.history.replaceState({}, "", "/dashboard");
        },
        onError: () => {
          toast({ variant: "destructive", title: "Payment verification failed", description: "Contact support if your money was deducted." });
        },
        onSettled: () => setVerifying(false),
      }
    );
  }, []);

  function handleUpgrade() {
    initiatePayment.mutate(undefined, {
      onSuccess: ({ paymentLink, txRef }) => {
        sessionStorage.setItem("ep_tx_ref", txRef);
        window.location.href = paymentLink;
      },
      onError: (err) => {
        toast({ variant: "destructive", title: "Could not start payment", description: err.error || "Please try again." });
      },
    });
  }

  if (verifying) {
    return (
      <Card className="border-amber-200 bg-amber-50 mb-8">
        <CardContent className="p-6 flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-amber-600" />
          <span className="font-medium text-amber-800">Verifying your payment...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 mb-8">
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
          <div className="flex gap-4 items-start">
            <div className="p-2 bg-amber-100 rounded-lg shrink-0">
              <Star className="w-6 h-6 text-amber-600 fill-amber-400" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-lg mb-1">Go Featured — ₦15,000 / month</h3>
              <p className="text-sm text-muted-foreground mb-3">Featured farms appear at the top of every buyer search. More visibility means more inquiries.</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {[
                  "Pinned at top of marketplace",
                  "Featured badge on your profile",
                  "Priority in state & size filters",
                ].map(b => (
                  <span key={b} className="flex items-center gap-1 text-sm text-foreground">
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 shrink-0" /> {b}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <Button
            onClick={handleUpgrade}
            disabled={initiatePayment.isPending}
            className="shrink-0 bg-amber-500 hover:bg-amber-600 text-white border-0"
          >
            {initiatePayment.isPending
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Opening payment...</>
              : <><Zap className="w-4 h-4 mr-2" /> Upgrade Now</>
            }
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isNewBatchOpen, setIsNewBatchOpen] = useState(false);

  const { data: user, isLoading: userLoading } = useGetMe({
    query: { retry: false }
  });

  const farmCode = user?.farmCode || "";

  const { data: farm, refetch: refetchFarm } = useGetFarm(farmCode, {
    query: { enabled: !!farmCode, queryKey: getGetFarmQueryKey(farmCode) }
  });

  const { data: batches } = useListBatches({ farmCode }, {
    query: { enabled: !!farmCode, queryKey: getListBatchesQueryKey({ farmCode }) }
  });

  const { data: inquiries } = useListInquiries({
    query: { enabled: !!farmCode, queryKey: getListInquiriesQueryKey() }
  });

  const logout = useLogout();
  const createBatch = useCreateBatch();
  const updateBatch = useUpdateBatch();
  const updateInquiry = useUpdateInquiry();

  const form = useForm<z.infer<typeof batchSchema>>({
    resolver: zodResolver(batchSchema),
    defaultValues: {
      quantityCrates: 100,
      eggSize: "MEDIUM",
      pricePerCrate: 3500,
      collectionDate: new Date().toISOString().split("T")[0],
    },
  });

  useEffect(() => {
    if (!userLoading && (!user || user.role !== "SELLER")) {
      setLocation("/login");
    }
  }, [userLoading, user]);

  if (userLoading || !user || user.role !== "SELLER") {
    return <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  function handleLogout() {
    logout.mutate(undefined, {
      onSuccess: () => {
        queryClient.setQueryData(["/api/auth/me"], null);
        setLocation("/");
      }
    });
  }

  function onSubmitBatch(values: z.infer<typeof batchSchema>) {
    createBatch.mutate(
      { data: { ...values, farmCode } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListBatchesQueryKey({ farmCode }) });
          setIsNewBatchOpen(false);
          form.reset();
          toast({ title: "Batch created successfully" });
        },
        onError: (error) => toast({ variant: "destructive", title: "Error", description: error.error })
      }
    );
  }

  function handleUpdateBatchStatus(batchCode: string, status: string) {
    updateBatch.mutate(
      { batchCode, data: { status: status as "ACTIVE" | "RESERVED" | "SOLD_OUT" | "ARCHIVED" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListBatchesQueryKey({ farmCode }) });
          toast({ title: "Batch updated" });
        }
      }
    );
  }

  function handleUpdateInquiryStatus(id: number, status: string) {
    updateInquiry.mutate(
      { id, data: { status: status as "PENDING" | "RESPONDED" | "CLOSED" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListInquiriesQueryKey() });
          toast({ title: "Inquiry updated" });
        }
      }
    );
  }

  const isFeatured = farm?.subscriptionTier === "FEATURED";

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold text-foreground">Seller Dashboard</h1>
            {isFeatured && (
              <Badge className="bg-amber-100 text-amber-800 border-amber-300 font-semibold">
                <Star className="w-3 h-3 mr-1 fill-amber-500 text-amber-500" /> Featured
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">Manage your inventory and buyer inquiries for {farm?.farmName}</p>
        </div>
        <Button variant="outline" onClick={handleLogout}>
          <LogOut className="w-4 h-4 mr-2" /> Logout
        </Button>
      </div>

      {!farm?.verified && (
        <div className="bg-accent text-accent-foreground p-4 rounded-lg mb-6 font-medium">
          Your farm profile is pending verification. You can create batches, but they will not be visible on the marketplace until an admin approves your profile.
        </div>
      )}

      {farm && !isFeatured && (
        <FeaturedUpgradeCard
          farmCode={farmCode}
          onUpgraded={() => refetchFarm()}
        />
      )}

      <Tabs defaultValue="batches" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="batches" className="text-base"><Egg className="w-4 h-4 mr-2" /> Inventory</TabsTrigger>
          <TabsTrigger value="inquiries" className="text-base"><MessageSquare className="w-4 h-4 mr-2" /> Inquiries</TabsTrigger>
        </TabsList>

        <TabsContent value="batches" className="space-y-6">
          <div className="flex justify-end">
            <Dialog open={isNewBatchOpen} onOpenChange={setIsNewBatchOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="w-4 h-4 mr-2" /> New Batch</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create Egg Batch</DialogTitle></DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmitBatch)} className="space-y-4">
                    <FormField control={form.control} name="eggSize" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Egg Size</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select size" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="SMALL">Small</SelectItem>
                            <SelectItem value="MEDIUM">Medium</SelectItem>
                            <SelectItem value="LARGE">Large</SelectItem>
                            <SelectItem value="JUMBO">Jumbo</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="quantityCrates" render={({ field }) => (
                      <FormItem><FormLabel>Quantity (Crates)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="pricePerCrate" render={({ field }) => (
                      <FormItem><FormLabel>Price per Crate (₦)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="collectionDate" render={({ field }) => (
                      <FormItem><FormLabel>Collection Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <Button type="submit" className="w-full" disabled={createBatch.isPending}>
                      {createBatch.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Create Batch
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {batches?.map(batch => (
              <Card key={batch.id}>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg font-mono">#{batch.batchCode.slice(-6)}</CardTitle>
                    <Badge variant={batch.status === "ACTIVE" ? "default" : "secondary"}>{batch.status}</Badge>
                  </div>
                  <CardDescription>Created {formatDate(batch.createdAt)}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between"><span className="text-muted-foreground">Size</span><span className="font-medium">{batch.eggSize}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Quantity</span><span className="font-medium">{batch.quantityCrates} crates</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Price</span><span className="font-medium">{formatCurrency(batch.pricePerCrate)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Collection</span><span className="font-medium">{formatDate(batch.collectionDate)}</span></div>
                  </div>
                  {batch.status === "ACTIVE" && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => handleUpdateBatchStatus(batch.batchCode, "SOLD_OUT")}>Mark Sold</Button>
                      <Button size="sm" variant="outline" className="flex-1 text-destructive" onClick={() => handleUpdateBatchStatus(batch.batchCode, "ARCHIVED")}>Archive</Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            {batches?.length === 0 && (
              <div className="col-span-full text-center py-12 bg-card border rounded-lg text-muted-foreground">
                No batches created yet.
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="inquiries" className="space-y-4">
          {inquiries?.map(inq => (
            <Card key={inq.id}>
              <CardContent className="p-6 flex flex-col md:flex-row gap-6">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-lg">{inq.buyerName}</h3>
                    <Badge variant={inq.status === "PENDING" ? "destructive" : "secondary"}>{inq.status}</Badge>
                  </div>
                  <div className="text-sm font-mono text-muted-foreground">{inq.buyerPhone}</div>
                  <p className="text-foreground mt-2 bg-muted p-3 rounded">{inq.message}</p>
                </div>
                <div className="w-full md:w-64 bg-card border rounded p-4 flex flex-col justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Requested Batch</div>
                    <div className="font-mono text-sm mb-2">#{inq.batchCode.slice(-6)}</div>
                    <div className="font-bold">{inq.quantityCrates} crates</div>
                  </div>
                  {inq.status === "PENDING" && (
                    <div className="mt-4 pt-4 border-t flex gap-2">
                      <Button size="sm" className="flex-1" onClick={() => handleUpdateInquiryStatus(inq.id, "RESPONDED")}>Mark Replied</Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {inquiries?.length === 0 && (
            <div className="text-center py-12 bg-card border rounded-lg text-muted-foreground">
              No inquiries received yet.
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
