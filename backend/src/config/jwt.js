import dotenv from 'dotenv';

dotenv.config();

const DEFAULT_SECRET = 'your-secret-key-change-this-in-production';
const DEFAULT_REFRESH = 'your-refresh-secret-key-change-this-in-production';

// Warn if using insecure defaults in production
if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === DEFAULT_SECRET) {
    console.error('FATAL: JWT_SECRET is not set or using insecure default. Set a strong secret in .env');
    process.exit(1);
  }
  if (!process.env.JWT_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET === DEFAULT_REFRESH) {
    console.error('FATAL: JWT_REFRESH_SECRET is not set or using insecure default. Set a strong secret in .env');
    process.exit(1);
  }
}

/**
 * JWT configuration
 */
export const jwtConfig = {
  secret: process.env.JWT_SECRET || DEFAULT_SECRET,
  expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  refreshSecret: process.env.JWT_REFRESH_SECRET || DEFAULT_REFRESH,
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
};

export default jwtConfig;
