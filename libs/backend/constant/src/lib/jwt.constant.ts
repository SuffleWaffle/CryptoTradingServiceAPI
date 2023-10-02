import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

// todo: set JWT_SECRET environment variable
export const JWT_SECRET = process.env.JWT_SECRET || 'dont-forget-setup-secret';
