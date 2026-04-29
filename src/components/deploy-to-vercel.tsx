"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  Rocket,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

import type { RegenZipRef } from "@/lib/regenerator/types";

interface Props {
  zip: RegenZipRef;
  projectNameSeed: string;
  acknowledged: boolean;
}

interface ProgressItem {
  type: string;
  message: string;
  ts: number;
}

function pickUrl(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.url === "string")
    return p.url.startsWith("http") ? p.url : `https://${p.url}`;
  if (typeof p.alias === "string") return `https://${p.alias}`;
  if (Array.isArray(p.alias) && typeof p.alias[0] === "string")
    return `https://${p.alias[0]}`;
  if (p.deployment && typeof p.deployment === "object") {
    return pickUrl(p.deployment);
  }
  return null;
}

function isDoneLine(line: string): boolean {
  return line === "[DONE]" || line === "data: [DONE]";
}

function parseStreamLine(line: string): unknown | null {
  if (!line) return null;
  if (line.startsWith(":")) return null;
  const payload = line.startsWith("data:") ? line.slice(5).trim() : line;
  if (!payload || payload === "[DONE]") return null;
  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

function isDeployStreamStatus(value: unknown): value is {
  state?: string;
  message?: string;
  progress?: number;
  meta?: unknown;
  result?: unknown;
  error?: unknown;
} {
  return !!value && typeof value === "object";
}

export function DeployToVercel({ zip, projectNameSeed, acknowledged }: Props) {
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
      const payload = zip.url
        ? { zipUrl: zip.url, projectNameSeed }
        : { zipBase64: zip.base64, projectNameSeed };
      const r = await fetch("/api/regenerate/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setErrorMsg(j.error ?? `Deploy request failed (${r.status})`);
        setBusy(false);
        return;
      }
      if (!r.body) {
        setErrorMsg("No response stream from deploy.");
        return;
      }
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finished = false;
      let lastMessage = "";

      while (!finished) {
        const { value, done: streamDone } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });
        let idx = buffer.indexOf("\n");
        while (idx >= 0) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          if (isDoneLine(line)) {
            finished = true;
            break;
          }
          const payload = parseStreamLine(line);
          if (payload && isDeployStreamStatus(payload)) {
            const message =
              typeof payload.message === "string"
                ? payload.message
                : "Working…";
            const meta =
              payload.meta && typeof payload.meta === "object"
                ? (payload.meta as Record<string, unknown>)
                : undefined;
            const type =
              typeof meta?.type === "string"
                ? meta.type
                : typeof payload.state === "string"
                  ? payload.state
                  : "notice";
            if (message !== lastMessage) {
              setEvents((prev) => [...prev, { type, message, ts: Date.now() }]);
              lastMessage = message;
            }
            const maybeUrl = pickUrl(meta ?? payload.result);
            if (maybeUrl) setDeploymentUrl(maybeUrl);
            if (payload.state === "completed") {
              if (payload.result && typeof payload.result === "object") {
                const result = payload.result as Record<string, unknown>;
                if (typeof result.deploymentUrl === "string") {
                  setDeploymentUrl(result.deploymentUrl);
                }
              }
              setDone(true);
              finished = true;
              break;
            }
            if (payload.state === "failed") {
              setErrorMsg(
                typeof payload.error === "string"
                  ? payload.error
                  : "Deploy failed",
              );
              finished = true;
              break;
            }
          }
          idx = buffer.indexOf("\n");
        }
      }

      if (finished) await reader.cancel();
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
          Deploys the regenerated bundle to a fresh Vercel project under the
          configured account.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={run} disabled={!acknowledged || busy} size="lg">
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Rocket className="size-4" />
            )}
            {busy
              ? "Deploying…"
              : deploymentUrl
                ? "Re-deploy"
                : "Deploy to Vercel"}
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
                  (e.type === "ready" || e.type === "alias-assigned") &&
                    "text-success",
                )}
              >
                <span className="opacity-60 shrink-0">
                  [{new Date(e.ts).toLocaleTimeString()}]
                </span>
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
              <a
                href={deploymentUrl}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                {deploymentUrl}
              </a>
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
