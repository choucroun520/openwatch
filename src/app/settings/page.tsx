import AppLayout from "@/components/layout/app-layout"

export const metadata = { title: "Settings — OpenWatch" }

export default function SettingsPage() {
  return (
    <AppLayout>
      <div className="max-w-lg mx-auto py-20 text-center">
        <div
          className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 text-2xl"
          style={{ background: "#1E1E2E" }}
        >
          ⚙️
        </div>
        <h1 className="text-2xl font-black text-white mb-2">Settings</h1>
        <p style={{ color: "#8A939B" }}>Account settings coming soon.</p>
      </div>
    </AppLayout>
  )
}
