import log from "electron-log/renderer"

log.transports.console.level = "debug"

export const rlog = {
  app: log.scope("renderer"),
  chat: log.scope("chat-ui"),
  auth: log.scope("onboarding"),
  boot: log.scope("boot"),
}

export default rlog
