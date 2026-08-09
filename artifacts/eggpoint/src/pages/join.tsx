import { useEffect, useMemo, useState } from "react";
import { Link, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Download, Share2, Egg, ArrowRight, Smartphone } from "lucide-react";

/**
 * QR / flyer landing page.
 * Deep link target: /join?ref=XXXX
 * Optimised for mobile + street activation conversion.
 */
export default function Join() {
  const search = useSearch();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const refCode = (params.get("ref") || params.get("code") || "").trim().toUpperCase();

  const [copied, setCopied] = useState(false);
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (refCode) {
      try {
        localStorage.setItem("eggpoint_ref", refCode);
      } catch {
        // ignore storage errors on restricted browsers
      }
    }
  }, [refCode]);

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/join${refCode ? `?ref=${refCode}` : ""}`
      : "";

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl || window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select text via prompt
      window.prompt("Copy this link:", shareUrl || window.location.href);
    }
  }

  return (
    <div className="w-full bg-background">
      {/* Hero — ₦15 claim */}
      <section className="bg-card border-b border-border py-12 sm:py-16">
        <div className="max-w-lg mx-auto px-4 text-center">
          <Badge className="mb-4 text-sm px-3 py-1" variant="default">
            Street activation
          </Badge>
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Egg className="w-8 h-8 text-primary" />
            </div>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground mb-3">
            Eggs at <span className="text-primary">₦15</span>
          </h1>
          <p className="text-muted-foreground text-lg mb-2">
            We intercept healthy eggs before they spoil and move them fast through our physical network.
          </p>
          {refCode ? (
            <p className="text-sm text-primary font-medium mt-3">
              Invited by code <span className="font-mono">{refCode}</span>
            </p>
          ) : null}
        </div>
      </section>

      {/* How to earn — flyer promise */}
      <section className="py-10 sm:py-14">
        <div className="max-w-lg mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-2">Make money in 4 simple steps</h2>
          <p className="text-center text-muted-foreground mb-8 text-sm">
            Install · Sign up · Refer a buyer · Earn when they complete their first order
          </p>

          <ol className="space-y-4">
            {[
              {
                icon: Smartphone,
                title: "Install EggPoint",
                body: "Open this page on your phone. Bookmark it or add to home screen. Full app experience is in the browser — no Play Store wait.",
              },
              {
                icon: CheckCircle2,
                title: "Sign up (you or a buyer)",
                body: "Create your account as a buyer, or register someone else as a buyer. Your referral code is attached automatically.",
              },
              {
                icon: Share2,
                title: "Share your link",
                body: "Every user gets a unique code. Share your /join?ref=… link from the flyer or WhatsApp.",
              },
              {
                icon: Download,
                title: "Earn on first order",
                body: "When the buyer you brought completes their first verified order, you earn credit / payout per the current campaign rules.",
              },
            ].map((step, i) => (
              <li key={step.title}>
                <Card>
                  <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
                    <div className="w-10 h-10 shrink-0 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-base flex items-center gap-2">
                        <step.icon className="w-4 h-4 text-primary" />
                        {step.title}
                      </CardTitle>
                      <CardDescription className="mt-1 text-sm leading-relaxed">{step.body}</CardDescription>
                    </div>
                  </CardHeader>
                </Card>
              </li>
            ))}
          </ol>

          <div className="mt-8 space-y-3">
            <Link href={`/login${refCode ? `?ref=${refCode}` : ""}`}>
              <Button size="lg" className="w-full h-14 text-base font-semibold">
                Sign up now <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Link href="/suppliers">
              <Button size="lg" variant="outline" className="w-full h-12">
                Browse eggs first
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Quick capture for street agents */}
      <section className="py-8 bg-card border-y border-border">
        <div className="max-w-lg mx-auto px-4">
          <h3 className="font-semibold mb-3 text-center">Agent / team quick note</h3>
          <p className="text-sm text-muted-foreground text-center mb-4">
            Optional: leave a phone so ops can follow up after the activation day.
          </p>
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="agent-phone" className="sr-only">
                Phone
              </Label>
              <Input
                id="agent-phone"
                type="tel"
                placeholder="0803…"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-12"
              />
            </div>
            <Button
              className="h-12 px-6"
              variant="secondary"
              onClick={() => {
                // Lightweight capture — full API wiring in referral routes
                try {
                  const existing = JSON.parse(localStorage.getItem("eggpoint_leads") || "[]");
                  existing.push({ phone, ref: refCode, at: new Date().toISOString() });
                  localStorage.setItem("eggpoint_leads", JSON.stringify(existing));
                  setPhone("");
                  alert("Noted. We will follow up.");
                } catch {
                  alert("Could not save locally. Please sign up instead.");
                }
              }}
              disabled={!phone.trim()}
            >
              Save
            </Button>
          </div>
        </div>
      </section>

      {/* Share */}
      <section className="py-10">
        <div className="max-w-lg mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground mb-3">Share this activation link</p>
          <Button variant="outline" onClick={copyLink} className="w-full sm:w-auto">
            <Share2 className="w-4 h-4 mr-2" />
            {copied ? "Copied" : "Copy link"}
          </Button>
          {refCode ? (
            <p className="mt-4 font-mono text-xs text-muted-foreground break-all">{shareUrl}</p>
          ) : null}
        </div>
      </section>

      {/* Trust footer blurb */}
      <section className="pb-16 px-4">
        <div className="max-w-lg mx-auto text-center text-sm text-muted-foreground">
          <p>
            Research shows more eggs spoil globally than people eat daily. We focus on that waste stream — healthy eggs, moved fast, sold cheap. Questions? Sign up and message the team from your dashboard.
          </p>
          <p className="mt-4">
            <Link href="/" className="text-primary underline-offset-4 hover:underline">
              Back to EggPoint
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
