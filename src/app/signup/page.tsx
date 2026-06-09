"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, Suspense } from "react";
import { signIn, signUp } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Loader2 } from "lucide-react";

function SignupContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const auditId = searchParams.get("auditId");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("password123"); // Simplified credential auth
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCredentialsAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError(null);
    try {
      // Try to sign up, if user already exists sign them in.
      const res = await signUp.email({
        email,
        password,
        name: email.split("@")[0],
      });
      if (res.error) {
        // Assume user might exist, try to sign in
        const inRes = await signIn.email({
          email,
          password,
        });
        if (inRes.error) {
          throw new Error(inRes.error.message || "Authentication failed.");
        }
      }
      // Redirect to customize page
      router.push(auditId ? `/customize/${auditId}` : "/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication error.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    setError(null);
    try {
      await signIn.social({
        provider: "google",
        callbackURL: auditId
          ? `${window.location.origin}/customize/${auditId}`
          : `${window.location.origin}/`,
      });
    } catch (err) {
      setError("Failed to initialize Google login.");
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-120px)] pt-16 pb-10 px-4">
      <Card className="w-full max-w-md border border-border shadow-lg p-6">
        <CardHeader className="text-center pb-4 space-y-2">
          <div className="flex items-center justify-center gap-1.5 font-bold text-2xl">
            <span className="text-danger">●</span> AIVIBLE
          </div>
          <CardTitle className="text-xl font-bold">Create your AIVIBLE account</CardTitle>
          <p className="text-sm text-muted-foreground">To build your AI-optimized website</p>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="bg-success/5 border border-success/15 rounded-xl px-4 py-3 text-xs text-success flex items-start gap-2">
            <span className="font-bold">✓</span>
            <span>No credit card needed. Your existing website will not be changed. Cancel any time.</span>
          </div>

          {/* GOOGLE SOCIAL LOGIN */}
          <Button
            onClick={handleGoogleAuth}
            variant="outline"
            className="w-full flex items-center justify-center gap-3 py-3 border border-border hover:border-accent-brand hover:shadow-sm transition-all rounded-xl"
            disabled={loading}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
                fill="#4285F4"
              />
              <path
                d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.909-2.259c-.806.54-1.837.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"
                fill="#34A853"
              />
              <path
                d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z"
                fill="#FBBC05"
              />
              <path
                d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"
                fill="#EA4335"
              />
            </svg>
            <span>Continue with Google</span>
          </Button>

          <div className="relative my-4 flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <span className="relative text-xs text-muted-foreground bg-background px-3 font-mono">or</span>
          </div>

          {/* EMAIL LOGIN / SIGNUP */}
          <form onSubmit={handleCredentialsAuth} className="space-y-3">
            <Input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl"
              required
              disabled={loading}
            />
            <Button
              type="submit"
              className="w-full py-2.5 rounded-xl font-semibold bg-foreground text-background hover:bg-foreground/85"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  Authenticating...
                </>
              ) : (
                "Continue with email"
              )}
            </Button>
          </form>

          {error && <p className="text-xs text-danger text-center font-medium">{error}</p>}

          <p className="text-center text-xs text-muted-foreground pt-2">
            By signing up you agree to our{" "}
            <a href="#" className="text-accent-brand hover:underline">
              Terms
            </a>{" "}
            &amp;{" "}
            <a href="#" className="text-accent-brand hover:underline">
              Privacy Policy
            </a>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SignupPage() {
  return (
    <div className="bg-muted/30 text-foreground min-h-screen">
      <header className="bg-background border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-1.5 font-bold text-xl">
            <span className="text-danger">●</span> AIVIBLE
          </Link>
        </div>
      </header>
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-[calc(100vh-120px)]">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      }>
        <SignupContent />
      </Suspense>
    </div>
  );
}
