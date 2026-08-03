import { RiTranslate2 } from 'react-icons/ri'
import { cn } from '../../../lib/utils'
import React from 'react'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '../../ui/dropdown-menu'

interface IProps {
    selectLang?: string
    onSelect?: (lang: string) => void
}

const LangSelect: React.FC<IProps> = (props) => {
    const languages = [
        {
            lang: 'zh-Hans',
            label: '简体中文',
        },
        {
            lang: 'en',
            label: 'English',
        },
    ]

    return (
        <div className="flex h-full">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" aria-label={languages.find((item) => item.lang === props.selectLang)?.label ?? 'Language'}>
                        <RiTranslate2 size={20} />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36">
                    {languages.map((item, index) => (
                        <DropdownMenuItem
                            key={index}
                            className={cn(
                                "cursor-pointer flex items-center",
                                props.selectLang === item.lang && "bg-accent text-accent-foreground font-medium"
                            )}
                            onClick={() => {
                                if (props.onSelect) {
                                    props.onSelect(item.lang)
                                }
                            }}
                        >
                            <RiTranslate2 size={20} />
                            <span className="ml-2">{item.label}</span>
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    )
}

export default LangSelect
