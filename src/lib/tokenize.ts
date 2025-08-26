const wordRe = /[\p{L}\p{N}]+(?:[’'_–-][\p{L}\p{N}]+)*/uy

export function tokenizeSync(text: string): string[] {
  const out: string[] = []
  let i = 0
  while (i < text.length) {
    const ch = text[i]
    if (/\s/.test(ch)) {
      let j = i + 1
      while (j < text.length && /\s/.test(text[j])) j++
      out.push(text.slice(i, j))
      i = j
      continue
    }
    wordRe.lastIndex = i
    const m = wordRe.exec(text)
    if (m && m.index === i) {
      out.push(m[0])
      i = wordRe.lastIndex
      continue
    }
    out.push(ch)
    i++
  }
  return out
}
