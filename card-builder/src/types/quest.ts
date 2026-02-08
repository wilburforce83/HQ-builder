export interface QuestNote {
  id: string;
  number: number;
  text: string;
  linkedTriggers?: string[];
  linkedEntities?: string[];
}

export interface Condition {
  type: string; // 'flagSet','flagUnset','noteExists' etc.
  operand: string;
  comparison?: string;
}

export interface Action {
  type: string; // 'revealTiles','revealEntities','addNarrative','revealCard','setFlag','clearFlag'
  payload: any;
}

export interface IconLogic {
  id?: string;
  iconId: string;
  triggerType: string;
  conditions: Condition[];
  actions: Action[];
  conditionsMode?: "all" | "any"; // optional boolean logic for combining conditions
}

export interface IconTarget {
  id: string;
  label: string;
  assetId: string;
  url?: string;
  x: number;
  y: number;
  numberLabel?: string;
  baseW?: number;
  baseH?: number;
  spanW?: number;
  spanH?: number;
  rotation?: number;
  offsetX?: number;
  offsetY?: number;
  layer?: "tile" | "furniture" | "monster";
  paddingPct?: number | null;
  category?: string | null;
}
