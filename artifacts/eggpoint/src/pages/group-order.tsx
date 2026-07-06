import { useState } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Truck, MapPin, CheckCircle2, Package } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";

const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue",
  "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT",
  "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi",
  "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo",
  "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara",
];

const formSchema = z.object({
  buyerName: z.string().min(2, "Full name is required"),
  buyerPhone: z.string().min(10, "Valid phone number required"),
  state: z.string().min(1, "State is required"),
  lga: z.string().min(2, "LGA is required"),
  town: z.string().min(2, "Town or city is required"),
  streetAddress: z.string().min(5, "Street address is required"),
  marketArea: z.string().optional(),
  village: z.string().optional(),
  landmark: z.string().optional(),
  quantityCrates: z.coerce.number().int().min(1, "At least 1 crate required"),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function GroupOrder() {
  const [, params] = useRoute("/group-order/:batchCode");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [submittedRef, setSubmittedRef] = useState<number | null>(null);

  const batchCode = params?.batchCode || "";

  const { data: listings } = useListListings(undefined, {
    query: { enabled: !!batchCode, queryKey: getListListingsQueryKey(undefined) }
  });

  const listing = listings?.find(l => l.batchCode === batchCode);
  const farm = listing ? { farmName: listing.farmName, lga: listing.lga, state: listing.state, farmCode: listing.farmCode } : null;
  const batch = listing ? { eggSize: listing.eggSize, pricePerCrate: listing.pricePerCrate, collectionDate: listing.collectionDate } : null;

  const createRequest = useCreateDeliveryRequest();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      buyerName: "",
      buyerPhone: "",
      state: "",
      lga: "",
      town: "",
      streetAddress: "",
      marketArea: "",
      village: "",
      landmark: "",
      quantityCrates: 1,
      notes: "",
    },
  });

  function onSubmit(values: FormValues) {
    createRequest.mutate(
      {
        data: {
          batchCode,
          buyerName: values.buyerName,
          buyerPhone: values.buyerPhone,
          state: values.state,
          lga: values.lga,
          town: values.town,
          streetAddress: values.streetAddress,
          marketArea: values.marketArea || undefined,
          village: values.village || undefined,
          landmark: values.landmark || undefined,
          quantityCrates: values.quantityCrates,
          notes: values.notes || undefined,
        },
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
          Your delivery request #{submittedRef} has been received. The farm coordinator will
          group your order with other buyers in your state and confirm dispatch details via phone.
        </p>
        <p className="text-sm text-muted-foreground mb-8">
          Make sure your phone is reachable — the driver will contact you before delivery.
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
        <h1 className="text-2xl font-bold text-foreground mb-1">
          Request Coordinated Delivery
        </h1>
        <p className="text-muted-foreground">
          Pool your order with other buyers in the same area. We use your address details to
          build a nearby delivery cluster so one truck can collect from the farm and drop to
          several homes or businesses in one loop.
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
                <div className="font-bold text-lg">{formatCurrency(batch.pricePerCrate)}<span className="text-sm font-normal text-muted-foreground"> / crate</span></div>
                <div className="text-sm text-muted-foreground">Collection: {formatDate(batch.collectionDate)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        {[
          { icon: Truck, text: "One truck, multiple drops" },
          { icon: MapPin, text: "Your address, your name on the package" },
          { icon: CheckCircle2, text: "Farm confirms pickup date" },
        ].map(({ icon: Icon, text }) => (
          <div key={text} className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
            <Icon className="w-4 h-4 text-primary shrink-0" />
            {text}
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Details</CardTitle>
          <CardDescription>We need your full delivery address so the driver can find you.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="buyerName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl><Input placeholder="Emeka Okafor" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="buyerPhone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl><Input placeholder="08012345678" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="border-t pt-4">
                <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" /> Delivery Address
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  The more precise your address details, the better we can group your order with nearby buyers for a shared delivery run.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <FormField control={form.control} name="state" render={({ field }) => (
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {NIGERIAN_STATES.map(s => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="lga" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Local Government Area (LGA)</FormLabel>
                      <FormControl><Input placeholder="e.g., Owerri Municipal" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <FormField control={form.control} name="town" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Town / City</FormLabel>
                      <FormControl><Input placeholder="e.g., Owerri" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="streetAddress" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Street Address</FormLabel>
                      <FormControl><Input placeholder="e.g., 14 Douglas Road" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <FormField control={form.control} name="marketArea" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Market / Area Name <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                      <FormControl><Input placeholder="e.g., Ekeonuwa Market" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="village" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Village <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                      <FormControl><Input placeholder="e.g., Umuoha Village" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="landmark" render={({ field }) => (
                  <FormItem className="mb-4">
                    <FormLabel>Nearby Landmark <span className="text-muted-foreground font-normal">(optional but very helpful)</span></FormLabel>
                    <FormControl><Input placeholder="e.g., Next to First Bank, 3rd house after the roundabout" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="border-t pt-4">
                <p className="text-sm font-semibold text-foreground mb-3">Order Details</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="quantityCrates" render={({ field }) => (
                    <FormItem>
                      <FormLabel>How many crates?</FormLabel>
                      <FormControl><Input type="number" min={1} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="notes" render={({ field }) => (
                  <FormItem className="mt-4">
                    <FormLabel>Additional Notes <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                    <FormControl>
                      <Textarea placeholder="Any special delivery instructions, access info, preferred time, etc." rows={3} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={createRequest.isPending}>
                {createRequest.isPending
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...</>
                  : <><Truck className="w-4 h-4 mr-2" /> Submit Delivery Request</>
                }
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
