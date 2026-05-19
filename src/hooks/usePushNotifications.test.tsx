import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { usePushNotifications } from "./usePushNotifications";

const oneSignalMocks = vi.hoisted(() => {
  const pushSubscription = {
    optedIn: false,
    id: "player-1",
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    optIn: vi.fn(async () => {
      pushSubscription.optedIn = true;
    }),
    optOut: vi.fn(async () => {
      pushSubscription.optedIn = false;
    }),
  };

  return {
    init: vi.fn(async () => undefined),
    login: vi.fn(async () => undefined),
    pushSubscription,
    requestPermission: vi.fn(async () => undefined),
  };
});

const supabaseMocks = vi.hoisted(() => ({
  upsert: vi.fn(async () => ({ error: null })),
}));

vi.mock("react-onesignal", () => ({
  default: {
    init: oneSignalMocks.init,
    login: oneSignalMocks.login,
    Notifications: {
      requestPermission: oneSignalMocks.requestPermission,
    },
    User: {
      PushSubscription: oneSignalMocks.pushSubscription,
    },
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      upsert: supabaseMocks.upsert,
    }),
  },
}));

const PushProbe = () => {
  const { isSupported, canManagePush, isSubscribed, subscribe } = usePushNotifications();

  return (
    <div>
      <span>{isSupported ? "supported" : "unsupported"}</span>
      <span>{canManagePush ? "manageable" : "blocked"}</span>
      <span>{isSubscribed ? "subscribed" : "unsubscribed"}</span>
      <button type="button" disabled={!isSupported} onClick={() => void subscribe()}>
        subscribe
      </button>
    </div>
  );
};

describe("usePushNotifications", () => {
  it("does not initialize OneSignal until push management is explicitly requested", async () => {
    Object.defineProperty(navigator, "serviceWorker", {
      value: {},
      configurable: true,
    });
    Object.defineProperty(window, "Notification", {
      value: { permission: "granted" },
      configurable: true,
    });

    render(<PushProbe />);

    expect(await screen.findByText("supported")).toBeInTheDocument();
    expect(await screen.findByText("manageable")).toBeInTheDocument();
    expect(screen.getByText("unsubscribed")).toBeInTheDocument();
    expect(oneSignalMocks.init).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "subscribe" }));

    await waitFor(() => expect(oneSignalMocks.init).toHaveBeenCalledTimes(1));
    expect(oneSignalMocks.init).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/push/onesignal/",
        serviceWorkerPath: "OneSignalSDKWorker.js",
        serviceWorkerParam: { scope: "/push/onesignal/" },
      })
    );
    expect(oneSignalMocks.requestPermission).toHaveBeenCalledTimes(1);
    expect(oneSignalMocks.pushSubscription.optIn).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("subscribed")).toBeInTheDocument();
  });
});
