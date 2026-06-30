import { createFileRoute } from "@tanstack/react-router";
import { ProofReviews } from "@/components/coach/proof-reviews";

export const Route = createFileRoute("/_authenticated/coach/approve")({
  head: () => ({ meta: [{ title: "Proof Reviews · VKM" }] }),
  component: ProofReviews,
});
