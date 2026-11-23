export function Skeleton() {
  return (
    <div aria-busy="true" className="animate-pulse space-y-3 pt-2">
      <div className="h-10 w-24 rounded-xl bg-pink-soft" />
      <div className="h-9 w-48 rounded-xl bg-pink-soft" />
      <div className="h-24 rounded-3xl bg-pink-soft" />
      <div className="h-20 rounded-3xl bg-pink-soft" />
      <div className="h-20 rounded-3xl bg-pink-soft" />
    </div>
  );
}
