"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { CheckCircle2, ExternalLink, Loader2, Rocket, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  zipBase64: string;
  projectNameSeed: string;
  acknowledged: boolean;
}

interface DeployEvent {
  type: string;
  payload?: unknown;
}

interface ProgressItem {
  type: string;
  message: string;
  ts: number;
}

const NICE_LABELS: Record<string, string> = {
  preparing: "Decoding bundle",
  prepared: "Bundle ready",
  "deploy-started": "Talking to Vercel",
  "hashes-calculated": "Hashing files",
  "file-count": "Counting files",
  "file-uploaded": "Uploading file",
  "files-uploaded": "Files uploaded",
  created: "Deployment created",
  building: "Building",
  ready: "Ready",
  "alias-assigned": "Alias assigned",
  error: "Error",
  canceled: "Canceled",
  warning: "Warning",
  notice: "Notice",
  tip: "Tip",
  done: "Finished",
};

function pickUrl(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.url === "string") return p.url.startsWith("http") ? p.url : `https://${p.url}`;
  if (typeof p.alias === "string") return `https://${p.alias}`;
  if (Array.isArray(p.alias) && typeof p.alias[0] === "string") return `https://${p.alias[0]}`;
  if (p.deployment && typeof p.deployment === "object") {
    return pickUrl(p.deployment);
  }
  return null;
}

function describe(ev: DeployEvent): string {
  const label = NICE_LABELS[ev.type] ?? ev.type;
  const p = ev.payload as Record<string, unknown> | undefined;
  if (ev.type === "file-uploaded" && p && typeof p.file === "string") {
    return `Uploaded ${p.file}`;
  }
  if (ev.type === "file-count" && p && typeof p.total === "number") {
    return `Counting files (${p.total})`;
  }
  if (ev.type === "prepared" && p && typeof p.fileCount === "number") {
    return `Bundle ready (${p.fileCount} files)`;
  }
  if (ev.type === "deploy-started" && p && typeof p.projectName === "string") {
    return `Deploying as "${p.projectName}"`;
  }
  if (ev.type === "error" && p && typeof p.message === "string") {
    return `Error: ${p.message}`;
  }
  if (ev.type === "ready") {
    return "Deployment ready";
  }
  return label;
}

export function DeployToVercel({ zipBase64, projectNameSeed, acknowledged }: Props) {
  const [busy, setBusy] = useState(false);
  const [events, setEvents] = useState<ProgressItem[]>([]);
  const [deploymentUrl, setDeploymentUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const run = async () => {
    setBusy(true);
    setEvents([]);
    setDeploymentUrl(null);
    setErrorMsg(null);
    setDone(false);
    try {
      const r = await fetch("/api/regenerate/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zipBase64, projectNameSeed }),
      });
      if (!r.ok || !r.body) {
        const j = await r.json().catch(() => ({}));
        setErrorMsg(j.error ?? `Deploy request failed (${r.status})`);
        setBusy(false);
        return;
      }
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done: end, value } = await reader.read();
        if (end) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          const json = line.slice(6);
          let ev: DeployEvent;
          try {
            ev = JSON.parse(json) as DeployEvent;
          } catch {
            continue;
          }
          setEvents((prev) => [...prev, { type: ev.type, message: describe(ev), ts: Date.now() }]);
          if (ev.type === "error") {
            const msg =
              ev.payload && typeof ev.payload === "object" && "message" in (ev.payload as object)
                ? String((ev.payload as { message: unknown }).message)
                : "Vercel reported an error";
            setErrorMsg(msg);
          }
          const maybeUrl = pickUrl(ev.payload);
          if (maybeUrl && (ev.type === "ready" || ev.type === "alias-assigned" || ev.type === "created")) {
            setDeploymentUrl(maybeUrl);
          }
          if (ev.type === "done") setDone(true);
        }
      }
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Network error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle>One-click deploy to Vercel</CardTitle>
          {deploymentUrl && (
            <a
              href={deploymentUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm font-mono text-success hover:underline"
            >
              {deploymentUrl} <ExternalLink className="size-3" />
            </a>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Deploys the regenerated bundle to a fresh Vercel project under the configured account.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={run} disabled={!acknowledged || busy} size="lg">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
            {busy ? "Deploying…" : deploymentUrl ? "Re-deploy" : "Deploy to Vercel"}
          </Button>
          {!acknowledged && (
            <span className="text-xs text-muted-foreground">
              Confirm the human-review checkbox above to enable.
            </span>
          )}
        </div>

        {events.length > 0 && (
          <div className="rounded-md border border-border bg-paper p-3 max-h-60 overflow-auto text-xs font-mono space-y-1">
            {events.map((e, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-start gap-2",
                  e.type === "error" && "text-danger",
                  (e.type === "ready" || e.type === "alias-assigned") && "text-success",
                )}
              >
                <span className="opacity-60 shrink-0">[{new Date(e.ts).toLocaleTimeString()}]</span>
                <span>{e.message}</span>
              </div>
            ))}
          </div>
        )}

        {errorMsg && (
          <div className="flex items-start gap-2 text-sm text-danger">
            <XCircle className="size-4 mt-0.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {done && deploymentUrl && !errorMsg && (
          <div className="flex items-start gap-2 text-sm text-success">
            <CheckCircle2 className="size-4 mt-0.5 shrink-0" />
            <span>
              Live at{" "}
              <a href={deploymentUrl} target="_blank" rel="noreferrer" className="underline">
                {deploymentUrl}
              </a>
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
