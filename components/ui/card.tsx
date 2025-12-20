import * as React from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'terminal' | 'holographic'
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'border border-border bg-card text-card-foreground cyber-clip transition-all duration-200 relative',
        variant === 'default' && 'hover:border-primary/50 hover:shadow-neon-subtle',
        variant === 'terminal' && 'bg-background',
        variant === 'holographic' && 'holographic corner-accents',
        className
      )}
      {...props}
    />
  )
)
Card.displayName = 'Card'

// Terminal traffic lights component
export const TerminalDots = () => (
  <div className="traffic-lights">
    <span className="traffic-light traffic-light-red" />
    <span className="traffic-light traffic-light-yellow" />
    <span className="traffic-light traffic-light-green" />
  </div>
)

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  terminal?: boolean
}

const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, terminal, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex flex-col space-y-1.5 p-6',
        terminal && 'terminal-header flex-row items-center',
        className
      )}
      {...props}
    >
      {terminal && <TerminalDots />}
      {children}
    </div>
  )
)
CardHeader.displayName = 'CardHeader'

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      'font-display text-lg uppercase tracking-widest text-primary leading-none',
      className
    )}
    {...props}
  />
))
CardTitle.displayName = 'CardTitle'

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-sm text-muted-foreground font-mono', className)}
    {...props}
  />
))
CardDescription.displayName = 'CardDescription'

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
))
CardContent.displayName = 'CardContent'

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center p-6 pt-0', className)}
    {...props}
  />
))
CardFooter.displayName = 'CardFooter'

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
