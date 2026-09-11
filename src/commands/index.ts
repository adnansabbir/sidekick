import "./read/meta";
import { assertManifestConsistency } from "./registry";

export {
    runCommand,
    findCommandInText,
    listCommands,
    formatAgentTools,
} from "./registry";
export { peekBodySizes } from "./read/body";

assertManifestConsistency();
