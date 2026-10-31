import { ZodSchema } from "zod";

export const validateForm = <T>(
  schema: ZodSchema<T>,
  data: unknown
): {
  success: boolean;
  data?: T;
  errors?: Record<string, string>;
} => {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors: Record<string, string> = {};

  result.error.issues.forEach((err) => {
    const field = err.path[0];
    if (field) {
      errors[field as string] = err.message;
    }
  });

  return { success: false, errors };
};
