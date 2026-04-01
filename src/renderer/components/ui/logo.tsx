import * as React from "react"
import { cn } from "../../lib/utils"

const BRAND_LOGO_SRC = "./brand-logo.png"

interface LogoProps extends React.HTMLAttributes<HTMLSpanElement> {
  className?: string
  fill?: string
}

export function Logo({ className, fill: _fill, ...props }: LogoProps) {
  return (
    <span
      className={cn("inline-flex items-center justify-center overflow-hidden", className)}
      aria-label="GLMX logo"
      {...props}
    >
      <img
        src={BRAND_LOGO_SRC}
        alt=""
        className="h-full w-full object-contain"
        draggable={false}
      />
    </span>
  )
}
