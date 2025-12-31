"use client";

import { useEffect, useState } from "react";

const styles: Record<string, React.CSSProperties> = {
  container: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "100vh",
    backgroundColor: "#f5f5f7",
    color: "#1d1d1f",
    margin: 0,
    padding: 0,
  },
  title: {
    fontSize: "48px",
    fontWeight: 600,
  },
};

export default function Page() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCount((c) => c + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Network Chart ({count}s)</h1>
    </div>
  );
}
