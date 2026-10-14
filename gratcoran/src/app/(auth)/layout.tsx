export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="pt-safe pb-safe relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-brand opacity-20 blur-3xl"
      />
      <div className="relative w-full max-w-sm py-10">{children}</div>
    </main>
  );
}
