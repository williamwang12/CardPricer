"use client";

import { useState } from "react";
import Link from "next/link";
import { UserRound, Star, ChevronDown, ExternalLink } from "lucide-react";
import { useCurrency } from "@/components/currency-context";
import MessageButton from "@/components/messages/MessageButton";
import type { DirectoryVendor } from "@/lib/types";

interface Props {
  vendors: DirectoryVendor[];
  eventId: number;
}

export default function VendorDirectory({ vendors, eventId }: Props) {
  const { fmt } = useCurrency();
  const [open, setOpen] = useState<Set<string>>(new Set());

  const toggle = (email: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });

  if (vendors.length === 0) {
    return (
      <div className="rounded-lg border py-12 text-center">
        <p className="text-sm text-muted-foreground">
          No other approved vendors at this show yet.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {vendors.map((v) => {
        const expanded = open.has(v.email);
        const cards = v.cards; // already featured-first from buildVendorDirectory
        return (
          <div key={v.email} className="rounded-lg border flex flex-col">
            <div className="p-4 flex items-start gap-3">
              {v.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={v.avatarUrl}
                  alt={v.storeName ?? v.email}
                  className="w-12 h-12 rounded-full object-cover ring-1 ring-border flex-shrink-0"
                />
              ) : (
                <span className="w-12 h-12 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                  <UserRound className="h-5 w-5 text-muted-foreground" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">
                    {v.storeName || v.email}
                  </span>
                  <Link
                    href={`/vendors/${encodeURIComponent(v.email)}`}
                    className="text-muted-foreground hover:text-foreground"
                    title="View profile"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </div>
                {v.boothLabel && (
                  <div className="text-xs text-muted-foreground">
                    Booth {v.boothLabel}
                  </div>
                )}
                {v.specialties.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {v.specialties.slice(0, 4).map((s) => (
                      <span
                        key={s}
                        className="text-[11px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-2">
                  <MessageButton otherEmail={v.email} eventId={eventId} />
                </div>
              </div>
            </div>

            <button
              onClick={() => toggle(v.email)}
              className="border-t px-4 py-2 text-sm text-muted-foreground hover:bg-muted/30 flex items-center justify-between"
            >
              <span>
                {v.cards.length} card{v.cards.length === 1 ? "" : "s"} in showcase
              </span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
              />
            </button>

            {expanded && v.cards.length > 0 && (
              <div className="border-t max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {cards.map((c, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="px-4 py-1.5">
                          <span className="inline-flex items-center gap-1.5">
                            {c.is_featured && (
                              <Star className="h-3.5 w-3.5 fill-current text-amber-500" />
                            )}
                            {c.name}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-muted-foreground w-16">
                          {c.number || "—"}
                        </td>
                        <td className="px-4 py-1.5 text-right font-mono w-24">
                          {c.asking_price != null
                            ? fmt(c.asking_price)
                            : fmt(c.market_price)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
