import { fireEvent, render, screen } from "@testing-library/react";
import EventAnalytics from "./EventAnalytics";

describe("EventAnalytics", () => {
  it("shows cancelled registrations with cancellation date and formula name only", () => {
    render(
      <EventAnalytics
        event={{
          date: "2026-06-20",
          spots_total: 12,
          spots_taken: 4,
          created_at: "2026-06-01T09:00:00",
        }}
        meetingPoints={[]}
        priceOptions={[{
          id: "formula-tesserati",
          name: "Formula tesserati",
          price: 39,
        }]}
        registrations={[{
          id: "registration-1",
          created_at: "2026-06-02T10:00:00",
          cancelled_at: "2026-06-04T18:12:00",
          status: "cancelled",
          checked_in: false,
          meeting_point_id: null,
          price_option_id: "formula-tesserati",
          profiles: {
            first_name: "Mario",
            last_name: "Rossi",
          },
        }]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Cancellati/i }));

    expect(screen.getByText("Mario Rossi")).toBeInTheDocument();
    expect(screen.getByText("04/06/2026 18:12")).toBeInTheDocument();
    expect(screen.getByText("Formula tesserati")).toBeInTheDocument();
    expect(screen.queryByText(/39/)).not.toBeInTheDocument();
  });
});
