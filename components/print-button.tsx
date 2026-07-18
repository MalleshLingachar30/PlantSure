'use client'

export function PrintButton() {
  return (
    <button className="command-button" type="button" onClick={() => window.print()}>
      Print board
    </button>
  )
}
