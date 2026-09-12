const roleFeatureMap: Record<string, Set<string>> = {
    anonymous: new Set(),
    dev: new Set(["chat.attachment"]),
};

export function getCurrentRole(): string {
    return localStorage.getItem("role") === "dev" ? "dev" : "anonymous";
}

export function canAccess(role: string, feature: string): boolean {
    return roleFeatureMap[role]?.has(feature) ?? false;
}
