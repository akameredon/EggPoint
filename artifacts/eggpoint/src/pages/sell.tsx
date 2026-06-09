import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRegister, useCreateFarm } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowRight } from "lucide-react";

const accountSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(10, "Valid phone number required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const farmSchema = z.object({
  farmName: z.string().min(2, "Farm name is required"),
  state: z.string().min(2, "State is required"),
  lga: z.string().min(2, "LGA is required"),
  description: z.string().optional(),
});

export default function Sell() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2>(1);

  const accountForm = useForm<z.infer<typeof accountSchema>>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      password: "",
    },
  });

  const farmForm = useForm<z.infer<typeof farmSchema>>({
    resolver: zodResolver(farmSchema),
    defaultValues: {
      farmName: "",
      state: "",
      lga: "",
      description: "",
    },
  });

  const registerMutation = useRegister();
  const createFarmMutation = useCreateFarm();

  function onAccountSubmit(values: z.infer<typeof accountSchema>) {
    registerMutation.mutate(
      { data: { ...values, role: 'SELLER' } },
      {
        onSuccess: () => {
          setStep(2);
        },
        onError: (error) => {
          toast({
            variant: "destructive",
            title: "Registration failed",
            description: (error as { error?: string }).error || "Could not create account.",
          });
        },
      }
    );
  }

  function onFarmSubmit(values: z.infer<typeof farmSchema>) {
    createFarmMutation.mutate(
      { data: values },
      {
        onSuccess: () => {
          toast({ title: "Farm registered successfully!" });
          setLocation('/dashboard');
        },
        onError: (error) => {
          toast({
            variant: "destructive",
            title: "Farm creation failed",
            description: (error as { error?: string }).error || "Could not create farm profile.",
          });
        },
      }
    );
  }

  return (
    <div className="min-h-screen py-12 sm:px-6 lg:px-8 bg-background">
      <div className="sm:mx-auto sm:w-full sm:max-w-md mb-8">
        <h2 className="text-center text-3xl font-extrabold text-foreground">
          Become a Verified Supplier
        </h2>
        <p className="mt-2 text-center text-muted-foreground">
          Sell directly to institutional buyers. Zero platform fees on transactions.
        </p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="flex justify-between items-center mb-8 px-4">
          <div className={`flex flex-col items-center flex-1 ${step >= 1 ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold mb-2 ${step >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>1</div>
            <span className="text-sm font-medium">Account</span>
          </div>
          <div className="h-px bg-border flex-1 mx-2"></div>
          <div className={`flex flex-col items-center flex-1 ${step >= 2 ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold mb-2 ${step >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>2</div>
            <span className="text-sm font-medium">Farm Profile</span>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{step === 1 ? 'Create Account' : 'Farm Details'}</CardTitle>
            <CardDescription>
              {step === 1 ? 'Your personal contact information.' : 'Information about your production facility.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === 1 ? (
              <Form {...accountForm}>
                <form onSubmit={accountForm.handleSubmit(onAccountSubmit)} className="space-y-6">
                  <FormField control={accountForm.control} name="fullName" render={({ field }) => (
                    <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={accountForm.control} name="email" render={({ field }) => (
                    <FormItem><FormLabel>Email Address</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={accountForm.control} name="phone" render={({ field }) => (
                    <FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input type="tel" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={accountForm.control} name="password" render={({ field }) => (
                    <FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <Button type="submit" className="w-full" disabled={registerMutation.isPending}>
                    {registerMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Continue to Farm Details <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </form>
              </Form>
            ) : (
              <Form {...farmForm}>
                <form onSubmit={farmForm.handleSubmit(onFarmSubmit)} className="space-y-6">
                  <FormField control={farmForm.control} name="farmName" render={({ field }) => (
                    <FormItem><FormLabel>Farm Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={farmForm.control} name="state" render={({ field }) => (
                      <FormItem><FormLabel>State</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={farmForm.control} name="lga" render={({ field }) => (
                      <FormItem><FormLabel>LGA</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  <FormField control={farmForm.control} name="description" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Farm Description (Optional)</FormLabel>
                      <FormControl><Textarea placeholder="Production capacity, breeds, facilities..." {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <Button type="submit" className="w-full" disabled={createFarmMutation.isPending}>
                    {createFarmMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Complete Registration
                  </Button>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
