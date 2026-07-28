"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    document.documentElement.dataset.hydrated = "true";
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      void navigator.serviceWorker.register("/sw.js");
    }
    return () => {
      delete document.documentElement.dataset.hydrated;
    };
  }, []);

  return null;
}
