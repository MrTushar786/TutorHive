import React, { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // TODO: send to server logs with requestId if desired
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "1rem" }}>
          <h3>Something went wrong in this section.</h3>
          <p>Please try again or refresh the page.</p>
        </div>
      );
    }
    return this.props.children;
  }
}