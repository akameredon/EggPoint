import { useState } from "react";
import { Link } from "wouter";
import { useListListings, getListListingsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/format";
import { MapPin, Box, Calendar, Verified } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Suppliers() {
  const [stateFilter, setStateFilter] = useState<string>("");
  const [sizeFilter, setSizeFilter] = useState<string>("");

  const { data: listings, isLoading } = useListListings({ 
    query: { 
      queryKey: getListListingsQueryKey({ state: stateFilter, eggSize: sizeFilter }) 
    } 
  });

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-4">Active Egg Batches</h1>
        <p className="text-muted-foreground max-w-2xl">
          Browse real-time inventory from verified farms across Nigeria. Contact them directly to negotiate terms.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <Input 
          placeholder="Filter by state..." 
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          className="md:max-w-xs"
        />
        <Select value={sizeFilter} onValueChange={setSizeFilter}>
          <SelectTrigger className="md:max-w-[200px]">
            <SelectValue placeholder="All Egg Sizes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Sizes</SelectItem>
            <SelectItem value="SMALL">Small</SelectItem>
            <SelectItem value="MEDIUM">Medium</SelectItem>
            <SelectItem value="LARGE">Large</SelectItem>
            <SelectItem value="JUMBO">Jumbo</SelectItem>
          </SelectContent>
        </Select>
        {(stateFilter || (sizeFilter && sizeFilter !== "ALL")) && (
          <Button variant="ghost" onClick={() => { setStateFilter(""); setSizeFilter(""); }}>
            Clear Filters
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Card key={i} className="overflow-hidden">
              <div className="h-48 bg-muted animate-pulse" />
              <CardContent className="p-6">
                <Skeleton className="h-6 w-3/4 mb-4" />
                <Skeleton className="h-4 w-1/2 mb-2" />
                <Skeleton className="h-4 w-full mb-6" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : listings?.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-lg border border-border">
          <Box className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground">No active batches found</h3>
          <p className="mt-1 text-muted-foreground">Try adjusting your filters or check back later.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {listings?.map((listing) => (
            <Card key={`${listing.farmCode}-${listing.batchCode}`} className="overflow-hidden hover:border-primary/50 transition-colors flex flex-col">
              <div className="p-6 bg-card flex-1">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-lg text-foreground line-clamp-1">{listing.farmName}</h3>
                      {listing.verified && <Verified className="w-4 h-4 text-primary" />}
                    </div>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <MapPin className="w-3.5 h-3.5 mr-1" />
                      {listing.lga}, {listing.state}
                    </div>
                  </div>
                  <Badge variant="secondary" className="font-mono">{listing.eggSize}</Badge>
                </div>
                
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between items-center py-2 border-b border-border/50">
                    <span className="text-sm text-muted-foreground">Price/Crate</span>
                    <span className="font-bold text-foreground">{formatCurrency(listing.pricePerCrate)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border/50">
                    <span className="text-sm text-muted-foreground">Available</span>
                    <span className="font-medium text-foreground">{listing.quantityCrates} crates</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-muted-foreground">Collection</span>
                    <span className="text-sm font-medium text-foreground flex items-center">
                      <Calendar className="w-3.5 h-3.5 mr-1" />
                      {formatDate(listing.collectionDate)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="p-6 pt-0 mt-auto">
                <Link href={`/suppliers/${listing.farmCode}`}>
                  <Button className="w-full">View Farm & Inquire</Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
