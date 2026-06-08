import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useGetStats } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/format";
import { Building2, TrendingUp, CheckCircle, ArrowRight } from "lucide-react";

export default function Home() {
  const { data: stats } = useGetStats();

  return (
    <div className="w-full">
      {/* Hero */}
      <section className="bg-card border-b border-border py-20 lg:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h1 className="text-5xl lg:text-7xl font-bold tracking-tight text-foreground mb-6 leading-tight">
              Real business done here. <br />
              <span className="text-primary">Direct egg procurement.</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl">
              A serious, trustworthy marketplace for institutional buyers to discover and contact verified egg suppliers across Nigeria. No middlemen, no logistics promises — just honest B2B commerce.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/suppliers">
                <Button size="lg" className="h-14 px-8 text-lg font-medium">
                  Browse Marketplace <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <Link href="/sell">
                <Button size="lg" variant="outline" className="h-14 px-8 text-lg font-medium">
                  Register as Supplier
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="p-6 bg-card border border-border rounded-lg shadow-sm">
              <div className="text-4xl font-mono font-bold text-primary mb-2">
                {stats?.verifiedFarms || "0"}
              </div>
              <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Verified Farms
              </div>
            </div>
            <div className="p-6 bg-card border border-border rounded-lg shadow-sm">
              <div className="text-4xl font-mono font-bold text-foreground mb-2">
                {stats?.totalCratesAvailable ? new Intl.NumberFormat().format(stats.totalCratesAvailable) : "0"}
              </div>
              <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Crates Available
              </div>
            </div>
            <div className="p-6 bg-card border border-border rounded-lg shadow-sm">
              <div className="text-4xl font-mono font-bold text-foreground mb-2">
                {stats?.statesCovered || "0"}
              </div>
              <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                States Covered
              </div>
            </div>
            <div className="p-6 bg-card border border-border rounded-lg shadow-sm">
              <div className="text-4xl font-mono font-bold text-foreground mb-2">
                {stats?.totalInquiries ? new Intl.NumberFormat().format(stats.totalInquiries) : "0"}
              </div>
              <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Total Inquiries
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Value Prop */}
      <section className="py-24 bg-card border-y border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-12">
            <div>
              <div className="w-12 h-12 bg-primary/10 rounded flex items-center justify-center mb-6">
                <Building2 className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-3">Direct to Farm</h3>
              <p className="text-muted-foreground">
                Contact farm owners directly. Negotiate terms, organize your own logistics, and build long-term supply relationships without platform fees eating into margins.
              </p>
            </div>
            <div>
              <div className="w-12 h-12 bg-primary/10 rounded flex items-center justify-center mb-6">
                <CheckCircle className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-3">Verified Suppliers</h3>
              <p className="text-muted-foreground">
                Every farm is vetted. We verify production capacity, location, and identity before they can list batches on the marketplace.
              </p>
            </div>
            <div>
              <div className="w-12 h-12 bg-primary/10 rounded flex items-center justify-center mb-6">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-3">Live Inventory</h3>
              <p className="text-muted-foreground">
                View real-time batch availability, egg sizes, and age. Make decisions based on actual production schedules, not outdated WhatsApp broadcasts.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
