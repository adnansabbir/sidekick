import { XIcon } from "lucide-react";
import { strings } from "@/i18n";

export function MicPermissionNotice({ onDismiss }: { onDismiss: () => void }) {
    return (
        <div
            role="alert"
            className="border-border bg-muted/50 flex items-start gap-3 border-t px-4 py-3"
        >
            <p className="text-muted-foreground flex-1 text-xs leading-5">
                {strings.permission.micNoticeBody}{" "}
                <a
                    href={chrome.runtime.getURL("src/permission.html")}
                    target="_blank"
                    rel="noreferrer"
                    className="text-foreground font-medium underline underline-offset-2"
                >
                    {strings.permission.micNoticeAction}
                </a>
            </p>
            <button
                type="button"
                onClick={onDismiss}
                aria-label={strings.permission.micNoticeDismiss}
                className="text-muted-foreground hover:text-foreground -mr-1 shrink-0 rounded p-1"
            >
                <XIcon className="size-3.5" />
            </button>
        </div>
    );
}
