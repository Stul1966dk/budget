export function isAllowedEmail(email: string): boolean {
  const allowed = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  return allowed.includes(email.trim().toLowerCase());
}
