import TradeCalculator from "@/components/trade/TradeCalculator";

export const metadata = {
  title: "Trade Calculator",
};

export default function TradePage() {
  return (
    <div className="container mx-auto px-4 max-w-4xl py-6">
      <TradeCalculator />
    </div>
  );
}
