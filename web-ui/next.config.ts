import { config } from 'dotenv';
import path from 'path';

config({ path: path.resolve(__dirname, '../.env') });

// NOTE: there used to be a `rewrites()` proxying /api/:path* straight to the desktop client.
// It never actually worked - Next's own filesystem app/api/* routes always take precedence
// over rewrites, so it silently shadowed itself. The Next.js API route handlers now proxy to
// the desktop client explicitly instead (see src/lib/desktop-client.ts), which is reachable
// and testable in a way a rewrite rule never was.
const nextConfig = {};

export default nextConfig;