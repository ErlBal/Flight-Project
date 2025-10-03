from fastapi import APIRouter

router = APIRouter()

@router.post("/")
def create_ticket():
    return {"confirmation_id": "DEMO123"}

@router.get("/{confirmation_id}")
def get_ticket(confirmation_id: str):
    return {"confirmation_id": confirmation_id, "status": "paid"}
