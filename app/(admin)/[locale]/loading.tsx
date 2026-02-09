export default function AdminLoading() {
  return (
    <div className="animate-pulse p-6 space-y-4">
      <div className="h-8 bg-muted rounded w-1/3"></div>
      <div className="h-4 bg-muted rounded w-2/3"></div>
      <div className="h-64 bg-muted rounded"></div>
      <div className="grid grid-cols-3 gap-4">
        <div className="h-32 bg-muted rounded"></div>
        <div className="h-32 bg-muted rounded"></div>
        <div className="h-32 bg-muted rounded"></div>
      </div>
    </div>
  )
}
