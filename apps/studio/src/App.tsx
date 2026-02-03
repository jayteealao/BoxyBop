import { useEffect, useState } from "react";

interface HealthStatus {
  status: string;
  timestamp: string;
}

export function App() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then(setHealth)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
      <h1>BoxyBop Studio</h1>
      <p>UI Screenshot to Tokens + Components</p>

      <div style={{ marginTop: "2rem" }}>
        <h2>Pipeline Status</h2>
        {error && <p style={{ color: "red" }}>Error: {error}</p>}
        {health && (
          <p style={{ color: "green" }}>
            Status: {health.status} (checked at {health.timestamp})
          </p>
        )}
        {!health && !error && <p>Checking pipeline health...</p>}
      </div>

      <div style={{ marginTop: "2rem" }}>
        <h2>Getting Started</h2>
        <ol>
          <li>Upload a UI screenshot</li>
          <li>Review OmniParser detected elements</li>
          <li>Adjust crop regions as needed</li>
          <li>Generate tokens and components</li>
        </ol>
      </div>
    </div>
  );
}
