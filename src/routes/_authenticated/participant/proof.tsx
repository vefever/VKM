import { createFileRoute } from "@tanstack/react-router";
import { ProofSubmit } from "@/components/participant/proof-submit";

export const Route = createFileRoute("/_authenticated/participant/proof")({
  head: () => ({ meta: [{ title: "Submit Proof · VKM" }] }),
  component: ProofSubmit,
});
