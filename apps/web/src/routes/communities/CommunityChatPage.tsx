import { useState } from "react";
import { useParams } from "react-router-dom";
import MultiChannelChatPanel, { type MCCPChannel } from "../../features/chat/MultiChannelChatPanel";

type Params = { slug: string };

const PLACEHOLDER_CHANNELS: MCCPChannel[] = [
  { id: "placeholder-general", name: "general", visibility: "PUBLIC" },
  { id: "placeholder-lfg", name: "lfg", visibility: "PUBLIC" },
  { id: "placeholder-mod-lounge", name: "mod-lounge", visibility: "PRIVATE" },
];

export default function CommunityChatPage() {
  const { slug } = useParams<Params>();
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(PLACEHOLDER_CHANNELS[0]?.id ?? null);
  const communityName = slug ?? "Unknown community";

  return (
    <main className="h-screen w-full pt-[57px] text-[color:var(--text)]">
      <div className="h-full min-h-0 border-t border-[color:var(--line)]">
        <MultiChannelChatPanel
          selectedChannelId={selectedChannelId}
          onSelectedChannelIdChange={setSelectedChannelId}
          communityName={communityName}
          channels={PLACEHOLDER_CHANNELS}
        />
      </div>
    </main>
  );
}
