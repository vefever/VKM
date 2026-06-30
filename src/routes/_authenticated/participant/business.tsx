import { createFileRoute } from "@tanstack/react-router";
import { MyBusinessPage } from "@/components/business/my-business-page";

export const Route = createFileRoute("/_authenticated/participant/business")({
  head: () => ({ meta: [{ title: "My Business · VKM" }] }),
  component: MyBusinessPage,
});
