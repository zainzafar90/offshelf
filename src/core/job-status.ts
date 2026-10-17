import type { JobStatus } from './model';

export const isActiveJob = (status: JobStatus): boolean => status === 'capturing' || status === 'downloading';
