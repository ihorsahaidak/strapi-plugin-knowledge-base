import * as React from 'react';

/**
 * Nothing this plugin renders inside the Content Manager may take the page
 * down with it: the admin still has to work if the knowledge base doesn't.
 */
class Boundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    // eslint-disable-next-line no-console
    console.error('[knowledge-base]', error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default Boundary;
