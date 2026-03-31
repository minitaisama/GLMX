import { initTRPC } from "@trpc/server"
import { BrowserWindow } from "electron"
import superjson from "superjson"
import { logger } from "../logger"

/**
 * Context passed to all tRPC procedures
 */
export interface Context {
  getWindow: () => BrowserWindow | null
}

/**
 * Initialize tRPC with context and superjson transformer
 */
const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
    }
  },
})

const loggerMiddleware = t.middleware(async ({ path, type, next }) => {
  const start = Date.now()
  logger.trpc.debug(`→ ${type} ${path}`)

  const result = await next()
  const durationMs = Date.now() - start

  if (result.ok) {
    logger.trpc.debug(`← ${path} OK (${durationMs}ms)`)
  } else {
    logger.trpc.error(`← ${path} ERROR (${durationMs}ms)`, {
      error: result.error.message,
      code: result.error.code,
    })
  }

  return result
})

/**
 * Export reusable router and procedure helpers
 */
export const router = t.router
export const publicProcedure = t.procedure.use(loggerMiddleware)
export const middleware = t.middleware
export { loggerMiddleware }
