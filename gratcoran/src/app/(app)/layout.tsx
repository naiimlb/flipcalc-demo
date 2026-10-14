import { TabBar } from "@/components/TabBar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="pt-safe min-h-[100dvh]">{children}</div>
      <TabBar />
    </>
  );
}
