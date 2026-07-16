import { auth } from "@/lib/auth";
import Nav from "@/components/nav";
import { CurrencyProvider } from "@/components/currency-context";
import { isAdmin } from "@/lib/admin";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <CurrencyProvider>
      <div className="min-h-screen flex flex-col">
        <Nav user={session?.user ?? null} isAdmin={isAdmin(session?.user?.email)} />
        <main className="flex-1 container mx-auto px-4 py-6 max-w-7xl w-full">
          {children}
        </main>
      </div>
    </CurrencyProvider>
  );
}
