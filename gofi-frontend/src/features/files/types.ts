export interface FileInfo {
    name: string
    isDirectory: boolean
    size: number
    extension: string
    mime: string
    path: string
    lastModified: number
    content: string
    fileType: string
    iconType: string
}

export interface FileData {
    file: FileInfo
}

export interface DirectoryData {
    path: string
    files: FileInfo[]
}

export interface FileResponse {
    type: 'file' | 'directory'
    data: FileData | DirectoryData
}
