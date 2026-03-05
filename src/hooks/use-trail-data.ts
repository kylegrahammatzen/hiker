import { useEffect, useState } from "react";
import type { WeatherForecast } from "@/app/api/weather/route";
import type { WildlifeData } from "@/app/api/wildlife/route";
import type { AlertsData } from "@/app/api/alerts/route";

type AsyncState<T> = { data: T | null; loading: boolean; error: string | null };

function useFetch<T>(url: string | null): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ data: null, loading: false, error: null });

  useEffect(() => {
    if (!url) {
      setState({ data: null, loading: false, error: null });
      return;
    }

    let cancelled = false;
    setState({ data: null, loading: true, error: null });

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<T>;
      })
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((err) => {
        if (!cancelled) setState({ data: null, loading: false, error: err.message });
      });

    return () => { cancelled = true };
  }, [url]);

  return state;
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
