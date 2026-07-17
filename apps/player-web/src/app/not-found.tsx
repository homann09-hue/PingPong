import Link from "next/link";

export default function NotFound() {
  return <main className="status-page"><h1>That room is closed</h1><p>The game or page could not be found.</p><Link className="primary-button" href="/">Back to lobby</Link></main>;
}
