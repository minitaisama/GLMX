import { z } from "zod"
import { PROVIDER_PRESETS } from "../../../../shared/provider-presets"
import { publicProcedure, router } from "../index"
import {
  DEFAULT_ZAI_CONFIG,
  getActiveProvider,
  getMaskedZaiKey,
  getProviderApiKey,
  getProviderConfig,
  getZaiConfig,
  isZaiConfigured,
  saveProviderApiKey,
  saveProviderConfig,
  setActiveProvider,
  saveZaiConfig,
} from "../../zai-config"

export const zaiRouter = router({
  listProviders: publicProcedure.query(() => {
    return Object.values(PROVIDER_PRESETS).map((provider) =>
      getProviderConfig(provider.id),
    )
  }),

  getActiveProvider: publicProcedure.query(() => {
    return getActiveProvider()
  }),

  setActiveProvider: publicProcedure
    .input(z.object({ presetId: z.string() }))
    .mutation(({ input }) => {
      setActiveProvider(input.presetId)
      return { success: true }
    }),

  saveProviderKey: publicProcedure
    .input(z.object({ presetId: z.string(), apiKey: z.string().min(4) }))
    .mutation(({ input }) => {
      saveProviderApiKey(input.presetId, input.apiKey)
      return { success: true }
    }),

  saveProviderConfig: publicProcedure
    .input(z.object({
      presetId: z.string(),
      baseUrl: z.string().min(1),
      headers: z.record(z.string()).default({}),
      models: z.object({
        heavy: z.string().min(1),
        standard: z.string().min(1),
        fast: z.string().min(1),
      }),
    }))
    .mutation(({ input }) => {
      const provider = saveProviderConfig(input.presetId, {
        baseUrl: input.baseUrl,
        headers: input.headers,
        models: input.models,
      })
      return {
        success: true,
        provider,
      }
    }),

  getProviderKeyStatus: publicProcedure.query(() => {
    const activeProvider = getActiveProvider()
    const presets = Object.values(PROVIDER_PRESETS)
    return presets.map((provider) => ({
      presetId: provider.id,
      name: provider.name,
      hasKey: Boolean(getProviderApiKey(provider.id)),
      isActive: activeProvider.id === provider.id,
    }))
  }),

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
