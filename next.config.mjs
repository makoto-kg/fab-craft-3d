/** @type {import('next').NextConfig} */
const basePath = process.env.BASE_PATH || '';

const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  // BASE_PATH env var sets the context root for deployment under a sub-path
  // e.g. BASE_PATH=/fab-craft-3d → served at https://example.com/fab-craft-3d/
  ...(basePath ? { basePath } : {}),
  // Expose basePath to client code (GLTFLoader etc.) via NEXT_PUBLIC_BASE_PATH
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
