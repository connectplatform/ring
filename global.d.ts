import { MotionProps as OriginalMotionProps } from "framer-motion";

declare module "framer-motion" {
  interface MotionProps extends OriginalMotionProps {
    className?: string;
    style?: React.CSSProperties;
    children?: React.ReactNode;
    onClick?: (event: React.MouseEvent<HTMLElement>) => void;
    id?: string | (() => string);
  }
}

// Ambient module declarations for optional deps used in SDK/build
declare module 'bert-js' {
  const bert: any
  export default bert
}

