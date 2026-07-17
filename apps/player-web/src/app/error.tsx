"use client";

export default function ErrorPage({ reset }: Readonly<{ reset: () => void }>) {
  return <main className="status-page"><h1>We hit a snag</h1><p>Your balance is safe. Try loading the casino again.</p><button className="primary-button" onClick={reset}>Try again</button></main>;
}
