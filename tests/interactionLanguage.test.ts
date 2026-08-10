import assert from "node:assert/strict";
import test from "node:test";
import {
  interactionLanguageInstruction,
  normalizeInteractionLanguage,
  resolveInteractionLanguageValue,
} from "../src/services/interactionLanguage";

test("normalizes only Spanish explicitly and defaults invalid settings to English", () => {
  assert.equal(normalizeInteractionLanguage("es"), "es");
  assert.equal(normalizeInteractionLanguage("en"), "en");
  assert.equal(normalizeInteractionLanguage("fr"), "en");
  assert.equal(normalizeInteractionLanguage(undefined), "en");
});

test("node override wins over the workspace interaction language", () => {
  assert.equal(resolveInteractionLanguageValue(undefined, "es"), "es");
  assert.equal(resolveInteractionLanguageValue("en", "es"), "en");
  assert.equal(resolveInteractionLanguageValue("es", "en"), "es");
});

test("instruction specifies the response language without asking to translate literals", () => {
  const spanish = interactionLanguageInstruction("es");
  const english = interactionLanguageInstruction("en");
  assert.match(spanish, /in Spanish\./);
  assert.match(english, /in English\./);
  assert.match(spanish, /code, commands, paths, API names/);
});
