"use client";

import { useEffect } from "react";

export function TrackSlotVisit({ slotId }: Readonly<{ slotId: string }>) {
  useEffect(() => {
    void fetch("/api/player/lobby-state", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slotId }),
      keepalive: true,
    });
  }, [slotId]);
  return null;
}
