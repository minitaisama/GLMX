/**
 * @jest
 * {@jest}
 */

import { normalizeOpenAICompatibleModelId, getOpenAICompatibleSlotModelName, formatCodexThinkingLabel,
} from "../models"

describe("Model utilities", () => {
  describe("normalizeOpenAICompatibleModelId", () => {
    it("should normalize heavy/standard/fast model IDs", () => {
      expect(normalizeOpenAICompatibleModelId("heavy")).toBe("heavy")
      expect(normalizeOpenAICompatibleModelId("standard")).toBe("standard")
      expect(normalizeOpenAICompatibleModelId("fast")).toBe("fast")
      expect(normalizeOpenAICompatibleModelId("HEAVY")).toBe("heavy")
      expect(normalizeOpenAICompatibleModelId("Standard")).toBe("standard")
      expect(normalizeOpenAICompatibleModelId("FAST")).toBe("fast")
      expect(normalizeOpenAICompatibleModelId("gpt-4o")).toBe("standard")
      expect(normalizeOpenAICompatibleModelId("gpt-4o-mini")).toBe("fast")
      expect(normalizeOpenAICompatibleModelId("glm-5.1")).toBe("heavy")
    })

    it("should handle null/undefined", () => {
      expect(normalizeOpenAICompatibleModelId(null)).toBe("standard")
      expect(normalizeOpenAICompatibleModelId(undefined)).toBe("standard")
      expect(normalizeOpenAICompatibleModelId("")).toBe("standard")
    })

    it("should handle model IDs with paths", () => {
      expect(normalizeOpenAICompatibleModelId("heavy/v1")).toBe("heavy")
      expect(normalizeOpenAICompatibleModelId("standard/v2")).toBe("standard")
      expect(normalizeOpenAICompatibleModelId("models/gpt-4o")).toBe("standard")
    })
  })

  describe("getOpenAICompatibleSlotModelName", () => {
    it("should return correct slot model names", () => {
      expect(getOpenAICompatibleSlotModelName("heavy")).toBe("gpt-4o")
      expect(getOpenAICompatibleSlotModelName("standard")).toBe("gpt-4o")
      expect(getOpenAICompatibleSlotModelName("fast")).toBe("gpt-4o-mini")
    })

    it("should respect custom config", () => {
      expect(
        getOpenAICompatibleSlotModelName("heavy", { heavy: "custom-heavy" })
      ).toBe("custom-heavy")
      expect(
        getOpenAICompatibleSlotModelName("standard", { standard: "custom-standard" })
      ).toBe("custom-standard")
    })
  })

  describe("formatCodexThinkingLabel", () => {
    it("should format thinking levels", () => {
      expect(formatCodexThinkingLabel("low")).toBe("Low")
      expect(formatCodexThinkingLabel("medium")).toBe("Medium")
      expect(formatCodexThinkingLabel("high")).toBe("High")
      expect(formatCodexThinkingLabel("xhigh")).toBe("Extra High")
    })
  })
})
