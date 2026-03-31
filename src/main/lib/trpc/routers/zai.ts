import { z } from "zod"
import { publicProcedure, router } from "../index"
import {
  DEFAULT_ZAI_CONFIG,
  getMaskedZaiKey,
  getZaiConfig,
  isZaiConfigured,
  saveZaiConfig,
} from "../../zai-config"

export const zaiRouter = router({
  isConfigured: publicProcedure.query(async () => {
    return await isZaiConfigured()
  }),

  getApiKey: publicProcedure.query(async () => {
    return await getMaskedZaiKey()
  }),

  getConfig: publicProcedure.query(async () => {
    const config = await getZaiConfig()

    return {
      baseUrl: config?.baseUrl || DEFAULT_ZAI_CONFIG.baseUrl,
      opusModel: config?.opusModel || DEFAULT_ZAI_CONFIG.opusModel,
      sonnetModel: config?.sonnetModel || DEFAULT_ZAI_CONFIG.sonnetModel,
      haikuModel: config?.haikuModel || DEFAULT_ZAI_CONFIG.haikuModel,
      hasKey: Boolean(config?.apiKey),
      maskedKey: await getMaskedZaiKey(),
    }
  }),

  saveConfig: publicProcedure
    .input(z.object({
      apiKey: z.string().min(10).optional(),
      baseUrl: z.string().default(DEFAULT_ZAI_CONFIG.baseUrl),
      opusModel: z.string().default(DEFAULT_ZAI_CONFIG.opusModel),
      sonnetModel: z.string().default(DEFAULT_ZAI_CONFIG.sonnetModel),
      haikuModel: z.string().default(DEFAULT_ZAI_CONFIG.haikuModel),
    }))
    .mutation(async ({ input }) => {
      const existingConfig = await getZaiConfig()
      const apiKey = input.apiKey || existingConfig?.apiKey

      if (!apiKey) {
        throw new Error("Missing ZAI API key")
      }

      await saveZaiConfig({
        apiKey,
        baseUrl: input.baseUrl,
        opusModel: input.opusModel,
        sonnetModel: input.sonnetModel,
        haikuModel: input.haikuModel,
      })
      return { success: true }
    }),
})
