declare module "lucide-react/dist/esm/icons/*" {
  import type { FC, SVGProps } from "react";
  export interface LucideProps extends SVGProps<SVGSVGElement> {
    color?: string;
    size?: number | string;
    strokeWidth?: number | string;
    absoluteStrokeWidth?: boolean;
  }
  const Icon: FC<LucideProps>;
  export default Icon;
}

