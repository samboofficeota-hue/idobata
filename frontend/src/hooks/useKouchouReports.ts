import { useEffect, useState } from "react";
import { kouchouApiClient } from "../services/kouchou/kouchouApiClient";
import type { KouchouReport, KouchouResult } from "../services/kouchou/types";

export function useKouchouReports() {
  const [reports, setReports] = useState<KouchouReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    kouchouApiClient
      .getReports()
      .then((data) => {
        if (!cancelled) setReports(data);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { reports, isLoading, error };
}

export function useKouchouReport(slug: string | undefined) {
  const [result, setResult] = useState<KouchouResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    kouchouApiClient
      .getReport(slug)
      .then((data) => {
        if (!cancelled) setResult(data);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return { result, isLoading, error };
}
