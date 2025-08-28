import { useEffect, useMemo, useRef, useState } from "react"
import { tokenizeImpl as tokenizeSync } from "./tokenizeImpl"
import { LIMITS } from "./constants"

export function useTokenizer(text: string) {
  const [tokens, setTokens] = useState<string[]>(() => tokenizeSync(text))
  const workerRef = useRef<Worker | null>(null)
  const reqId = useRef(0)

  const useWorker = useMemo(() => {
    return typeof Worker !== "undefined" && text.length > LIMITS.TOKENIZE_WORKER_THRESHOLD
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
      const onErr = (_e: Event) => {
        setTokens(tokenizeSync(text))
      }
      w.addEventListener("message", onMsg, { once: true })
      w.addEventListener("error", onErr, { once: true })
      w.postMessage({ id, type: "tokenize", text })
      return () => {
        w.removeEventListener("message", onMsg)
        w.removeEventListener("error", onErr)
      }
    } catch {
      setTokens(tokenizeSync(text))
    }
  }, [text, useWorker])

  // Ensure worker is terminated when component unmounts
  useEffect(() => {
    return () => {
      workerRef.current?.terminate()
      workerRef.current = null
    }
  }, [])

  return tokens
}
