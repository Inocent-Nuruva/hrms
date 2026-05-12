import { useState } from "react";

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") {
      return initialValue;
    }

    try {
      const storedValue = window.localStorage.getItem(key);
      if (storedValue !== null) {
        return JSON.parse(storedValue) as T;
      }
    } catch {
      return initialValue;
    }

    return initialValue;
  });

  const updateValue = (nextValue: T) => {
    setValue(nextValue);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(key, JSON.stringify(nextValue));
    }
  };

  const removeValue = () => {
    setValue(initialValue);

    if (typeof window !== "undefined") {
      window.localStorage.removeItem(key);
    }
  };

  return [value, updateValue, removeValue] as const;
}
