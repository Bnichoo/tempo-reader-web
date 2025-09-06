/** Utilities to process dropped/opened files into plain text. */
export async function processFileToText(file: File): Promise<string> {
  const ext = file.name.toLowerCase().split(".").pop();
  const raw = await file.text();
  if (ext === "html" || ext === "htm") {
    const parser = new DOMParser();
    const doc = parser.parseFromString(raw, "text/html");
    return doc.body.innerText;
  }
  // TODO(md): handle markdown or docx if needed later
  return raw;
}

