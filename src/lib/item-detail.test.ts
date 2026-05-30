import assert from "node:assert/strict";
import { formatEntryLabelPlain, formatItemDetail } from "./item-detail";

const enchantBook = {
  displayName: "&fEnchanted Book",
  material: "ENCHANTED_BOOK",
  "extra-data": {
    enchantData: [{ type: "sharpness", level: 5 }],
  },
};

assert.equal(formatItemDetail(enchantBook), "Sharpness 5");
assert.equal(formatEntryLabelPlain(enchantBook), "Enchanted Book — Sharpness 5");

const horn = {
  displayName: "&fGoat Horn",
  material: "GOAT_HORN",
  "extra-data": { instrumentData: { instrument: "minecraft:ponder_goat_horn" } },
};

assert.equal(formatItemDetail(horn), "Ponder");
assert.equal(formatEntryLabelPlain(horn), "Goat Horn — Ponder");

const potion = {
  displayName: "Potion",
  material: "POTION",
  "extra-data": {
    potionData: {
      type: "minecraft:strong_healing",
      customEffects: [{ type: "minecraft:regeneration", amplifier: 1 }],
    },
  },
};

assert.match(formatEntryLabelPlain(potion), /Potion — .*Strong Healing/);

console.log("item-detail.test.ts: ok");
