import React from 'react'
import { SWRConfig } from 'swr'

const cache = new Map()

const AppProviders: React.FC<React.PropsWithChildren> = ({ children }) => (
    <SWRConfig
        value={{
            provider: () => cache,
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
            shouldRetryOnError: false,
        }}
    >
        <React.StrictMode>{children}</React.StrictMode>
    </SWRConfig>
)

export default AppProviders
