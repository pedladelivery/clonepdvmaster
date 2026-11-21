import { useEffect, useState, ImgHTMLAttributes } from "react";
import { supabase } from "@/integrations/supabase/client";

const MARKER = "/storage/v1/object/public/";
const LS_KEY = "pdv_signed_urls_v1";
const TTL = 60 * 60 * 24 * 7; // seconds
const REUSE_MS = 1000 * 60 * 60 * 24 * 6; // reuse for 6 days

type Entry = { u: string; t: number };
const cache = new Map<string, string>();
try {
  const raw = JSON.parse(localStorage.getItem(LS_KEY) || "{}") as Record<string, Entry>;
  const now = Date.now();
  for (const [k, v] of Object.entries(raw)) if (now - v.t < REUSE_MS) cache.set(k, v.u);
} catch { /* ignore */ }

let persistTimer: ReturnType<typeof setTimeout> | null = null;
const stamps = new Map<string, number>();
function persist() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    try {
      const prev = JSON.parse(localStorage.getItem(LS_KEY) || "{}") as Record<string, Entry>;
      for (const [k, u] of cache) prev[k] = { u, t: stamps.get(k) ?? prev[k]?.t ?? Date.now() };
      localStorage.setItem(LS_KEY, JSON.stringify(prev));
    } catch { /* ignore */ }
  }, 500);
}

// Batch signing: one request per bucket for all images on screen
const pending = new Map<string, Map<string, { url: string; resolvers: ((s: string) => void)[] }>>();
const inflight = new Map<string, Promise<string>>();
let flushScheduled = false;

function flush() {
  flushScheduled = false;
  const batches = Array.from(pending.entries());
  pending.clear();
  for (const [bucket, items] of batches) {
    const paths = Array.from(items.keys());
    supabase.storage.from(bucket).createSignedUrls(paths, TTL).then(({ data }) => {
      const byPath = new Map((data || []).map((d: any) => [d.path, d.signedUrl as string | null]));
      for (const [path, item] of items) {
        const signed = byPath.get(path) || item.url;
        if (byPath.get(path)) {
          cache.set(item.url, signed);
          stamps.set(item.url, Date.now());
        }
        inflight.delete(item.url);
        item.resolvers.forEach((r) => r(signed));
      }
      persist();
    }, () => {
      for (const item of items.values()) {
        inflight.delete(item.url);
        item.resolvers.forEach((r) => r(item.url));
      }
    });
  }
}

function sign(url: string): Promise<string> {
  const existing = inflight.get(url);
  if (existing) return existing;
  const idx = url.indexOf(MARKER);
  const rest = decodeURIComponent(url.slice(idx + MARKER.length).split("?")[0]);
  const slash = rest.indexOf("/");
  const bucket = rest.slice(0, slash);
  const path = rest.slice(slash + 1);
  const p = new Promise<string>((resolve) => {
    if (!pending.has(bucket)) pending.set(bucket, new Map());
    const m = pending.get(bucket)!;
    if (!m.has(path)) m.set(path, { url, resolvers: [] });
    m.get(path)!.resolvers.push(resolve);
    if (!flushScheduled) {
      flushScheduled = true;
      setTimeout(flush, 0);
    }
  });
  inflight.set(url, p);
  return p;
}

/** Resolves public-style URLs of private buckets into signed URLs (batched + cached). */
export function useStorageUrl(url: string | null | undefined) {
  const [resolved, setResolved] = useState<string | undefined>(
    url && !url.includes(MARKER) ? url : url ? cache.get(url) : undefined
  );
  useEffect(() => {
    if (!url) return setResolved(undefined);
    if (!url.includes(MARKER)) return setResolved(url);
    if (cache.has(url)) return setResolved(cache.get(url));
    let alive = true;
    sign(url).then((s) => { if (alive) setResolved(s); });
    return () => { alive = false; };
  }, [url]);
  return resolved;
}

export function StorageImage({ src, ...rest }: ImgHTMLAttributes<HTMLImageElement>) {
  const resolved = useStorageUrl(src);
  if (!resolved) return null;
  return <img src={resolved} decoding="async" {...rest} />;
}
