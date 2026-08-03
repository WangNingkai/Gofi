import React from 'react'
import { LoadingIndicator } from './Loading'

const LogoLoading: React.FC<{ className?: string }> = ({ className }) => (
  <LoadingIndicator className={className} size="lg" />
)

export default LogoLoading
