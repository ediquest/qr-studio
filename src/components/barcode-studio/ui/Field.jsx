import React from 'react'

export default function Field({ label, children }) {
  return (
    <div className="vstack">
      <label className="small">{label}</label>
      {children}
    </div>
  )
}
