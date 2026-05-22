import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import LocationAutocomplete from "./LocationAutocomplete";

const autocompleteResponse = (mainText: string, fullText = mainText) =>
  Promise.resolve({
    ok: true,
    json: () =>
      Promise.resolve({
        suggestions: [
          {
            placePrediction: {
              placeId: "place-1",
              structuredFormat: {
                mainText: { text: mainText },
                secondaryText: { text: "Italia" },
              },
              text: { text: fullText },
            },
          },
        ],
      }),
  } as Response);

const placeDetailsResponse = Promise.resolve({
  ok: true,
  json: () =>
    Promise.resolve({
      formattedAddress: "Roma, RM, Italia",
      location: { latitude: 41.9028, longitude: 12.4964 },
    }),
} as Response);

describe("LocationAutocomplete", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps the suggestions list closed after selecting a place while a stale search is pending", async () => {
    let resolveStaleSearch: (value: Response) => void = () => {};
    const staleSearch = new Promise<Response>((resolve) => {
      resolveStaleSearch = resolve;
    });
    const onChange = vi.fn();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation((input) => {
        const url = String(input);
        if (url.includes("places:autocomplete")) {
          return fetchMock.mock.calls.filter(([callInput]) =>
            String(callInput).includes("places:autocomplete")
          ).length === 1
            ? autocompleteResponse("Roma", "Roma, Italia")
            : staleSearch;
        }

        return placeDetailsResponse;
      });

    render(<LocationAutocomplete value="" onChange={onChange} />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "rom" } });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350));
    });

    expect(await screen.findByText("Roma")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "roma" } });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350));
    });

    fireEvent.click(screen.getByText("Roma"));

    await waitFor(() => {
      expect(screen.queryByText("Roma")).not.toBeInTheDocument();
    });

    await act(async () => {
      resolveStaleSearch(await autocompleteResponse("Roma"));
    });

    await waitFor(() => {
      expect(screen.queryByText("Roma")).not.toBeInTheDocument();
    });
    expect(onChange).toHaveBeenCalledWith("Roma, RM, Italia", 41.9028, 12.4964);
  });
});
