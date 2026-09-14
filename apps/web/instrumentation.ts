export async function register() {
  // Only run background jobs in the Node runtime (not edge / build).
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { migrateServerConnections } = await import("./lib/server/migrate-connections");
    await migrateServerConnections();
    await import("./lib/server/scheduler");
  }
}
