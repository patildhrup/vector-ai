from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import router

app = FastAPI()

# Allow both standard local vite and any other common ports
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include the routes
app.include_router(router)

@app.get("/")
async def root():
    return {"message": "Backend Connected"}

@app.get("/api/hello")
async def hello():
    return {
        "name": "Dhrup",
        "message": "Hello from FastAPI"
    }