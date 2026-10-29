/** Make the current Neon TLS behavior explicit for pg's upcoming SSL mode change. */
export function normalizeNeonConnectionString(connectionString: string): string {
    const url = new URL(connectionString);
    if (url.searchParams.get("sslmode") === "require") {
        url.searchParams.set("sslmode", "verify-full");
    }
    return url.toString();
}
