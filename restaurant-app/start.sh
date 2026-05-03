#!/bin/bash
# Arranca backend y frontend en paralelo

echo "=== RestaurantManager ==="
echo "Asegúrate de tener ANTHROPIC_API_KEY en backend/.env"
echo ""

# Start backend
cd backend && node server.js &
BACKEND_PID=$!
echo "Backend iniciado (PID $BACKEND_PID) en http://localhost:3001"

# Start frontend
cd ../frontend && npm run dev &
FRONTEND_PID=$!
echo "Frontend iniciado (PID $FRONTEND_PID) en http://localhost:5173"

echo ""
echo "Pulsa Ctrl+C para parar todo"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
