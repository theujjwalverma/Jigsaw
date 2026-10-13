FROM node:22-alpine
WORKDIR /app
COPY backend/package*.json ./backend/
RUN cd backend && npm install
COPY backend ./backend
EXPOSE 5000
CMD ["npm", "--prefix", "backend", "run", "dev"]
