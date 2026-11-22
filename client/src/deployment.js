export const GITHUB_DEPLOYMENT = import.meta.env?.VITE_GITHUB_DEPLOYMENT === 'true';
export const STATIC_DEPLOYMENT = !GITHUB_DEPLOYMENT && import.meta.env?.VITE_STATIC_DEPLOYMENT === 'true';
export const BRCLIO_DEPLOYMENT = GITHUB_DEPLOYMENT || STATIC_DEPLOYMENT;

export const SITE_URL = 'https://klarbase.brclio.com';
export const BRAND_URL = 'https://brclio.com';
export const PERSONAL_URL = 'https://bornforthis.cn';
export const REPO_URL = 'https://github.com/Brclio/Brclio-klarbase';
export const MAINTAINER_URL = 'https://github.com/AndersonHJB';
export const CONTACT_EMAIL = 'bornforthis@bornforthis.cn';
