export interface ZaiModelSlotPreset {
  id: string
  label: string
  description: string
  models: {
    opus: string
    sonnet: string
    haiku: string
  }
}

export const ZAI_MODEL_SLOT_PRESETS: ZaiModelSlotPreset[] = [
  {
    id: "glm-default",
    label: "GLM Default",
    description: "Balanced default mapping from Z.AI Coding Plan docs",
    models: {
      opus: "glm-4.7",
      sonnet: "glm-4.7",
      haiku: "glm-4.5-air",
    },
  },
  {
    id: "glm-5-family",
    label: "GLM-5 Family",
    description: "Heavy on glm-5.1, standard on glm-5, fast on glm-5-turbo",
    models: {
      opus: "glm-5.1",
      sonnet: "glm-5",
      haiku: "glm-5-turbo",
    },
  },
]
