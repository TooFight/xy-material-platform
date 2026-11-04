"use client";

import { useUser } from "@/lib/user/UserProvider";

import { HistoryView } from "./HistoryView";

export function HistoryRoute() {
  const { userId } = useUser();
  return <HistoryView key={userId ?? "anonymous"} userId={userId} />;
}
