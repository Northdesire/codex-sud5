import { prisma } from "./db";
import { createClient } from "./supabase/server";

export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  const user = await prisma.user.findUnique({
    where: { email: authUser.email! },
    include: { firma: true },
  });

  return user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Nicht eingeloggt");
  return user;
}
