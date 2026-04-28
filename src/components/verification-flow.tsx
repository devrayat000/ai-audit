"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { CodeSnippet } from "./code-snippet";
import { Check, Globe2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Method = "dns-txt" | "meta-tag";

export interface VerifiedState {
  proof: string;
  method: Method;
  expiresAt: string;
}

interface IssuedToken {
  token: string;
  domain: string;
  expiresAt: string;
  dnsRecord: { name: string; type: string; value: string };
  metaTag: string;
}

interface Props {
  domain: string;
  rootUrl: string;
  onVerified: (v: VerifiedState) => void;
}

export function VerificationFlow({ domain, rootUrl, onVerified }: Props) {
  const [method, setMethod] = useState<Method>("meta-tag");
  const [issued, setIssued] = useState<IssuedToken | null>(null);
  const [issuing, setIssuing] = useState(false);
  const [checking, setChecking] = useState(false);
  const [verified, setVerified] = useState<VerifiedState | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const issue = async () => {
    setIssuing(true);
    setError(null);
    try {
      const r = await fetch("/api/verify/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Failed to issue token");
      setIssued(j as IssuedToken);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to issue token");
    } finally {
      setIssuing(false);
    }
  };

  const check = async () => {
    if (!issued) return;
    setChecking(true);
    setError(null);
    setMessage(null);
    try {
      const r = await fetch("/api/verify/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: issued.token,
          method,
          domain,
          rootUrl,
        }),
      });
      const j = await r.json();
      if (j.status === "verified") {
        const v: VerifiedState = { proof: j.proof, method, expiresAt: j.expiresAt };
        setVerified(v);
        setMessage("Verified.");
        onVerified(v);
      } else if (j.status === "pending") {
        setMessage(j.message ?? "Not yet visible. Add the record and try again in a moment.");
      } else {
        setError(j.message ?? j.error ?? "Verification failed");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setChecking(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe2 className="size-5" />
          Verify domain ownership
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Regeneration is gated behind ownership of <span className="font-mono">{domain}</span>. Pick one method.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button
            type="button"
            variant={method === "meta-tag" ? "default" : "outline"}
            onClick={() => setMethod("meta-tag")}
            size="sm"
          >
            Meta tag (easiest)
          </Button>
          <Button
            type="button"
            variant={method === "dns-txt" ? "default" : "outline"}
            onClick={() => setMethod("dns-txt")}
            size="sm"
          >
            DNS TXT record
          </Button>
        </div>

        {!issued && (
          <Button type="button" onClick={issue} disabled={issuing}>
            {issuing ? <Loader2 className="size-4 animate-spin" /> : null}
            Issue verification token
          </Button>
        )}

        {issued && method === "meta-tag" && (
          <div className="space-y-2">
            <p className="text-sm">Add this <code className="font-mono">&lt;meta&gt;</code> tag inside the <code className="font-mono">&lt;head&gt;</code> of your homepage:</p>
            <CodeSnippet code={issued.metaTag} language="html" title="meta tag" />
            <p className="text-xs text-muted-foreground">
              Expires {new Date(issued.expiresAt).toLocaleString()}.
            </p>
          </div>
        )}

        {issued && method === "dns-txt" && (
          <div className="space-y-2">
            <p className="text-sm">Add this DNS TXT record:</p>
            <CodeSnippet
              title="DNS TXT record"
              language="txt"
              code={`Name:  ${issued.dnsRecord.name}\nType:  TXT\nValue: ${issued.dnsRecord.value}`}
            />
            <p className="text-xs text-muted-foreground">
              DNS may take a few minutes to propagate. Expires {new Date(issued.expiresAt).toLocaleString()}.
            </p>
          </div>
        )}

        {issued && (
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" onClick={check} disabled={checking}>
              {checking ? <Loader2 className="size-4 animate-spin" /> : null}
              Check verification
            </Button>
            {verified && (
              <span className={cn("inline-flex items-center gap-1 text-sm text-success")}>
                <Check className="size-4" /> Verified · {verified.method}
              </span>
            )}
          </div>
        )}

        {message && !verified && <p className="text-sm text-muted-foreground">{message}</p>}
        {error && <p className="text-sm text-danger">{error}</p>}
      </CardContent>
    </Card>
  );
}
