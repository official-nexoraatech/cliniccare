import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { isAxiosError } from 'axios';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** "Field Xyz" → "field_xyz". Used to suggest a field key from its label (Patient/Medicine Fields). */
export function slugify(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** Surfaces the API's actual error message instead of a generic fallback. */
export function getErrorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (isAxiosError(error)) {
    if (error.response) {
      return (
        (error.response.data as { message?: string } | undefined)?.message ??
        `Request failed (HTTP ${error.response.status})`
      );
    }
    return 'Could not reach the ClinicCare server. Is the API running?';
  }
  return fallback;
}
