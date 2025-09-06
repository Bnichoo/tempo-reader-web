declare module '@mozilla/readability' {
  export class Readability {
    constructor(doc: Document);
    parse(): { title?: string; content?: string } | null;
  }
}

