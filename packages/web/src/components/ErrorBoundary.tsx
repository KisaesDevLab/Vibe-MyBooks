// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { Component, type ReactNode, type ErrorInfo } from 'react';
import { Button } from './ui/Button';

interface Props { children: ReactNode }
interface State { hasError: boolean; error?: Error }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#F9FAFB' }}>
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8 max-w-md text-center">
            <h2 className="text-xl font-bold mb-2" style={{ color: '#111827' }}>Something went wrong</h2>
            <p className="text-sm mb-4" style={{ color: '#6B7280' }}>{this.state.error?.message || 'An unexpected error occurred.'}</p>
            <Button onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}>
              Reload Page
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
