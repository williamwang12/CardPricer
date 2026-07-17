import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getTransactions } from "@/lib/db/transactions";
import { loadAllCardsCached } from "@/lib/db/cards";
import TransactionClient from "@/components/transactions/TransactionClient";

export default async function TransactionsPage() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/login");

  const [transactions, cards] = await Promise.all([
    getTransactions(email, 100),
    loadAllCardsCached(email),
  ]);

  return (
    <TransactionClient
      initialTransactions={transactions}
      cardNames={cards.map((c) => ({ name: c.name, number: c.number }))}
    />
  );
}
