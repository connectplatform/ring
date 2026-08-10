FROM node:20-alpine
WORKDIR /app
COPY package.json tsconfig.json ./
RUN npm install
COPY src ./src
RUN npm run build
ENV PORT=3100
EXPOSE 3100
CMD ["npm", "start"]
