import { useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import { subscribeIncomingCalls } from "@/src/api/supa";

// Subscribes the logged-in user to incoming calls and navigates to the
// incoming call screen when someone calls them.
export function useIncomingCall() {
  const router = useRouter();
  const busy = useRef(false);
  useEffect(() => {
    let channel: any;
    (async () => {
      channel = await subscribeIncomingCalls((call) => {
        if (busy.current) return;
        busy.current = true;
        router.push({
          pathname: "/call/[id]",
          params: {
            id: call.call_id,
            type: call.type,
            name: call.display_name,
            emoji: call.avatar,
            incoming: "1",
          },
        });
        setTimeout(() => { busy.current = false; }, 4000);
      });
    })();
    return () => { try { channel && channel.unsubscribe(); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
