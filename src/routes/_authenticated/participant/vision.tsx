import { createFileRoute } from "@tanstack/react-router";
import { VisionBoardPage } from "@/components/participant/vision-board";

export const Route = createFileRoute("/_authenticated/participant/vision")({
  head: () => ({ meta: [{ title: "My Vision · VKM" }] }),
  component: () => <VisionBoardPage />,
});
