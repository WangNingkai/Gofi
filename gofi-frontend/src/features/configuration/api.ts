import client from '@/shared/api/client'

export interface PublicConfiguration {
    initialized: boolean
    version: string
}

export interface AdminConfiguration extends PublicConfiguration {
    customStoragePath: string
    defaultStoragePath: string
}

export interface SetupInput {
    customStoragePath: string
    adminUsername: string
    adminPassword: string
}

export function fetchConfiguration(): Promise<PublicConfiguration> {
    return client.get('configuration')
}

export function fetchAdminConfiguration(): Promise<AdminConfiguration> {
    return client.get('configuration/details')
}

export function setup(input: SetupInput): Promise<AdminConfiguration> {
    return client.post('setup', input)
}

export function updateStoragePath(customStoragePath: string): Promise<AdminConfiguration> {
    return client.post('configuration', { customStoragePath })
}
