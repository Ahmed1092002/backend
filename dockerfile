from node:22-alpine

workdir /app

copy package.json package-lock.json ./

run npm ci

copy . .

RUN npx prisma generate

expose 3000

CMD ["npm", "run", "dev:server"]