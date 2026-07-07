import React from 'react'

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ComponentType<{ error: Error; resetErrorBoundary: () => void }>
  FallbackComponent?: React.ComponentType<{ error: Error; resetErrorBoundary: () => void }>
  fallbackRender?: (props: { error: Error; resetErrorBoundary: () => void }) => React.ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.props.onError?.(error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      const Fallback =
        this.props.fallback ??
        this.props.FallbackComponent ??
        this.props.fallbackRender
      if (!Fallback) return null
      return <Fallback error={this.state.error!} resetErrorBoundary={this.handleReset} />
    }
    return this.props.children
  }
}

export { ErrorBoundary }
