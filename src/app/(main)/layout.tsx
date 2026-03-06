import { AppPanelProvider, AppPanelInset } from "@/components/ui/app-panel";
import { AppSidebar } from "@/components/app-sidebar";
import { getTrails } from "@/lib/trails";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const trails = getTrails();

  return (
    <AppPanelProvider defaultOpen={true}>
      <AppSidebar trails={trails} />
      <AppPanelInset className="h-svh overflow-hidden">
        {children}
      </AppPanelInset>
    </AppPanelProvider>
  );
}
