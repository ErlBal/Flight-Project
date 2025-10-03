from fastapi import APIRouter

router = APIRouter()

@router.get("/")
def list_flights():
    return {"items": [], "total": 0}

@router.get("/{flight_id}")
def flight_detail(flight_id: int):
    return {"id": flight_id}
