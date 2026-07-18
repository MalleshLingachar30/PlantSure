'use client'

import { Printer } from 'lucide-react'

export function PrintButton() {
  return (
    <button className="command-button" type="button" onClick={() => window.print()}>
      <Printer size={16} aria-hidden="true" />
      <span>Print board</span>
    </button>
  )
}
