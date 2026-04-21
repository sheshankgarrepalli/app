#!/bin/bash

# Start the backend server
cd backend
python3 -m uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!

# Start the frontend server
cd ../frontend
npm run dev -- --port 5173 &
FRONTEND_PID=$!

echo "Systems are up and running!"
echo "Backend: http://localhost:8000"
echo "Frontend: http://localhost:5173"

# Wait for both background processes
wait $BACKEND_PID $FRONTEND_PID
