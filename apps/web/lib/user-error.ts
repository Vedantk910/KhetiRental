/** An Error whose message is already translated for the user. Any other error shows the generic fallback instead. */
export class UserError extends Error {}

export const userMessage = (e: unknown, fallback: string) => (e instanceof UserError ? e.message : fallback);
