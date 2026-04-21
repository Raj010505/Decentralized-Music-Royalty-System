import StreamSimulator from "@/components/StreamSimulator";

export default function StreamPage() {
  return (
    <section className="stack-lg">
      <div className="hero-banner fade-in">
        <p className="eyebrow">Feature</p>
        <h2 className="hero-title">Streaming Simulator</h2>
        <p className="muted">
          Mock a play count and let the contract calculate and distribute split payments in ETH automatically.
        </p>
      </div>

      <StreamSimulator />
    </section>
  );
}
