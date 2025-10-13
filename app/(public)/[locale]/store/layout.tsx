import React from 'react'

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="md:ml-[280px]">
      {children}
    </div>
  )
}


