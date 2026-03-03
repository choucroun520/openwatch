import { redirect } from "next/navigation"

// DEV MODE: skip auth, go straight to network
export default function HomePage() {
  redirect("/network")
}
