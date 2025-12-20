import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  showPrefix?: boolean
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, showPrefix = true, ...props }, ref) => {
    return (
      <div className="relative flex items-center w-full">
        {showPrefix && (
          <span className="absolute left-3 text-primary font-mono select-none pointer-events-none">
            {'>'}
          </span>
        )}
        <input
          type={type}
          className={cn(
            'flex h-10 w-full border-2 border-border bg-background px-3 py-2 text-sm font-mono transition-all duration-200',
            'cyber-clip-sm',
            showPrefix && 'pl-7',
            'text-foreground placeholder:text-muted-foreground',
            'focus:outline-none focus:border-primary focus:shadow-neon-subtle',
            'file:border-0 file:bg-transparent file:text-sm file:font-medium',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'dark:[color-scheme:dark]',
            className
          )}
          ref={ref}
          {...props}
        />
      </div>
    )
  }
)
Input.displayName = 'Input'

export { Input }
