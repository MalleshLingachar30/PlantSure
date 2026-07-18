'use client'

import { SignOutButton } from '@clerk/nextjs'
import { LogOut } from 'lucide-react'

export function SignOutControl() {
  return (
    <SignOutButton redirectUrl="/">
      <button className="internal-signout" type="button">
        <LogOut size={16} aria-hidden="true" />
        <span>Sign out</span>
      </button>
    </SignOutButton>
  )
}
