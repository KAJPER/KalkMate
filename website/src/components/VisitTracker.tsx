"use client";

import { useEffect } from "react";

export default function VisitTracker() {
  useEffect(() => {
    fetch("/api/admin/visits", { method: "POST" }).catch(() => {});
  }, []);

  return null;
}
