import React from 'react'
import { Link } from 'react-router'
import icon from '../../../assets/logo.svg'
const Logo: React.FC = () => {
    return (
        <Link to="/file/" className="group flex shrink-0 items-center gap-2 rounded-lg pr-2" aria-label="Go File Indexer">
            <span className="grid size-9 place-items-center rounded-xl border border-primary/15 bg-primary/10 transition-colors group-hover:bg-primary/15">
                <img src={icon} className="h-7 w-7 opacity-90 dark:invert" alt="" />
            </span>
            <span className="hidden leading-tight lg:block">
                <span className="block text-sm font-bold tracking-tight">Gofi</span>
                <span className="block text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">File workspace</span>
            </span>
        </Link>
    )
}

export default Logo
