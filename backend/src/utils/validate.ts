import type { ZodSchema } from "zod";
import { errors } from "../domain/errors";

export function parseOrThrow<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw errors.validation(
      "Data yang dikirim tidak valid.",
      result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      }))
    );
  }
  return result.data;
}
