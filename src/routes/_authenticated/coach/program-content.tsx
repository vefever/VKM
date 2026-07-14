import { createFileRoute } from "@tanstack/react-router";
import { ProgramDesign } from "@/components/admin/program-design";

export const Route = createFileRoute("/_authenticated/coach/program-content")({
  head: () => ({ meta: [{ title: "Program Videos & Files · VKM" }] }),
  component: () => (
    <ProgramDesign
      eyebrow="Coach"
      title="Program Videos & Files"
      description="Upload the class video, thumbnail and any downloads for each week of a batch. You can't change the program structure — only its videos and files."
    />
  ),
});
