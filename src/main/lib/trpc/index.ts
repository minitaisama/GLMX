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

export const middleware = t.middleware

/**
 * Middleware to log procedure calls
 */
export const loggerMiddleware = middleware(async ({ path, type, next }) => {
  const start = Date.now()
  logger.trpc.debug("request_started", { path, type })
  const result = await next()
  const duration = Date.now() - start

  if (result.ok) {
    logger.trpc.debug("request_completed", { path, type, durationMs: duration })
  } else {
    logger.trpc.error("request_failed", {
      path,
      type,
      durationMs: duration,
      error: result.error.message,
    })
  }

  return result
})

/**
 * Procedure with logging
 */
export const router = t.router
export const publicProcedure = t.procedure.use(loggerMiddleware)
export const loggedProcedure = publicProcedure
