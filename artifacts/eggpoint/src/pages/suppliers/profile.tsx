import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetFarm,
  getGetFarmQueryKey,
  useListBatches,
  getListBatchesQueryKey,
  useCreateInquiry,
  useListReviews,
  getListReviewsQueryKey,
  useCreateReview,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MapPin, Verified, Calendar, ShieldCheck, Star, ChevronDown, ChevronUp, Truck } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";

function toWhatsAppNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("234")) return digits;
  if (digits.startsWith("0")) return "234" + digits.slice(1);
  return "234" + digits;
}

function buildWhatsAppUrl(phone: string | null | undefined, message: string): string | null {
  const wa = toWhatsAppNumber(phone);
  if (!wa) return null;
  return `https://wa.me/${wa}?text=${encodeURIComponent(message)}`;
}

function StarRating({ rating, max = 5, size = 18 }: { rating: number; max?: number; size?: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${rating} out of ${max} stars`}>
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          width={size}
          height={size}
          className={i < rating ? "fill-amber-400 text-amber-400" : "fill-muted text-muted"}
        />
      ))}
    </span>
  );
}

function InteractiveStars({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <span className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          className="focus:outline-none"
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
        >
          <Star
            width={26}
            height={26}
            className={
              n <= (hovered || value)
                ? "fill-amber-400 text-amber-400 transition-colors"
                : "fill-muted text-muted transition-colors"
            }
          />
        </button>
      ))}
    </span>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months > 1 ? "s" : ""} ago`;
}

const inquirySchema = z.object({
  buyerName: z.string().min(2, "Name is required"),
  buyerPhone: z.string().min(7, "Phone is required"),
  batchCode: z.string().min(1, "Please select a batch"),
  quantityCrates: z.coerce.number().min(1, "Quantity must be at least 1"),
  message: z.string().min(10, "Please provide some details for the supplier"),
});

const reviewSchema = z.object({
  buyerName: z.string().min(2, "Name is required"),
  rating: z.coerce.number().int().min(1, "Please select a rating").max(5),
  comment: z.string().min(10, "Please write at least 10 characters"),
});

export default function SupplierProfile() {
  const [, params] = useRoute("/suppliers/:farmCode");
  const farmCode = params?.farmCode || "";
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showReviewForm, setShowReviewForm] = useState(false);

  const { data: farm, isLoading: farmLoading } = useGetFarm(farmCode, {
    query: { enabled: !!farmCode, queryKey: getGetFarmQueryKey(farmCode) }
  });

  const { data: batches, isLoading: batchesLoading } = useListBatches({ farmCode }, {
    query: { enabled: !!farmCode, queryKey: getListBatchesQueryKey({ farmCode }) }
  });

  const { data: reviews, isLoading: reviewsLoading } = useListReviews(farmCode, {
    query: { enabled: !!farmCode, queryKey: getListReviewsQueryKey(farmCode) }
  });

  const activeBatches = batches?.filter(b => b.status === "ACTIVE") || [];

  const avgRating = reviews && reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : null;

  const inquiryForm = useForm<z.infer<typeof inquirySchema>>({
    resolver: zodResolver(inquirySchema),
    defaultValues: {
      buyerName: "",
      buyerPhone: "",
      batchCode: "",
      quantityCrates: 10,
      message: "Hi, I am interested in purchasing from this batch.",
    },
  });

  const reviewForm = useForm<z.infer<typeof reviewSchema>>({
    resolver: zodResolver(reviewSchema),
    defaultValues: { buyerName: "", rating: 0, comment: "" },
  });

  const createInquiry = useCreateInquiry();
  const createReview = useCreateReview();

  function onInquirySubmit(values: z.infer<typeof inquirySchema>) {
    createInquiry.mutate(
      { data: { ...values, farmCode } },
      {
        onSuccess: () => {
          toast({ title: "Inquiry sent", description: "The supplier will contact you soon." });
          inquiryForm.reset();
        },
        onError: (error) => {
          toast({ variant: "destructive", title: "Error", description: (error as { error?: string }).error || "Could not send inquiry" });
        },
      }
    );
  }

  function onReviewSubmit(values: z.infer<typeof reviewSchema>) {
    createReview.mutate(
      { farmCode, data: { buyerName: values.buyerName, rating: values.rating, comment: values.comment } },
      {
        onSuccess: () => {
          toast({ title: "Review submitted", description: "Thank you for your feedback." });
          reviewForm.reset();
          setShowReviewForm(false);
          queryClient.invalidateQueries({ queryKey: getListReviewsQueryKey(farmCode) });
        },
        onError: () => {
          toast({ variant: "destructive", title: "Error", description: "Could not submit review. Please try again." });
        },
      }
    );
  }

  const selectedBatch = activeBatches.find(b => b.batchCode === inquiryForm.watch("batchCode"));

  function getWhatsAppMessage(): string {
    const lines = [
      `Hello ${farm?.farmName ?? ""},`,
      `I found your listing on Eggpoint and I am interested in buying eggs.`,
    ];
    if (selectedBatch) {
      lines.push(`Batch: ${selectedBatch.eggSize} eggs — ${formatCurrency(selectedBatch.pricePerCrate)}/crate`);
      lines.push(`Quantity needed: ${inquiryForm.watch("quantityCrates")} crates`);
    }
    lines.push(`Please let me know your availability. Thank you.`);
    return lines.join("\n");
  }

  const ownerPhone = (farm as { ownerPhone?: string | null })?.ownerPhone ?? null;
  const waUrl = buildWhatsAppUrl(ownerPhone, getWhatsAppMessage());

  if (farmLoading) {
    return <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (!farm) {
    return <div className="p-12 text-center text-xl">Farm not found</div>;
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="bg-card border border-border rounded-xl p-8 mb-8">
        <div className="flex flex-col md:flex-row justify-between md:items-end gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-foreground">{farm.farmName}</h1>
              {farm.verified && (
                <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                  <Verified className="w-3.5 h-3.5 mr-1" /> Verified Supplier
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-4 mb-2 flex-wrap">
              <span className="flex items-center text-muted-foreground text-lg">
                <MapPin className="w-5 h-5 mr-2" />{farm.lga}, {farm.state}
              </span>
              {avgRating !== null && (
                <span className="flex items-center gap-2">
                  <StarRating rating={Math.round(avgRating)} />
                  <span className="text-sm font-semibold text-foreground">{avgRating.toFixed(1)}</span>
                  <span className="text-sm text-muted-foreground">({reviews!.length} review{reviews!.length !== 1 ? "s" : ""})</span>
                </span>
              )}
            </div>
            <p className="text-foreground max-w-3xl leading-relaxed mb-5">
              {farm.description || "A registered commercial poultry farm supplying high-quality eggs."}
            </p>
            {waUrl && (
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm text-white transition-opacity hover:opacity-90 focus:outline-none"
                style={{ backgroundColor: "#25D366" }}
              >
                <WhatsAppIcon />
                Chat on WhatsApp
              </a>
            )}
          </div>
          <div className="bg-background rounded-lg p-4 border border-border text-center min-w-[200px]">
            <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">Total Capacity</div>
            <div className="text-3xl font-mono font-bold text-foreground">
              {farm.totalCratesAvailable ? new Intl.NumberFormat().format(farm.totalCratesAvailable) : 0}
              <span className="text-lg text-muted-foreground font-sans ml-1">crates</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left Column: Batches + Reviews */}
        <div className="lg:col-span-2 space-y-10">
          {/* Active Batches */}
          <section>
            <h2 className="text-2xl font-bold mb-4">Active Batches</h2>
            {batchesLoading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : activeBatches.length === 0 ? (
              <div className="p-8 border border-dashed border-border rounded-lg text-center">
                <p className="text-muted-foreground">No active batches available currently.</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {activeBatches.map(batch => (
                  <Card
                    key={batch.batchCode}
                    className={`cursor-pointer transition-all ${inquiryForm.watch("batchCode") === batch.batchCode ? "ring-2 ring-primary border-primary" : "hover:border-primary/50"}`}
                    onClick={() => inquiryForm.setValue("batchCode", batch.batchCode)}
                  >
                    <CardContent className="p-5">
                      <div className="flex justify-between items-start mb-4">
                        <Badge className="font-mono">{batch.eggSize}</Badge>
                        <span className="text-sm font-mono text-muted-foreground">#{batch.batchCode.slice(-6)}</span>
                      </div>
                      <div className="text-2xl font-bold text-foreground mb-1">
                        {formatCurrency(batch.pricePerCrate)} <span className="text-sm font-normal text-muted-foreground">/ crate</span>
                      </div>
                      <div className="text-sm font-medium text-foreground mb-4">
                        {batch.quantityCrates} crates available
                      </div>
                      <div className="flex items-center text-sm text-muted-foreground bg-muted/50 p-2 rounded mb-3">
                        <Calendar className="w-4 h-4 mr-2" />
                        Collection: {formatDate(batch.collectionDate)}
                      </div>
                      <Link href={`/group-order/${batch.batchCode}`} onClick={e => e.stopPropagation()}>
                        <Button variant="outline" size="sm" className="w-full text-xs">
                          <Truck className="w-3 h-3 mr-1.5" /> Request Group Delivery
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <div className="mt-6 bg-primary/5 border border-primary/20 p-6 rounded-lg flex gap-4 items-start">
              <ShieldCheck className="w-6 h-6 text-primary shrink-0" />
              <div>
                <h4 className="font-bold text-foreground mb-1">Safe Trading Guidelines</h4>
                <p className="text-sm text-muted-foreground">
                  Eggpoint does not handle payments. You will negotiate directly with the farm. We recommend visiting the farm for your first collection to verify product quality before full payment.
                </p>
              </div>
            </div>
          </section>

          {/* Reviews Section */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">
                Buyer Reviews
                {reviews && reviews.length > 0 && (
                  <span className="ml-2 text-base font-normal text-muted-foreground">({reviews.length})</span>
                )}
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowReviewForm(v => !v)}
              >
                {showReviewForm ? (
                  <><ChevronUp className="w-4 h-4 mr-1" /> Cancel</>
                ) : (
                  <><Star className="w-4 h-4 mr-1" /> Leave a Review</>
                )}
              </Button>
            </div>

            {/* Review form */}
            {showReviewForm && (
              <Card className="mb-6 border-primary/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Your Review</CardTitle>
                </CardHeader>
                <CardContent>
                  <Form {...reviewForm}>
                    <form onSubmit={reviewForm.handleSubmit(onReviewSubmit)} className="space-y-4">
                      <FormField control={reviewForm.control} name="buyerName" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Your Name / Company</FormLabel>
                          <FormControl><Input placeholder="e.g. Lagos Sheraton Hotel" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />

                      <FormField control={reviewForm.control} name="rating" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Rating</FormLabel>
                          <FormControl>
                            <div>
                              <InteractiveStars value={field.value} onChange={field.onChange} />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />

                      <FormField control={reviewForm.control} name="comment" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Comment</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Describe your experience with this supplier — reliability, egg quality, communication..."
                              className="resize-none h-24"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />

                      <Button type="submit" disabled={createReview.isPending} className="w-full">
                        {createReview.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Submit Review
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            )}

            {/* Review list */}
            {reviewsLoading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : !reviews || reviews.length === 0 ? (
              <div className="p-8 border border-dashed border-border rounded-lg text-center">
                <p className="text-muted-foreground">No reviews yet. Be the first to leave feedback.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {reviews.map(review => (
                  <div key={review.id} className="bg-card border border-border rounded-lg p-5">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-foreground">{review.buyerName}</p>
                        <StarRating rating={review.rating} size={15} />
                      </div>
                      <span className="text-xs text-muted-foreground">{timeAgo(review.createdAt)}</span>
                    </div>
                    <p className="text-sm text-foreground leading-relaxed mt-2">{review.comment}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Inquiry Form */}
        <div>
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Send Inquiry</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...inquiryForm}>
                <form onSubmit={inquiryForm.handleSubmit(onInquirySubmit)} className="space-y-4">
                  <FormField control={inquiryForm.control} name="buyerName" render={({ field }) => (
                    <FormItem><FormLabel>Your Name / Company</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={inquiryForm.control} name="buyerPhone" render={({ field }) => (
                    <FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input type="tel" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />

                  <FormField control={inquiryForm.control} name="batchCode" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Select Batch</FormLabel>
                      <FormControl>
                        <select
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          {...field}
                        >
                          <option value="">-- Select a batch --</option>
                          {activeBatches.map(b => (
                            <option key={b.batchCode} value={b.batchCode}>
                              {b.eggSize} - {formatCurrency(b.pricePerCrate)} ({b.quantityCrates} cr)
                            </option>
                          ))}
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={inquiryForm.control} name="quantityCrates" render={({ field }) => (
                    <FormItem><FormLabel>Quantity Required (Crates)</FormLabel><FormControl><Input type="number" min={1} {...field} /></FormControl><FormMessage /></FormItem>
                  )} />

                  <FormField control={inquiryForm.control} name="message" render={({ field }) => (
                    <FormItem><FormLabel>Message</FormLabel><FormControl><Textarea className="resize-none h-24" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />

                  <Button type="submit" className="w-full" disabled={createInquiry.isPending || activeBatches.length === 0}>
                    {createInquiry.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Send Inquiry
                  </Button>

                  {waUrl && (
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full h-10 rounded-md font-semibold text-sm text-white transition-opacity hover:opacity-90"
                      style={{ backgroundColor: "#25D366" }}
                    >
                      <WhatsAppIcon />
                      WhatsApp the Supplier
                    </a>
                  )}
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function WhatsAppIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}
