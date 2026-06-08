import { useState } from "react";
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
  useLogout
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
import { Loader2, Plus, LogOut, Egg, MessageSquare } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { useQueryClient } from "@tanstack/react-query";

const batchSchema = z.object({
  quantityCrates: z.coerce.number().min(1),
  eggSize: z.enum(["SMALL", "MEDIUM", "LARGE", "JUMBO"]),
  pricePerCrate: z.coerce.number().min(1),
  collectionDate: z.string().min(1),
});

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isNewBatchOpen, setIsNewBatchOpen] = useState(false);

  const { data: user, isLoading: userLoading } = useGetMe({ 
    query: { retry: false } 
  });
  
  const farmCode = user?.farmCode || "";

  const { data: farm } = useGetFarm(farmCode, { 
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
      collectionDate: new Date().toISOString().split('T')[0],
    },
  });

  if (userLoading) return <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  if (!user || user.role !== 'SELLER') {
    setLocation('/login');
    return null;
  }

  function handleLogout() {
    logout.mutate(undefined, {
      onSuccess: () => {
        queryClient.setQueryData(['/api/auth/me'], null);
        setLocation('/');
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

  function handleUpdateBatchStatus(batchCode: string, status: any) {
    updateBatch.mutate(
      { batchCode, data: { status } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListBatchesQueryKey({ farmCode }) });
          toast({ title: "Batch updated" });
        }
      }
    );
  }

  function handleUpdateInquiryStatus(id: number, status: any) {
    updateInquiry.mutate(
      { id, data: { status } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListInquiriesQueryKey() });
          toast({ title: "Inquiry updated" });
        }
      }
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Seller Dashboard</h1>
          <p className="text-muted-foreground">Manage your inventory and buyer inquiries for {farm?.farmName}</p>
        </div>
        <Button variant="outline" onClick={handleLogout}>
          <LogOut className="w-4 h-4 mr-2" /> Logout
        </Button>
      </div>

      {!farm?.verified && (
        <div className="bg-accent text-accent-foreground p-4 rounded-lg mb-8 font-medium">
          Your farm profile is pending verification. You can create batches, but they will not be visible on the marketplace until an admin approves your profile.
        </div>
      )}

      <Tabs defaultValue="batches" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="batches" className="text-base"><Egg className="w-4 h-4 mr-2"/> Inventory</TabsTrigger>
          <TabsTrigger value="inquiries" className="text-base"><MessageSquare className="w-4 h-4 mr-2"/> Inquiries</TabsTrigger>
        </TabsList>

        <TabsContent value="batches" className="space-y-6">
          <div className="flex justify-end">
            <Dialog open={isNewBatchOpen} onOpenChange={setIsNewBatchOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="w-4 h-4 mr-2"/> New Batch</Button>
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
                    <Badge variant={batch.status === 'ACTIVE' ? 'default' : 'secondary'}>{batch.status}</Badge>
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
                  {batch.status === 'ACTIVE' && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => handleUpdateBatchStatus(batch.batchCode, 'SOLD_OUT')}>Mark Sold</Button>
                      <Button size="sm" variant="outline" className="flex-1 text-destructive" onClick={() => handleUpdateBatchStatus(batch.batchCode, 'ARCHIVED')}>Archive</Button>
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
                    <Badge variant={inq.status === 'PENDING' ? 'destructive' : 'secondary'}>{inq.status}</Badge>
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
                  {inq.status === 'PENDING' && (
                    <div className="mt-4 pt-4 border-t flex gap-2">
                      <Button size="sm" className="flex-1" onClick={() => handleUpdateInquiryStatus(inq.id, 'RESPONDED')}>Mark Replied</Button>
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
