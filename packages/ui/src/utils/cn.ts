import clsx, { type ClassValue } from 'clsx';

// Tiny class-name helper used by components. `clsx` flattens conditional classes.
export const cn = (...inputs: ClassValue[]): string => clsx(inputs);
