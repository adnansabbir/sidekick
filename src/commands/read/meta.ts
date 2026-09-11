import { registerCommand } from "../registry";
import { execInActiveTab } from "../tab";

async function readCurrentTabMetaData(): Promise<Record<string, unknown>> {
    const result = await execInActiveTab(
        () => ({
            title: document.title,
            url: location.href,
            description:
                document
                    .querySelector('meta[name="description"]')
                    ?.getAttribute("content") ?? null,
        }),
        [],
    );

    console.log("[command.read.meta_data] result:", result);
    return result ?? {};
}

registerCommand(
    "command.read.meta_data",
    readCurrentTabMetaData,
    "read_meta_data",
);
