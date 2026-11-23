from fastapi import FastAPI, Request
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from pathlib import Path

templates = Jinja2Templates(directory="card_design")

app = FastAPI()
app.mount("/assets", StaticFiles(directory="assets"), name="assets")
app.mount("/data", StaticFiles(directory=Path(__file__).parent.parent / "data"), name="data")

@app.get("/")
def home(request: Request):
    return templates.TemplateResponse(request, "index.html")

@app.get("/single-card")
def single_card(request: Request):
    return templates.TemplateResponse(request, "single_card.html")

@app.get("/card-per-event")
def card_per_event(request: Request):
    return templates.TemplateResponse(request, "card_per_event.html")