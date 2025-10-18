from fastapi import FastAPI
from .routers import auth, tasks, chat, dutyplan, inventory

app = FastAPI(title="MühleConnect API")

app.include_router(auth.router, prefix="/auth")
app.include_router(tasks.router, prefix="/tasks")
app.include_router(chat.router, prefix="/chat")
app.include_router(dutyplan.router, prefix="/dutyplan")
app.include_router(inventory.router, prefix="/inventory")

@app.get("/")
def root():
    return {"status": "ok", "message": "MühleConnect API online"}
