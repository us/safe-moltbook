// Site configuration - uses environment variable
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export const getSiteUrl = () => SITE_URL;

export const getApiUrl = () => `${SITE_URL}/api`;
