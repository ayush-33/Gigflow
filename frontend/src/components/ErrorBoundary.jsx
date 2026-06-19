import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div style={{
          padding: '2.5rem',
          margin: '2rem auto',
          maxWidth: '500px',
          background: '#1a1d27',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          borderRadius: '16px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
          color: '#f1f5f9',
          textAlign: 'center',
          fontFamily: "'Plus Jakarta Sans', sans-serif"
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '0.75rem', color: '#f87171' }}>
            Something went wrong
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>
            An error occurred in this section. You can try recovering or reloading.
          </p>
          {this.state.error && (
            <pre style={{
              background: '#0f111a',
              padding: '0.75rem',
              borderRadius: '8px',
              fontSize: '0.8rem',
              color: '#ef4444',
              overflowX: 'auto',
              textAlign: 'left',
              marginBottom: '1.5rem',
              border: '1px solid rgba(255,255,255,0.05)'
            }}>
              {this.state.error.toString()}
            </pre>
          )}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              onClick={this.handleReset}
              style={{
                padding: '10px 20px',
                background: '#3b82f6',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'background 0.2s'
              }}
              onMouseOver={(e) => e.target.style.background = '#60a5fa'}
              onMouseOut={(e) => e.target.style.background = '#3b82f6'}
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '10px 20px',
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '8px',
                color: '#94a3b8',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'background 0.2s'
              }}
              onMouseOver={(e) => e.target.style.background = 'rgba(255,255,255,0.05)'}
              onMouseOut={(e) => e.target.style.background = 'transparent'}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
