import type { ReactNode } from "react";
import { canAccess, getCurrentRole } from "@/lib/roles";
import { cn } from "@/lib/utils";

export function Can({
    feature,
    children,
    preserveLayout = false,
    placeholderClassName,
}: {
    feature: string;
    children: ReactNode;
    // When the feature is denied, reserve the same space with an empty,
    // invisible span instead of unmounting, so surrounding flex/grid layouts
    // don't reflow around the gap. Size it via placeholderClassName.
    preserveLayout?: boolean;
    placeholderClassName?: string;
}) {
    if (canAccess(getCurrentRole(), feature)) return <>{children}</>;
    if (preserveLayout) {
        return <span className={cn("invisible", placeholderClassName)} />;
    }
    return null;
}
