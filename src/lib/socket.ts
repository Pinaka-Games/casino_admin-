import { io, Socket } from "socket.io-client";
import { getAccessToken } from "@/lib/storage";

let socket: Socket | null = null;

type InstanceSubscriber = (socket: Socket) => void;
const instanceSubscribers = new Set<InstanceSubscriber>();

/**
 * Notifies when a NEW underlying socket is created.
 *
 * SocketListener deliberately tears the connection down and rebuilds it when
 * the session changes (`disconnectSocket()` then `connectSocket()`). Anything
 * that grabbed the old instance — a component whose effect ran before that,
 * which is every child, since React runs child effects first — would be left
 * holding a dead socket and silently stop receiving events. Subscribe here to
 * move your handlers onto the replacement.
 */
export function onSocketInstance(subscriber: InstanceSubscriber) {
  instanceSubscribers.add(subscriber);
  return () => {
    instanceSubscribers.delete(subscriber);
  };
}

export function connectSocket() {
  if (socket) return socket;

  const token = getAccessToken();

  socket = io(process.env.NEXT_PUBLIC_SOCKET_URL as string, {
    // polling first so ngrok/proxies that block WebSocket upgrades still work,
    // then upgrade to websocket. websocket-only fails outright behind them.
    transports: ["polling", "websocket"],
    withCredentials: true,
    auth: {
      token: token ? `Bearer ${token}` : "",
    },
  });

  const created = socket;
  instanceSubscribers.forEach((subscriber) => {
    try {
      subscriber(created);
    } catch {
      /* one bad subscriber must not stop the others */
    }
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
