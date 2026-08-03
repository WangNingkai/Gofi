import React from 'react'
import ReactMarkdown from 'react-markdown'

interface MarkdownPreviewProps {
    content: string
}

const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({ content }) => (
    <ReactMarkdown>{content}</ReactMarkdown>
)

export default MarkdownPreview
