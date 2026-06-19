import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const TEST_CID = process.env.BW_TEST_COMPANY_ID || 'bwtest';
export const ADMIN_KEY = process.env.BW_ADMIN_KEY || 'bookawaka-admin-2026';
export const BASE_URL = process.env.REGRESSION_BASE_URL || 'http://127.0.0.1:5099';
export const DP = '/DataManager/Data.aspx/DataProcessor';
export const DSR = '/DataManager/Data.aspx/DataSelectorRide';
export const REPO_ROOT = path.resolve(__dirname, '../..');
export const TEST_DATA_DIR = process.env.BW_DATA_DIR || path.join(REPO_ROOT, '.data-regtest');

export function requireFirebaseSecret() {
  if (!process.env.BW_FIREBASE_SECRET) {
    throw new Error(
      'BW_FIREBASE_SECRET is required for regression tests (Firebase sync assertions). ' +
        'Set it in the environment before running npm run test:regression.',
    );
  }
}
