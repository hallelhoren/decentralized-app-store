import { config } from 'dotenv';
import path from 'path';

config({ path: path.resolve(__dirname, '../.env') });

const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `http://localhost:${process.env.DESKTOP_API_PORT}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;