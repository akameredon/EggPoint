import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import { Navbar } from "@/components/layout/navbar";

import Home from "@/pages/home";
import Login from "@/pages/login";
import Suppliers from "@/pages/suppliers/index";
import SupplierProfile from "@/pages/suppliers/profile";
import Sell from "@/pages/sell";
import Dashboard from "@/pages/dashboard";
import Admin from "@/pages/admin";
import GroupOrder from "@/pages/group-order";
import Join from "@/pages/join";
import OrderTrack from "@/pages/order-track";
import DriverPage from "@/pages/driver";

const queryClient = new QueryClient();

function Router() {
  return (
    <div className="min-h-[100dvh] flex flex-col">
      <Navbar />
      <main className="flex-1 flex flex-col">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/join" component={Join} />
          <Route path="/install" component={Join} />
          <Route path="/login" component={Login} />
          <Route path="/suppliers" component={Suppliers} />
          <Route path="/suppliers/:farmCode" component={SupplierProfile} />
          <Route path="/sell" component={Sell} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/admin" component={Admin} />
          <Route path="/group-order/:batchCode" component={GroupOrder} />
          <Route path="/order/:buyerToken" component={OrderTrack} />
          <Route path="/driver/:driverToken" component={DriverPage} />
          <Route component={NotFound} />
        </Switch>
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
