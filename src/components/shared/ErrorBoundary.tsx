import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  label?: string;
}

interface State {
  error: Error | null;
  componentStack: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, componentStack: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[${this.props.label ?? 'App'}]`, error, info.componentStack);
    this.setState({ componentStack: info.componentStack });
  }

  render() {
    const { error, componentStack } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-screen bg-bw-bg text-bw-text p-6 overflow-auto">
        <h1 className="text-lg font-bold text-bw-danger mb-2">
          {this.props.label ? `${this.props.label} error` : 'Something went wrong'}
        </h1>
        <p className="text-sm text-bw-muted mb-4">{error.message}</p>
        <pre className="text-xs whitespace-pre-wrap bg-bw-card p-4 rounded border border-bw-border overflow-auto max-h-[70vh]">
          {error.stack}
          {componentStack ? `\n\nComponent stack:${componentStack}` : ''}
        </pre>
        <button
          type="button"
          className="mt-4 px-4 py-2 rounded bg-bw-primary text-white text-sm"
          onClick={() => this.setState({ error: null, componentStack: null })}
        >
          Try again
        </button>
      </div>
    );
  }
}
