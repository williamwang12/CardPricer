import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { signInWithGoogle, signInAsGuest } from "@/actions/auth";
import { VideoReel } from "@/components/VideoReel";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/inventory");

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-5xl mx-auto px-4 py-10 sm:py-16 flex flex-col items-center gap-10 sm:gap-16">
        {/* Hero */}
        <div className="flex flex-col items-center gap-6 text-center">
          <img src="/logo.svg" alt="Card Parser" className="w-14 h-14 rounded-2xl shadow-sm" />
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold tracking-tight">Card Parser</h1>
            <p className="text-sm text-muted-foreground">
              Price your cards in minutes, not hours
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <form action={signInWithGoogle}>
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-3 rounded-lg border border-border bg-white px-6 py-2.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Sign in with Google
              </button>
            </form>
            <form action={signInAsGuest}>
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-3 rounded-lg border border-border bg-white px-6 py-2.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                Continue as Guest
              </button>
            </form>
          </div>
        </div>

        {/* How It Works */}
        <div className="w-full max-w-2xl flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-center mb-2 sm:mb-4">How to Price in 5 Minutes</h2>
          <div className="flex flex-col gap-3 sm:gap-6">
            <div className="flex items-start gap-3 sm:gap-4">
              <span className="flex-none flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-zinc-900 text-white text-xs sm:text-sm font-semibold">1</span>
              <div>
                <p className="text-sm font-medium">Import your inventory</p>
                <p className="text-xs text-muted-foreground">
                  Upload a CSV export from Collectr, DeckTradr, or TCGPlayer. Your cards are matched and priced automatically.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 sm:gap-4">
              <span className="flex-none flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-zinc-900 text-white text-xs sm:text-sm font-semibold">2</span>
              <div>
                <p className="text-sm font-medium">We track what changed</p>
                <p className="text-xs text-muted-foreground">
                  Re-import anytime. We compare against your tracked inventory and surface newcomers and removed cards automatically.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 sm:gap-4">
              <span className="flex-none flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-zinc-900 text-white text-xs sm:text-sm font-semibold">3</span>
              <div>
                <p className="text-sm font-medium">Download only what you need</p>
                <p className="text-xs text-muted-foreground">
                  Export full price lists, or just newcomers and price movers since your last export. Print fewer labels, waste less paper.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Reel */}
        <VideoReel />
      </div>
    </div>
  );
}
