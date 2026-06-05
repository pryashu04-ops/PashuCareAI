# Use a Node.js base image
FROM node:18-slim

# Install Python, virtual environment, and packages required by OpenCV
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    build-essential \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy and install Node.js backend dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm install --production

# Copy Python requirements file
COPY backend/requirements.txt ./backend/

# Create python virtual environment and install requirements
RUN python3 -m venv backend/venv && \
    . backend/venv/bin/activate && \
    pip install --upgrade pip && \
    pip install -r backend/requirements.txt

# Copy all project files (ignoring files specified in .gitignore)
COPY . .

# Set working directory to the backend folder
WORKDIR /app/backend

# Expose backend port
EXPOSE 8000

# Start the Node.js Express server
CMD ["node", "server.js"]
