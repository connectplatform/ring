FROM node:20-alpine
WORKDIR /app
COPY package.json tsconfig.json ./
RUN npm install
COPY src ./src
RUN npm run build
ENV PORT=5008
EXPOSE 5008
CMD ["npm", "start"]
