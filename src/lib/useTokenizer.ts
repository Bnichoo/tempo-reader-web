import { useEffect, useMemo, useRef, useState } from "react"
import { tokenizeSync } from "./tokenize"

export function useTokenizer(text: string) {
  const [tokens, setTokens] = useState<string[]>(() => tokenizeSync(text))
  const workerRef = useRef<Worker | null>(null)
  const reqId = useRef(0)

  const useWorker = useMemo(() => {
    return typeof Worker !== "undefined" && text.length > 10000
  }, [text])

  useEffect(() => {
    if (!useWorker) {
      setTokens(tokenizeSync(text))
      if (workerRef.current) { workerRef.current.terminate(); workerRef.current = null }
      return
    }

    try {
      if (!workerRef.current) {
        workerRef.current = new Worker(new URL("./tokenize.worker.ts", import.meta.url), { type: "module" })
      }
      const id = ++reqId.current
      const w = workerRef.current
      const onMsg = (e: MessageEvent) => {
        const { id: gotId, tokens } = e.data || {}
        if (gotId === id && Array.isArray(tokens)) {
          setTokens(tokens as string[])
        }
      }
      const onErr = () => {
        setTokens(tokenizeSync(text))
      }
      w.addEventListener("message", onMsg as any, { once: true } as any)
      w.addEventListener("error", onErr as any, { once: true } as any)
      w.postMessage({ id, type: "tokenize", text })
      return () => {
        w.removeEventListener("message", onMsg as any)
        w.removeEventListener("error", onErr as any)
      }
    } catch {
      setTokens(tokenizeSync(text))
    }
  }, [text, useWorker])

  return tokens
}
