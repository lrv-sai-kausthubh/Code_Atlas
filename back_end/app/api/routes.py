from fastapi import APIRouter

router = APIRouter()


@router.get("/")
def root():
    return {
        "message": "Welcome to CodeAtlas Backend 🚀"
    }


@router.get("/api/status")
def status():
    return {
        "status": "working",
        "message": "Frontend and Backend Connected Successfully!"
    }