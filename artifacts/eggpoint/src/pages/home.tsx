import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useGetStats } from "@workspace/api-client-react";
import { Building2, TrendingUp, CheckCircle, ArrowRight, Egg, Recycle } from "lucide-react";

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

      {/* ₦50 Waste-Rescue Narrative */}
      <section className="py-16 bg-primary text-primary-foreground">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/15 px-3 py-1 text-sm font-medium mb-4">
                <Recycle className="w-4 h-4" />
                Waste interception
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
                Eggs at ₦50 — focus on what would have spoiled
              </h2>
              <p className="text-primary-foreground/90 text-lg leading-relaxed mb-4">
                Research shows the volume of eggs that spoil and waste globally every day is larger than the volume humans actually consume. We intercept healthy eggs before they decay, move them fast through our physical neural network, and sell them at ₦50.
              </p>
              <p className="text-primary-foreground/80 mb-6">
                Existing demand already eats its share. We capture the part that would have been lost. Tell us you need eggs, give your address, pay on delivery or online.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/join">
                  <Button size="lg" variant="secondary" className="h-12 font-semibold">
                    <Egg className="w-5 h-5 mr-2" />
                    Order / Join activation
                  </Button>
                </Link>
                <Link href="/suppliers">
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12 border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/10"
                  >
                    See suppliers
                  </Button>
                </Link>
              </div>
            </div>
            <div className="bg-primary-foreground/10 rounded-xl p-6 sm:p-8 border border-primary-foreground/20">
              <h3 className="font-bold text-xl mb-4">The pitch (street + video)</h3>
              <blockquote className="text-sm sm:text-base leading-relaxed text-primary-foreground/90 italic">
                “I can sell this egg for you for 50 naira. I know you will say it is a lie. We found that eggs that spoil daily outnumber what people eat. We grab them while still healthy and sell cheap. Go to the website. Need egg? Address. Deliver. Pay when delivered or online. Drop questions in the comments — I answer personally. Don’t say it is impossible. I am the man of impossibility.”
              </blockquote>
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
                {stats?.totalCratesAvailable
                  ? new Intl.NumberFormat().format(stats.totalCratesAvailable)
                  : "0"}
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
                {stats?.totalInquiries
                  ? new Intl.NumberFormat().format(stats.totalInquiries)
                  : "0"}
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
