import { Info } from "lucide-react";

import { StatusList } from "@/components/status/StatusList";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useStatus } from "@/hooks/use-status";
import ja from "@/messages/ja.json";

/** データの更新状況と、Riot Games などの権利表記 */
export function InfoDialog() {
  const status = useStatus();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 gap-1.5 px-2 text-xs">
          <Info aria-hidden="true" />
          {ja.status.info}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{ja.status.info}</DialogTitle>
          <DialogDescription>{ja.status.infoDescription}</DialogDescription>
        </DialogHeader>
        <section className="flex flex-col gap-2" aria-labelledby="info-data">
          <h3 id="info-data" className="text-sm font-semibold text-foreground">
            {ja.status.dataTitle}
          </h3>
          {status.data ? (
            <StatusList status={status.data} />
          ) : (
            <p className="text-sm text-muted-foreground">{ja.status.loadError}</p>
          )}
        </section>
        <section className="flex flex-col gap-2" aria-labelledby="info-legal">
          <h3 id="info-legal" className="text-sm font-semibold text-foreground">
            {ja.status.legalTitle}
          </h3>
          <div className="flex flex-col gap-1.5 text-xs leading-relaxed text-muted-foreground">
            <p>{ja.footer.riot}</p>
            <p>{ja.footer.sources}</p>
          </div>
        </section>
      </DialogContent>
    </Dialog>
  );
}
