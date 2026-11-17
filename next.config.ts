import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // CSV-upload går gennem en server action. Lidt over upload-grænsen på
      // 2 MB (se upload/actions.ts), så for store filer får den danske
      // fejlbesked i stedet for en generisk fejl fra Next.js.
      bodySizeLimit: "3mb",
    },
  },
};

export default nextConfig;
