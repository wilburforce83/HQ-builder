import { render, screen } from "@testing-library/react";

import PlayQuestList from "@/components/play/PlayQuestList";

describe("Play Quest list", () => {
  it("renders quest cards", () => {
    render(
      <PlayQuestList
        quests={[
          { id: "quest-1", title: "The Trial", updatedAt: Date.now() },
          { id: "quest-2", title: "Into the Dark", updatedAt: Date.now() },
        ]}
      />,
    );

    expect(screen.getByText("The Trial")).toBeInTheDocument();
    expect(screen.getByText("Into the Dark")).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });
});
