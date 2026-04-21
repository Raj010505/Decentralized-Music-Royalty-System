import RegisterTrackForm from "@/components/RegisterTrackForm";

export default function RegisterPage() {
  return (
    <section className="stack-lg">
      <div className="hero-banner fade-in">
        <p className="eyebrow">Feature</p>
        <h2 className="hero-title">Register Music Rights</h2>
        <p className="muted">
          Create a new rights NFT and lock in royalty splits. This is where artists define ownership,
          collaborators, and per-play payout rate.
        </p>
      </div>

      <RegisterTrackForm />
    </section>
  );
}
