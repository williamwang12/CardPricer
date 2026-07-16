import { Suspense } from "react";
import ChartsClient from "@/components/charts/ChartsClient";

export default function ChartsPage() {
  return (
    <Suspense>
      <ChartsClient />
    </Suspense>
  );
}
