import { useEffect, useState } from "react";
import type { WeatherForecast } from "@/app/api/weather/route";
import type { WildlifeData } from "@/app/api/wildlife/route";
import type { AlertsData } from "@/app/api/alerts/route";

type AsyncState<T> = { data: T | null; loading: boolean; error: string | null };
type FetchResult<T> = { url: string; data: T | null; error: string | null };

const IDLE_STATE = { data: null, loading: false, error: null } as const;

function useFetch<T>(url: string | null): AsyncState<T> {
  const [result, setResult] = useState<FetchResult<T> | null>(null);

  useEffect(() => {
    if (!url) return;

    let cancelled = false;

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<T>;
      })
      .then((data) => {
        if (!cancelled) setResult({ url, data, error: null });
      })
      .catch((err) => {
        if (!cancelled) setResult({ url, data: null, error: err.message });
      });

    return () => { cancelled = true };
  }, [url]);

  if (!url) return IDLE_STATE;
  if (result?.url === url) {
    return { data: result.data, loading: false, error: result.error };
  }

  return { data: null, loading: true, error: null };
}

export function useWeather(lat: number | undefined, lng: number | undefined) {
  const url = lat != null && lng != null
    ? `/api/weather?lat=${lat}&lng=${lng}`
    : null;
  return useFetch<WeatherForecast>(url);
}

export function useWildlife(lat: number | undefined, lng: number | undefined) {
  const url = lat != null && lng != null
    ? `/api/wildlife?lat=${lat}&lng=${lng}`
    : null;
  return useFetch<WildlifeData>(url);
}

export function useAlerts(parkCode: string | undefined) {
  const url = parkCode ? `/api/alerts?parkCode=${parkCode}` : null;
  return useFetch<AlertsData>(url);
}
