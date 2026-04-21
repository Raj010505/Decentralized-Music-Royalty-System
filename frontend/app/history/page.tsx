import TransactionTable from "@/components/TransactionTable";

export default function HistoryPage() {
  return (
    <section className="stack-lg">
      <div className="hero-banner fade-in">
        <p className="eyebrow">Feature</p>
        <h2 className="hero-title">Wallet Activity History</h2>
        <p className="muted">
          Review complete on-chain flow: track registration, incoming royalties, split payouts, bids, refunds,
          and auction finalizations.
        </p>
      </div>

      <TransactionTable />
    </section>
  );
}
