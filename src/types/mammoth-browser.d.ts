declare module 'mammoth/mammoth.browser' {
  export type MammothImageHandler = {
    inline: () => unknown;
  };
  export const images: MammothImageHandler;
  export function convertToHtml(input: { arrayBuffer: ArrayBuffer }, options?: { convertImage?: unknown }): Promise<{ value: string }>;
}

