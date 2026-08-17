import React, { createContext, useContext, useMemo, useState, useEffect } from "react";

import { useAuth } from "@/src/context/AuthContext";
import { channelsForRole, Channel } from "@/src/utils/channels";

type ChannelState = {
  channels: Channel[];
  channelId: string;
  setChannelId: (id: string) => void;
  current: Channel;
  keys: string[];
  isAll: boolean;
};

const Ctx = createContext<ChannelState | undefined>(undefined);

export function ChannelProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const channels = useMemo(() => channelsForRole(user?.role ?? ""), [user?.role]);
  const [channelId, setChannelId] = useState<string>(channels[0]?.id ?? "all");

  // Reset to default when role/channels change.
  useEffect(() => {
    setChannelId(channels[0]?.id ?? "all");
  }, [channels]);

  const current = channels.find((c) => c.id === channelId) ?? channels[0];
  const value: ChannelState = {
    channels,
    channelId,
    setChannelId,
    current,
    keys: current?.keys ?? [],
    isAll: current?.id === "all",
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useChannel() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useChannel must be used within ChannelProvider");
  return ctx;
}
