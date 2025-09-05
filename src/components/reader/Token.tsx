import React from "react";
import { isWhitespace, isWord } from "../../lib/text";

type Props = {
  ti: number;
  text: string;
  inFocus: boolean;
  inAid: boolean;
  inClip: boolean;
  styleFocus: React.CSSProperties;
  styleDim: React.CSSProperties;
  onJump: (ti: number) => void;
};

export const Token: React.FC<Props> = ({ ti, text, inFocus, inAid, inClip, styleFocus, styleDim, onJump }) => {
  let cls = "tok token";
  if (inFocus) cls += " focus"; else cls += " dim";
  if (inAid)   cls += " aid";
  if (inClip)  cls += " clipmark";
  if (isWhitespace(text)) cls += " ws";
  if (isWord(text))       cls += " word";

  const style: React.CSSProperties = inFocus ? styleFocus : styleDim;

  let content: React.ReactNode = text;
  if (isWord(text)) {
    const parts = Array.from(text);
    const first = parts[0] ?? "";
    const rest  = parts.slice(1).join("");
    content = (<><span className="initial">{first}</span>{rest}</>);
  }

  return (
    <span
      className={cls}
      data-ti={ti}
      onClick={() => onJump(ti)}
      style={style}
    >
      {content}
    </span>
  );
};

export default Token;

