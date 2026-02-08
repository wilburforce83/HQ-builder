import {
  DEFAULT_PLAY_SESSION_STATE,
  findEntitiesInRegion,
  getVisibleRegionAt,
  playSessionReducer,
  type QuestItem,
} from "@/lib/play-session-engine";

describe("Play session engine", () => {
  it("reveals tiles and entities", () => {
    const next = playSessionReducer(DEFAULT_PLAY_SESSION_STATE, {
      type: "revealTiles",
      tiles: [{ x: 0, y: 0 }],
    });

    expect(next.discoveredTiles).toContain("0,0");

    const withEntity = playSessionReducer(next, {
      type: "revealEntity",
      entityId: "entity-1",
      card: { id: "entity-1", title: "Goblin", revealedAt: 123 },
    });

    expect(withEntity.revealedEntities).toContain("entity-1");
    expect(withEntity.revealedCards[0]?.title).toBe("Goblin");
  });

  it("finds entities within a visible region", () => {
    const items: QuestItem[] = [
      { id: "a", assetId: "monster-goblin", x: 2, y: 2, baseW: 1, baseH: 1 },
      { id: "b", assetId: "furniture-table", x: 10, y: 10, baseW: 2, baseH: 1 },
    ];
    const region = getVisibleRegionAt({ x: 2, y: 2 }, { radius: 1, columns: 26, rows: 19 });
    const found = findEntitiesInRegion(items, region);
    expect(found).toContain("a");
    expect(found).not.toContain("b");
  });

  it("tracks flags, narratives, objectives, and cards", () => {
    let state = playSessionReducer(DEFAULT_PLAY_SESSION_STATE, {
      type: "setFlag",
      flag: "door-opened",
    });
    expect(state.flags["door-opened"]).toBe(true);

    state = playSessionReducer(state, {
      type: "clearFlag",
      flag: "door-opened",
    });
    expect(state.flags["door-opened"]).toBe(false);

    state = playSessionReducer(state, {
      type: "addNarrative",
      noteIds: ["note-1", "note-2"],
    });
    expect(state.narratives).toContain("note-1");

    state = playSessionReducer(state, {
      type: "addObjective",
      objectiveId: "objective-1",
    });
    expect(state.objectives).toContain("objective-1");

    state = playSessionReducer(state, {
      type: "revealCard",
      card: { id: "card-1", title: "Treasure", revealedAt: 123 },
    });
    expect(state.revealedCards[0]?.id).toBe("card-1");
  });
});
