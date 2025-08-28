import { tokenizeImpl as tokenize } from "./tokenizeImpl"

self.onmessage = (e: MessageEvent) => {
  const { id, type, text } = e.data || {}
  if (type === "tokenize" && typeof text === "string") {
    const tokens = tokenize(text)
    ;(postMessage as (message: unknown) => void)({ id, tokens })
  }
}

