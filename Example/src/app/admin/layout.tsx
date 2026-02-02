export const metadata = {
  title: 'TutorCat Admin - Administrator Dashboard',
  description: 'TutorCat administrator dashboard for content management',
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen -mt-16 pt-0">
      {children}
    </div>
  )
}
