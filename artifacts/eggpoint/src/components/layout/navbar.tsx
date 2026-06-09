import { Link, useLocation } from "wouter";
import { useGetMe } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Egg } from "lucide-react";

export function Navbar() {
  const [location] = useLocation();
  const { data: user } = useGetMe({ query: { retry: false, queryKey: ["/api/auth/me"] } });

  return (
    <nav className="border-b border-border bg-card">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded flex items-center justify-center text-primary-foreground">
                <Egg className="w-5 h-5" />
              </div>
              <span className="font-bold text-xl tracking-tight">Eggpoint</span>
            </Link>
            
            <div className="hidden sm:ml-8 sm:flex sm:space-x-4">
              <Link href="/suppliers" className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${location === '/suppliers' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                Marketplace
              </Link>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {user ? (
              <Link href={user.role === 'ADMIN' ? '/admin' : '/dashboard'}>
                <Button variant="outline">Dashboard</Button>
              </Link>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost">Log in</Button>
                </Link>
                <Link href="/sell">
                  <Button>Become a Supplier</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
