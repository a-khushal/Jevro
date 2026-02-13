export const PORT = Number(process.env.PORT ?? 8080);
export const TOKEN_SECRET = process.env.TOKEN_SECRET ?? "local-dev-secret-change-me";
export const TOKEN_TTL_SECONDS = Number(process.env.TOKEN_TTL_SECONDS ?? 600);
