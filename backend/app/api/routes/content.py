from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import asc

from app.api.deps import require_roles
from app.db.session import get_db
from app.models.banner import Banner

router = APIRouter()

# Public endpoint
@router.get('/banners', response_model=List[dict])
def public_banners(db: Session = Depends(get_db)):
    items = db.query(Banner).filter(Banner.is_active == True).order_by(asc(Banner.position), asc(Banner.id)).all()
    return [
        {
            "id": b.id,
            "title": b.title,
            "image_url": b.image_url,
            "link_url": b.link_url,
            "position": b.position,
        } for b in items
    ]

# Admin CRUD
@router.post('/admin/banners', dependencies=[Depends(require_roles('admin'))], response_model=dict)
def create_banner(payload: dict, db: Session = Depends(get_db)):
    title = (payload.get('title') or '').strip()
    if not title:
        raise HTTPException(status_code=400, detail='title required')
    b = Banner(
        title=title,
        image_url=payload.get('image_url'),
        link_url=payload.get('link_url'),
        position=payload.get('position', 0),
        is_active=bool(payload.get('is_active', True)),
    )
    db.add(b)
    db.commit()
    db.refresh(b)
    return {"id": b.id}

@router.get('/admin/banners', dependencies=[Depends(require_roles('admin'))], response_model=List[dict])
def list_banners(db: Session = Depends(get_db)):
    items = db.query(Banner).order_by(asc(Banner.position), asc(Banner.id)).all()
    return [
        {
            "id": b.id,
            "title": b.title,
            "image_url": b.image_url,
            "link_url": b.link_url,
            "position": b.position,
            "is_active": b.is_active,
        } for b in items
    ]

@router.put('/admin/banners/{banner_id}', dependencies=[Depends(require_roles('admin'))], response_model=dict)
def update_banner(banner_id: int, payload: dict, db: Session = Depends(get_db)):
    b = db.query(Banner).filter(Banner.id == banner_id).first()
    if not b:
        raise HTTPException(status_code=404, detail='not found')
    for key in ['title', 'image_url', 'link_url', 'position', 'is_active']:
        if key in payload:
            setattr(b, key, payload[key])
    db.commit()
    return {"status": "ok"}

@router.delete('/admin/banners/{banner_id}', dependencies=[Depends(require_roles('admin'))], response_model=dict)
def delete_banner(banner_id: int, db: Session = Depends(get_db)):
    b = db.query(Banner).filter(Banner.id == banner_id).first()
    if not b:
        raise HTTPException(status_code=404, detail='not found')
    db.delete(b)
    db.commit()
    return {"status": "deleted"}
