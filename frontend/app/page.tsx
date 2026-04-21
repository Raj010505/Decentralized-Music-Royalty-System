import Link from "next/link";
import GuidedDemoFlow from "@/components/GuidedDemoFlow";
import {
  CONTRACT_ADDRESSES,
  LOCAL_RPC_URL,
  NETWORK_NAME,
  TARGET_CHAIN_ID,
} from "@/lib/addresses";

export default function Home() {
  const featureCards = [
    {
      href: "/register",
      title: "Music Registration",
      description:
        "Mint rights NFTs and define royalty splits like 50/30/20 in one on-chain transaction.",
    },
    {
      href: "/stream",
      title: "Streaming Simulator",
      description:
        "Input plays, preview split payouts, and distribute funds to all stakeholders automatically.",
    },
    {
      href: "/auctions",
      title: "Rights Auction",
      description:
        "List rights NFTs for auction, collect bids, and transfer future royalty ownership to winners.",
    },
    {
      href: "/my-rights",
      title: "My Rights",
      description:
        "Inspect tokens you own and tracks where you currently receive rights-holder royalties.",
    },
    {
      href: "/history",
      title: "Transaction History",
      description:
        "Track royalties, split payments, bids, refunds, and rights transfers with wallet-level filtering.",
    },
  ];

  return (
    <section className="stack-lg">
      <div className="hero-banner fade-in">
        <p className="eyebrow">Phase 3 Frontend</p>
        <h2 className="hero-title">Full Music Royalty and Auction dApp</h2>
        <p className="muted">
          Everything runs locally on Hardhat. Connect MetaMask, register tracks, simulate streaming,
          run auctions, and inspect payment events.
        </p>
      </div>

      <div className="panel stack-md">
        <h3 className="panel-title">Local Network Details</h3>

        <div className="snapshot-grid">
          <p>
            <strong>Network:</strong> {NETWORK_NAME}
          </p>
          <p>
            <strong>RPC:</strong> {LOCAL_RPC_URL}
          </p>
          <p>
            <strong>Chain ID:</strong> {TARGET_CHAIN_ID}
          </p>
          <p>
            <strong>MusicRightsNFT:</strong> {CONTRACT_ADDRESSES.MusicRightsNFT}
          </p>
          <p>
            <strong>RoyaltyManager:</strong> {CONTRACT_ADDRESSES.RoyaltyManager}
          </p>
          <p>
            <strong>RightsAuction:</strong> {CONTRACT_ADDRESSES.RightsAuction}
          </p>
        </div>
      </div>

      <div className="link-grid stagger-list">
        {featureCards.map((item) => (
          <Link key={item.href} href={item.href} className="link-card">
            <h3>{item.title}</h3>
            <p>{item.description}</p>
          </Link>
        ))}
      </div>

      <div className="panel stack-sm">
        <h3 className="panel-title">Suggested First Run</h3>
        <ol className="ordered-list">
          <li>Open Register page and create a new track using your wallet.</li>
          <li>Use Stream Sim page with 1000 plays to distribute royalties.</li>
          <li>Open Auctions page and list Token ID 1 for bidding.</li>
          <li>Review all resulting payouts in History page.</li>
        </ol>
      </div>

      <GuidedDemoFlow />
    </section>
  );
}
