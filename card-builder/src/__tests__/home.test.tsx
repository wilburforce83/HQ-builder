import { render, screen } from "@testing-library/react";

import HomePage from "@/app/page";

describe("Homepage routing", () => {
  it("renders navigation links", () => {
    render(<HomePage />);

    expect(screen.getByRole("link", { name: /play quest/i })).toHaveAttribute("href", "/play");
    expect(screen.getByRole("link", { name: /quest builder/i })).toHaveAttribute(
      "href",
      "/quest-builder",
    );
    expect(screen.getByRole("link", { name: /card builder/i })).toHaveAttribute(
      "href",
      "/cards",
    );
  });
});
