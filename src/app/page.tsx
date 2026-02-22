import { redirect } from 'next/navigation'

// Root URL handler — send all visitors to the login page.
// Authenticated users will be redirected onward to /dashboard by the login page.
export default function RootPage() {
  redirect('/login')
}
