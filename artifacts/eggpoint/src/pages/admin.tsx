import { useLocation } from "wouter";
import { 
  useGetMe, 
  useListPendingFarms,
  getListPendingFarmsQueryKey,
  useVerifyFarm,
  useLogout
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, LogOut, Check, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatDate } from "@/lib/format";

export default function Admin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: user, isLoading: userLoading } = useGetMe({ 
    query: { retry: false, queryKey: ["/api/auth/me"] } 
  });
  
  const { data: pendingFarms, isLoading: farmsLoading } = useListPendingFarms({
    query: { enabled: user?.role === 'ADMIN', queryKey: getListPendingFarmsQueryKey() }
  });

  const logout = useLogout();
  const verifyFarm = useVerifyFarm();

  if (userLoading) return <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  if (!user || user.role !== 'ADMIN') {
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

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Admin Operations</h1>
          <p className="text-muted-foreground">Manage platform access and farm verifications</p>
        </div>
        <Button variant="outline" onClick={handleLogout}>
          <LogOut className="w-4 h-4 mr-2" /> Logout
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pending Verifications</CardTitle>
          <CardDescription>Review and approve new farm registrations</CardDescription>
        </CardHeader>
        <CardContent>
          {farmsLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : pendingFarms?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No pending farms to review.
            </div>
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
                      {farm.lga}, {farm.state} • Registered {formatDate(farm.createdAt)}
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
    </div>
  );
}
