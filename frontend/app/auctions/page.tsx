import AuctionPanel from "@/components/AuctionPanel";

export default function AuctionsPage() {
  return (
    <section className="stack-lg">
      <div className="hero-banner fade-in">
        <p className="eyebrow">Feature</p>
        <h2 className="hero-title">Rights NFT Auctions</h2>
        <p className="muted">
          Approve and list music rights NFTs, accept bids, and transfer future royalty claims to the winner.
        </p>
      </div>

      <AuctionPanel />
    </section>
  );
}
