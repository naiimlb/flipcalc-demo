import { Backdrop } from "@/components/Backdrop";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="pt-safe pb-safe relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-6">
      <Backdrop />
      <div className="relative w-full max-w-sm py-10">{children}</div>
    </main>
  );
}
