# DeenTogether — VPS-এ চালানোর জন্য ছবি (image)।
# সাধারণত সরাসরি নয়, রিপোর deploy/ ফোল্ডারের docker compose দিয়ে বানানো হয়।
#
# তিন ধাপ: নির্ভরতা নামানো → বিল্ড → শুধু চালানোর যা লাগে। শেষের ছবিতে
# সোর্স কোড বা node_modules-এর বাড়তি কিছু থাকে না, কেবল Next-এর standalone
# সার্ভার, static ফাইল আর public/।

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_OUTPUT=standalone
# NEXT_PUBLIC_ দিয়ে শুরু মান ব্রাউজারের কোডে বিল্ডের সময়েই বসে যায়, তাই এখানেই লাগে।
# পুশ নোটিফিকেশনের এই চাবি আগের মতোই রাখতে হবে — বদলালে ফোনগুলোর আগের
# নোটিফিকেশন-সংযোগ আর কাজ করবে না।
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY=""
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY
RUN npm run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/manifest.json || exit 1
CMD ["node", "server.js"]
