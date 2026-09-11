import { registerCommand } from "../registry";
import { execInActiveTab } from "../tab";

async function readCurrentTabBody(
    params?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
    const format = params?.format === "full" ? "full" : "text";

    const result = await execInActiveTab(
        (fmt: string) =>
            fmt === "full" ? document.body.outerHTML : document.body.innerText,
        [format],
    );

    const logged =
        format === "full" && result && result.length > 500
            ? `${result.slice(0, 500)}... (truncated, ${result.length} chars total)`
            : result;
    console.log(
        `[command.read.body] format=${format} result (${result?.length ?? 0} chars):`,
        logged,
    );
    return { body: result ?? "" };
}

registerCommand("command.read.body", readCurrentTabBody, "read_body");

export async function peekBodySizes(): Promise<{
    text: number;
    full: number;
} | null> {
    return execInActiveTab(
        () => ({
            text: document.body.innerText.length,
            full: document.body.outerHTML.length,
        }),
        [],
    );
}
