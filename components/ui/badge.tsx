import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center border-2 px-2.5 py-0.5 text-xs font-mono uppercase tracking-wider transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 cyber-clip-sm',
  {
    variants: {
      variant: {
        default:
          'border-primary bg-primary/10 text-primary',
        secondary:
          'border-secondary bg-secondary/10 text-secondary',
        destructive:
          'border-destructive bg-destructive/10 text-destructive',
        outline:
          'border-border text-foreground',
        warning:
          'border-warning bg-warning/10 text-warning',
        info:
          'border-accent bg-accent/10 text-accent',
        success:
          'border-primary bg-primary/10 text-primary',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
