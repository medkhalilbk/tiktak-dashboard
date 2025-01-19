FROM node:18.17.1-slim
WORKDIR /app
COPY package*.json ./
RUN npm install
RUN npm i -g prisma@5.19.0
COPY . .
EXPOSE 3000
RUN apt-get update -y && apt-get install -y openssl
CMD ["npm", "run", "start:prod"]