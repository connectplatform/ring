FROM node:22-alpine
WORKDIR /app
COPY package.json tsconfig.json ./
RUN npm install
COPY src ./src
RUN npm run build
ENV PORT=4000
EXPOSE 4000
CMD ["npm", "start"]
