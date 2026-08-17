import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { isAxiosError } from 'axios';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
