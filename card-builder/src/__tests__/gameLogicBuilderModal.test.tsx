import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import GameLogicBuilderModal from "@/components/GameLogicBuilderModal";
import { I18nProvider } from "@/i18n/I18nProvider";

const iconTargets = [
  {
    id: "icon-1",
    label: "Marker 1",
    assetId: "mark-1",
    x: 3,
    y: 4,
  },
];

const notes = [
  { id: "note-1", number: 1, text: "General" },
  { id: "note-2", number: 2, text: "Secret door" },
];

describe("GameLogicBuilderModal", () => {
  beforeEach(() => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ id: "card-1", title: "Treasure" }],
    });
    (globalThis as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("saves logic after adding an action", async () => {
    const onSave = jest.fn();

    render(
      <I18nProvider>
        <GameLogicBuilderModal
          isOpen
          onClose={jest.fn()}
          iconTargets={iconTargets}
          notes={notes}
          initialLogic={[]}
          onSave={onSave}
        />
      </I18nProvider>,
    );

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());

    const iconList = screen.getByTestId("icon-list");
    fireEvent.click(within(iconList).getByRole("button", { name: /marker 1/i }));
    fireEvent.click(screen.getByRole("button", { name: /add action/i }));
    fireEvent.click(screen.getByRole("button", { name: /save logic/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0][0];
    expect(saved[0].iconId).toBe("icon-1");
  });

  it("blocks save when actions are missing", async () => {
    render(
      <I18nProvider>
        <GameLogicBuilderModal
          isOpen
          onClose={jest.fn()}
          iconTargets={iconTargets}
          notes={notes}
          initialLogic={[]}
          onSave={jest.fn()}
        />
      </I18nProvider>,
    );

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());

    const iconList = screen.getByTestId("icon-list");
    fireEvent.click(within(iconList).getByRole("button", { name: /marker 1/i }));

    expect(await screen.findByText(/needs at least one action/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save logic/i })).toBeDisabled();
  });
});
