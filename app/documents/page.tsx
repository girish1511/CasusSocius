import { redirect } from "next/navigation";

// Superseded by the per-subject Documents section on the home page now that
// subjects (courses) are the primary navigation structure.
export default function DocumentsPage() {
  redirect("/");
}
