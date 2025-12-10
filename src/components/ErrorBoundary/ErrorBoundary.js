import React from 'react';
import './errorBoundary.scss';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorInfo: null,
      componentStack: null
    };
  }

  static getDerivedStateFromError(error) {
    return { 
      hasError: true, 
      error 
    };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to console with more details
    console.error('Component Error:', {
      error,
      componentStack: errorInfo?.componentStack,
      timestamp: new Date().toISOString(),
      location: window.location.href
    });

    this.setState({
      errorInfo,
      componentStack: errorInfo?.componentStack
    });

    // You could also send this to your error tracking service
    // if (process.env.NODE_ENV === 'production') {
    //   // Send to error tracking service
    // }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    const { hasError, error, componentStack } = this.state;
    const isDev = process.env.NODE_ENV === 'development';

    if (hasError) {
      return (
        <div className="error-boundary">
          <div className="error-content">
            <h2>Oops! Something went wrong</h2>
            {isDev && (
              <>
                <p className="error-message">
                  {error?.message || 'An unexpected error occurred'}
                </p>
                {componentStack && (
                  <pre className="error-stack">
                    {componentStack}
                  </pre>
                )}
              </>
            )}
            <div className="error-actions">
              <button 
                className="retry-button"
                onClick={this.handleRetry}
              >
                Try Again
              </button>
              <button 
                className="home-button"
                onClick={() => window.location.href = '/'}
              >
                Go to Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
