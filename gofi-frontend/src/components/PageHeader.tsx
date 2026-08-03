import React from 'react'

interface IProps {
    icon?: React.ReactNode // 渲染的icon
    title?: string
    description?: string
}

const PageHeader: React.FC<IProps> = ({ icon, title, description }) => {
    return (
        <div className="mb-6">
            <div className="mb-1.5 flex items-center gap-3">
                {icon && (
                    <div className="rounded-xl border border-primary/10 bg-primary/10 p-2">
                        {icon}
                    </div>
                )}
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                    {title}
                </h1>
            </div>
            {description && (
                <p className="max-w-2xl text-sm text-muted-foreground">
                    {description}
                </p>
            )}
        </div>
    )
}

export default PageHeader
