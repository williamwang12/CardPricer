"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logBuyAction, logSellAction } from "@/actions/transactions";
import type { Transaction } from "@/lib/types";

interface Props {
  initialTransactions: Transaction[];
  cardNames: { name: string; number: string }[];
}

function fmt(amount: number) {
  return `$${amount.toFixed(2)}`;
}

function formatDate(isoString: string) {
  return new Date(isoString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TransactionClient({ initialTransactions, cardNames }: Props) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [type, setType] = useState<"buy" | "sell">("buy");
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [amount, setAmount] = useState("");
  const [, startTransition] = useTransition();

  // Auto-fill number when a known card name is selected
  const handleNameChange = (value: string) => {
    setCardName(value);
    const match = cardNames.find(
      (c) => c.name.toLowerCase() === value.toLowerCase()
    );
    if (match) setCardNumber(match.number);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardName.trim()) {
      toast.error("Card name is required");
      return;
    }
    const qty = parseInt(quantity, 10);
    const amt = parseFloat(amount);
    if (isNaN(qty) || qty < 1) {
      toast.error("Quantity must be at least 1");
      return;
    }
    if (isNaN(amt) || amt < 0) {
      toast.error("Amount must be a non-negative number");
      return;
    }

    startTransition(async () => {
      try {
        if (type === "buy") {
          await logBuyAction(cardName.trim(), cardNumber.trim(), qty, amt);
          const newTx: Transaction = {
            id: Date.now(),
            type: "buy",
            card_name: cardName.trim(),
            card_number: cardNumber.trim(),
            quantity: qty,
            amount: amt,
            user_email: "",
            created_at: new Date().toISOString(),
          };
          setTransactions((prev) => [newTx, ...prev]);
          toast.success(`Logged buy: ${cardName}`);
        } else {
          const err = await logSellAction(
            cardName.trim(),
            cardNumber.trim(),
            qty,
            amt
          );
          if (err) {
            toast.error(err);
            return;
          }
          const newTx: Transaction = {
            id: Date.now(),
            type: "sell",
            card_name: cardName.trim(),
            card_number: cardNumber.trim(),
            quantity: qty,
            amount: amt,
            user_email: "",
            created_at: new Date().toISOString(),
          };
          setTransactions((prev) => [newTx, ...prev]);
          toast.success(`Logged sell: ${cardName}`);
        }
        setCardName("");
        setCardNumber("");
        setQuantity("1");
        setAmount("");
      } catch {
        toast.error("Failed to log transaction");
      }
    });
  };

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold">Transactions</h1>

      {/* Log form */}
      <div className="rounded-lg border p-6 max-w-md">
        <h2 className="text-base font-semibold mb-4">Log Transaction</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Buy / Sell toggle */}
          <div className="flex rounded-md border overflow-hidden w-fit">
            <button
              type="button"
              onClick={() => setType("buy")}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                type === "buy"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              }`}
            >
              <TrendingUp className="h-4 w-4 inline mr-1.5 -mt-0.5" />
              Buy
            </button>
            <button
              type="button"
              onClick={() => setType("sell")}
              className={`px-4 py-2 text-sm font-medium border-l transition-colors ${
                type === "sell"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              }`}
            >
              <TrendingDown className="h-4 w-4 inline mr-1.5 -mt-0.5" />
              Sell
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="tx-name">
              Card Name *
            </label>
            <input
              id="tx-name"
              list="tx-names"
              value={cardName}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Charizard EX"
              required
              className="h-9 rounded-md border border-input px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <datalist id="tx-names">
              {cardNames.map((c, i) => (
                <option key={i} value={c.name} />
              ))}
            </datalist>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="tx-number">
              Card Number
            </label>
            <input
              id="tx-number"
              value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value)}
              placeholder="e.g. 151/165"
              className="h-9 rounded-md border border-input px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div className="flex gap-4">
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="text-sm font-medium" htmlFor="tx-qty">
                Quantity
              </label>
              <input
                id="tx-qty"
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="h-9 rounded-md border border-input px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="text-sm font-medium" htmlFor="tx-amount">
                Amount ($)
              </label>
              <input
                id="tx-amount"
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="h-9 rounded-md border border-input px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          <Button type="submit" className="w-fit">
            Log {type === "buy" ? "Buy" : "Sell"}
          </Button>
        </form>
      </div>

      {/* History */}
      <div className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">History</h2>
        {transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No transactions yet.</p>
        ) : (
          <>
            {/* Mobile card list */}
            <div className="sm:hidden rounded-lg border divide-y">
              {transactions.map((tx) => (
                <div key={tx.id} className="px-3 py-3 flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                        tx.type === "buy"
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {tx.type === "buy" ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      {tx.type}
                    </span>
                    <span className="font-mono font-semibold text-sm">{fmt(tx.amount)}</span>
                  </div>
                  <p className="text-sm font-medium">
                    {tx.card_name}
                    {tx.card_number && (
                      <span className="text-muted-foreground font-normal ml-1">
                        #{tx.card_number}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Qty: {tx.quantity} · {formatDate(tx.created_at)}
                  </p>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block rounded-lg border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="h-10 px-3 text-left font-medium text-muted-foreground w-16">
                      Type
                    </th>
                    <th className="h-10 px-3 text-left font-medium text-muted-foreground">
                      Card
                    </th>
                    <th className="h-10 px-3 text-left font-medium text-muted-foreground w-28">
                      Number
                    </th>
                    <th className="h-10 px-3 text-right font-medium text-muted-foreground w-16">
                      Qty
                    </th>
                    <th className="h-10 px-3 text-right font-medium text-muted-foreground w-24">
                      Amount
                    </th>
                    <th className="h-10 px-3 text-right font-medium text-muted-foreground w-40">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                            tx.type === "buy"
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {tx.type === "buy" ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          {tx.type}
                        </span>
                      </td>
                      <td className="px-3 py-2">{tx.card_name}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {tx.card_number || "—"}
                      </td>
                      <td className="px-3 py-2 text-right">{tx.quantity}</td>
                      <td className="px-3 py-2 text-right font-mono">
                        {fmt(tx.amount)}
                      </td>
                      <td className="px-3 py-2 text-right text-muted-foreground text-xs">
                        {formatDate(tx.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
