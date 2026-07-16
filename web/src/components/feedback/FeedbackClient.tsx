"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { submitSuggestionAction } from "@/actions/feature-suggestions";
import type { FeatureSuggestion } from "@/lib/types";

interface FeedbackClientProps {
  initialSuggestions: FeatureSuggestion[];
}

export default function FeedbackClient({
  initialSuggestions,
}: FeedbackClientProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [suggestions, setSuggestions] =
    useState<FeatureSuggestion[]>(initialSuggestions);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!description.trim()) {
      toast.error("Description is required");
      return;
    }

    startTransition(async () => {
      try {
        await submitSuggestionAction(title.trim(), description.trim());
        toast.success("Suggestion submitted!");
        setSuggestions((prev) => [
          {
            id: Date.now(),
            user_email: "",
            title: title.trim(),
            description: description.trim(),
            created_at: new Date().toISOString(),
          },
          ...prev,
        ]);
        setTitle("");
        setDescription("");
      } catch {
        toast.error("Failed to submit suggestion");
      }
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          Suggest a Feature
        </h1>
        <p className="text-muted-foreground mt-1">
          Have an idea to improve CardParser? Let us know!
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
        <div>
          <label
            htmlFor="title"
            className="block text-sm font-medium mb-1"
          >
            Title
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Brief summary of your idea"
            className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div>
          <label
            htmlFor="description"
            className="block text-sm font-medium mb-1"
          >
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the feature in more detail"
            rows={4}
            className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-vertical"
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {isPending ? "Submitting…" : "Submit Suggestion"}
        </button>
      </form>

      <div>
        <h2 className="text-lg font-semibold mb-4">
          All Suggestions ({suggestions.length})
        </h2>
        {suggestions.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No suggestions yet. Be the first!
          </p>
        ) : (
          <div className="space-y-3">
            {suggestions.map((s) => (
              <div
                key={s.id}
                className="rounded-md border border-border p-4"
              >
                <h3 className="font-medium">{s.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {s.description}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {s.user_email && <>Submitted by {s.user_email} &middot; </>}
                  {new Date(s.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
