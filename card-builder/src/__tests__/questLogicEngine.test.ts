import { resolveLogicActions } from "@/lib/quest-logic-engine";
import type { IconLogic, QuestNote } from "@/types/quest";
import type { QuestItem } from "@/lib/play-session-engine";

describe("quest logic engine", () => {
  it("resolves actions for matching triggers and conditions", () => {
    const items: QuestItem[] = [
      { id: "icon-1", assetId: "monster-goblin", x: 2, y: 3, baseW: 1, baseH: 1 },
    ];
    const notes: QuestNote[] = [{ id: "note-1", number: 2, text: "Secret door" }];
    const iconLogic: IconLogic[] = [
      {
        iconId: "icon-1",
        triggerType: "onSearch",
        conditionsMode: "all",
        conditions: [{ type: "flagUnset", operand: "searched" }],
        actions: [
          { type: "revealTiles", payload: { coords: [{ x: 2, y: 3 }] } },
          { type: "revealRadius", payload: { radius: 1 } },
          { type: "revealEntities", payload: { entityIds: ["icon-1"] } },
          { type: "addNarrative", payload: { noteIds: ["note-1"] } },
          { type: "revealCard", payload: { cardIds: ["card-1"] } },
          { type: "setFlag", payload: { flag: "searched" } },
          { type: "addObjective", payload: { objectiveId: "objective-1" } },
        ],
      },
    ];

    const result = resolveLogicActions({
      trigger: { type: "onSearch", tiles: [{ x: 2, y: 3 }] },
      iconLogic,
      items,
      flags: {},
      notes,
    });

    expect(result.revealTiles).toEqual(
      expect.arrayContaining([{ x: 2, y: 3 }]),
    );
    expect(result.revealEntities).toEqual(["icon-1"]);
    expect(result.noteIds).toEqual(["note-1"]);
    expect(result.cardIds).toEqual(["card-1"]);
    expect(result.flagsToSet).toEqual(["searched"]);
    expect(result.objectives).toEqual(["objective-1"]);
  });
});
