import { ModePicker } from "@/components/home/ModePicker";
import { StatusPanel } from "@/components/home/StatusPanel";
import ja from "@/messages/ja.json";

export function HomeScreen() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto px-4 py-6">
      <div className="flex max-w-2xl flex-col gap-2">
        <h1 className="text-2xl font-semibold text-foreground">{ja.home.title}</h1>
        <p className="text-sm text-muted-foreground">{ja.home.description}</p>
      </div>
      <section className="flex flex-col gap-3" aria-labelledby="home-start">
        <h2 id="home-start" className="text-base font-semibold text-foreground">
          {ja.home.startTitle}
        </h2>
        <ModePicker />
        <p className="text-xs text-muted-foreground">{ja.home.continueHint}</p>
      </section>
      <section className="flex flex-col gap-3" aria-labelledby="home-status">
        <h2 id="home-status" className="text-base font-semibold text-foreground">
          {ja.home.statusTitle}
        </h2>
        <StatusPanel />
      </section>
    </div>
  );
}
