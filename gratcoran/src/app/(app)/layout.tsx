import { Backdrop } from "@/components/Backdrop";
import { TabBar } from "@/components/TabBar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Backdrop />
      <div className="pt-safe min-h-[100dvh]">{children}</div>
      <TabBar />
    </>
  );
}
