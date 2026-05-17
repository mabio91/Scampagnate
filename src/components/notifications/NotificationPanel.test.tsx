import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NotificationPanel from "./NotificationPanel";
import { useMarkAllAsRead, useMarkAsRead, useNotifications } from "@/hooks/useNotifications";

vi.mock("@/hooks/useNotifications", () => ({
  useNotifications: vi.fn(),
  useMarkAsRead: vi.fn(),
  useMarkAllAsRead: vi.fn(),
}));

vi.mock("@/hooks/usePushNotifications", () => ({
  usePushNotifications: () => ({
    isSupported: false,
    canManagePush: false,
    isSubscribed: false,
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    isLoading: false,
    errorMessage: null,
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    language: "it",
    t: (key: string) =>
      ({
        notifications: "Notifiche",
        noNotifications: "Nessuna notifica",
        markAll: "Segna tutte",
        push: "Push",
        pushOn: "Push ON",
      })[key] ?? key,
  }),
}));

const notification = {
  id: "notification-1",
  user_id: "user-1",
  type: "event_update",
  title: "Cambio programma",
  message: "Il punto di ritrovo e stato aggiornato.",
  event_id: "event-1",
  read: false,
  created_at: new Date("2026-05-17T08:00:00.000Z").toISOString(),
};

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
};

const renderPanel = (onClose = vi.fn()) => {
  render(
    <MemoryRouter initialEntries={["/"]}>
      <NotificationPanel onClose={onClose} />
      <LocationProbe />
    </MemoryRouter>,
  );

  return { onClose };
};

describe("NotificationPanel", () => {
  const markAsRead = vi.fn();
  const markAllAsRead = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useNotifications).mockReturnValue({
      data: [notification],
      isLoading: false,
    } as unknown as ReturnType<typeof useNotifications>);
    vi.mocked(useMarkAsRead).mockReturnValue({ mutate: markAsRead } as unknown as ReturnType<typeof useMarkAsRead>);
    vi.mocked(useMarkAllAsRead).mockReturnValue({ mutate: markAllAsRead } as unknown as ReturnType<typeof useMarkAllAsRead>);
  });

  it("opens the notification detail in-place without navigating away", () => {
    const { onClose } = renderPanel();

    fireEvent.click(screen.getByText("Cambio programma").closest("button")!);

    expect(markAsRead).toHaveBeenCalledWith("notification-1");
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId("location")).toHaveTextContent("/");
    expect(screen.getByRole("button", { name: "Apri evento" })).toBeInTheDocument();
  });

  it("navigates to the event only from the explicit detail action", () => {
    const { onClose } = renderPanel();

    fireEvent.click(screen.getByText("Cambio programma").closest("button")!);
    fireEvent.click(screen.getByRole("button", { name: "Apri evento" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("location")).toHaveTextContent("/event/event-1");
  });
});
