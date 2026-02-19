import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import FormularClient from "./formular-client";

export default async function FormularPage() {
  const user = await getCurrentUser().catch(() => null);
  const branche = (user as unknown as { firma?: { branche?: string } } | null)?.firma?.branche;

  if (branche === "SHOP") {
    redirect("/app/shop-formular");
  }

  return <FormularClient />;
}
