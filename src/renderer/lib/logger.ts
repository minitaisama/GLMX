import log from "electron-log/renderer"

log.transports.console.level = "debug"
log.transports.file.level = "debug"

export const rlog = {
  app: log.scope("renderer"),
  chat: log.scope("chat-ui"),
  auth: log.scope("onboarding"),
}

export default rlog
