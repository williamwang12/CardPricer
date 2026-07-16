"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import {
  SUPPORTED_CURRENCIES,
  formatPrice,
  type CurrencyCode,
} from "@/lib/currency";

interface CurrencyContextValue {
  currency: CurrencyCode;
  setCurrency: (code: CurrencyCode) => void;
  rate: number;
  fmt: (price: number | null) => string;
}

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: "USD",
  setCurrency: () => {},
  rate: 1,
  fmt: (price) => formatPrice(price, "USD", 1),
});

const STORAGE_KEY = "cardparser-currency";

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>("USD");
  const [rates, setRates] = useState<Record<string, number>>({});

  // Load preference from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && stored in SUPPORTED_CURRENCIES) {
        setCurrencyState(stored as CurrencyCode);
      }
    } catch {
      // localStorage unavailable
    }
  }, []);

  // Fetch exchange rates
  useEffect(() => {
    fetch("/api/exchange-rates")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.rates) setRates(data.rates);
      })
      .catch(() => {});
  }, []);

  const setCurrency = useCallback((code: CurrencyCode) => {
    setCurrencyState(code);
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      // localStorage unavailable
    }
  }, []);

  const rate = currency === "USD" ? 1 : (rates[currency] ?? 1);

  const fmt = useCallback(
    (price: number | null) => formatPrice(price, currency, rate),
    [currency, rate]
  );

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, rate, fmt }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
