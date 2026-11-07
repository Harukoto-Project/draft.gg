"use client";

import { usePathname } from "next/navigation";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { navItemForPath } from "@/config/navigation";

export function AppBreadcrumb() {
  const pathname = usePathname();
  const current = navItemForPath(pathname);

  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="flex-nowrap">
        <BreadcrumbItem className="min-w-0">
          <BreadcrumbPage className="truncate text-foreground">
            {current?.label ?? ""}
          </BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
