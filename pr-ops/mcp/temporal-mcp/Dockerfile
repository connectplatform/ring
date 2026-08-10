FROM node:20-alpine
WORKDIR /app
COPY package.json tsconfig.json ./
RUN npm install
COPY src ./src
RUN npm run build
ENV PORT=3300
EXPOSE 3300
CMD ["npm", "start"]
