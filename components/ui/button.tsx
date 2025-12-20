import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  // Base styles - cyberpunk with chamfered corners
  'inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-mono uppercase tracking-wider transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 cyber-clip relative overflow-hidden touch-manipulation',
  {
    variants: {
      variant: {
        // Default: transparent bg, neon green border, glow on hover
        default:
          'bg-transparent border-2 border-primary text-primary hover:bg-primary/10 hover:shadow-neon active:scale-[0.97]',
        // Destructive: red neon
        destructive:
          'bg-transparent border-2 border-destructive text-destructive hover:bg-destructive/10 hover:shadow-neon-destructive active:scale-[0.97]',
        // Outline: subtle border
        outline:
          'border-2 border-border bg-transparent text-foreground hover:border-primary hover:text-primary hover:shadow-neon-subtle active:scale-[0.97]',
        // Secondary: magenta neon
        secondary:
          'bg-transparent border-2 border-secondary text-secondary hover:bg-secondary/10 hover:shadow-neon-secondary active:scale-[0.97]',
        // Ghost: no border, subtle hover
        ghost:
          'text-muted-foreground hover:text-primary hover:bg-primary/5 active:scale-[0.97]',
        // Link: underline style
        link:
          'text-primary underline-offset-4 hover:underline',
        // Glitch: solid primary with elegant shine sweep effect
        glitch:
          'bg-primary text-primary-foreground border-2 border-primary hover:brightness-110 shine-hover glow-hover active:scale-[0.97]',
      },
      size: {
        default: 'h-10 px-6 py-2',
        sm: 'h-8 px-4 text-xs cyber-clip-sm',
        lg: 'h-12 px-10 text-base cyber-clip-lg',
        icon: 'h-10 w-10 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
