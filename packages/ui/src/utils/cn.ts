import clsx, { type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Compose Tailwind classes. `clsx` flattens conditional inputs; `tailwind-merge`
// dedupes conflicting utility classes so a caller-provided className wins over
// the component's defaults (e.g. <Button className="bg-stage"> beats `bg-action`).
export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));
