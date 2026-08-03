import React, { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

export interface LoadingIndicatorProps {
    className?: string
    label?: string
    showLabel?: boolean
    size?: 'sm' | 'md' | 'lg'
}

const indicatorSizes = {
    sm: 'h-4 w-4',
    md: 'h-7 w-7',
    lg: 'h-10 w-10',
}

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
    className,
    label = 'Loading',
    showLabel = false,
    size = 'md',
}) => (
    <div
        role="status"
        aria-live="polite"
        aria-label={label}
        className={cn('inline-flex items-center justify-center gap-3 text-muted-foreground', className)}
    >
        <span className={cn('gofi-loading-indicator relative inline-block shrink-0', indicatorSizes[size])} aria-hidden="true">
            <span className="gofi-loading-track absolute inset-0 rounded-full" />
            <span className="gofi-loading-orbit absolute inset-0 rounded-full" />
            <span className="gofi-loading-core absolute left-1/2 top-1/2 h-1/4 w-1/4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary" />
        </span>
        {showLabel && <span className="text-sm font-medium">{label}</span>}
    </div>
)

export function useDelayedVisibility(active: boolean, delay = 180, minimumVisible = 240): boolean {
    const [visible, setVisible] = useState(false)
    const visibleAt = useRef(0)

    useEffect(() => {
        let timer: number | undefined
        if (active) {
            if (!visible) {
                timer = window.setTimeout(() => {
                    visibleAt.current = Date.now()
                    setVisible(true)
                }, delay)
            }
        } else if (visible) {
            const remaining = Math.max(0, minimumVisible - (Date.now() - visibleAt.current))
            timer = window.setTimeout(() => setVisible(false), remaining)
        }
        return () => {
            if (timer !== undefined) window.clearTimeout(timer)
        }
    }, [active, delay, minimumVisible, visible])

    return visible
}

interface LoadingStageProps extends LoadingIndicatorProps {
    active?: boolean
    children?: React.ReactNode
    delay?: number
    minimumVisible?: number
    variant?: 'inline' | 'panel' | 'page' | 'overlay'
}

const stageClasses = {
    inline: 'inline-flex',
    panel: 'flex min-h-52 w-full items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/20',
    page: 'flex min-h-[100dvh] w-full items-center justify-center bg-background',
    overlay: 'absolute inset-0 z-20 flex items-center justify-center bg-background/82 backdrop-blur-[2px]',
}

export const LoadingStage: React.FC<LoadingStageProps> = ({
    active = true,
    children,
    className,
    delay = 180,
    label,
    minimumVisible = 240,
    showLabel = true,
    size = 'md',
    variant = 'panel',
}) => {
    const visible = useDelayedVisibility(active, delay, minimumVisible)
    const [mounted, setMounted] = useState(visible)
    const keepLayout = variant === 'page' || variant === 'panel'

    useEffect(() => {
        let timer: number | undefined
        if (visible) setMounted(true)
        else if (mounted) timer = window.setTimeout(() => setMounted(false), 200)
        return () => {
            if (timer !== undefined) window.clearTimeout(timer)
        }
    }, [mounted, visible])

    if (!mounted && !keepLayout) return null
    return (
        <div
            data-loading-visible={visible ? 'true' : 'false'}
            className={cn(
                stageClasses[variant],
                'transition-opacity duration-200',
                visible ? 'opacity-100' : 'pointer-events-none opacity-0',
                className,
            )}
            aria-hidden={!visible}
        >
            {visible && (children ?? <LoadingIndicator label={label} showLabel={showLabel} size={size} />)}
        </div>
    )
}

export const LoadingSkeleton: React.FC<{ className?: string; rows?: number }> = ({ className, rows = 5 }) => (
    <div className={cn('w-full space-y-3 p-1', className)} aria-hidden="true">
        {Array.from({ length: rows }, (_, index) => (
            <div key={index} className="flex items-center gap-3 rounded-xl border bg-card p-3">
                <span className="gofi-loading-skeleton h-9 w-9 shrink-0 rounded-lg" />
                <span className="min-w-0 flex-1 space-y-2">
                    <span className="gofi-loading-skeleton block h-3.5 rounded-md" style={{ width: `${58 + (index % 3) * 12}%` }} />
                    <span className="gofi-loading-skeleton block h-2.5 w-1/3 rounded-md" />
                </span>
            </div>
        ))}
    </div>
)

export const LoadingBar: React.FC<{ active: boolean; className?: string; label?: string }> = ({
    active,
    className,
    label = 'Loading',
}) => {
    const visible = useDelayedVisibility(active, 120, 220)
    if (!visible) return null
    return (
        <div role="status" aria-label={label} className={cn('h-0.5 overflow-hidden bg-primary/10', className)}>
            <span className="gofi-loading-bar block h-full w-1/3 rounded-full bg-primary" />
        </div>
    )
}
