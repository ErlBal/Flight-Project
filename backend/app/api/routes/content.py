from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import asc
import time
import re

from app.api.deps import require_roles
from app.db.session import get_db
from app.models.banner import Banner
from app.models.offer import Offer

router = APIRouter()

# Simple in-process TTL cache (invalidate on write). Not multi-process safe.
_CACHE_TTL = 60  # seconds
_cache_store = {
    'banners': {'ts': 0, 'data': []},
    'offers': {'ts': 0, 'data': []},
}

def _cache_get(key: str):
    now = time.time()
    entry = _cache_store.get(key)
    if not entry:
        return None
    if now - entry['ts'] > _CACHE_TTL:
        return None
    return entry['data']

def _cache_set(key: str, data):
    _cache_store[key] = {'ts': time.time(), 'data': data}

def _cache_invalidate(*keys: str):
    for k in keys:
        if k in _cache_store:
            _cache_store[k]['ts'] = 0

# Validation helpers
VALID_TAGS = {None, 'sale', 'new', 'last_minute', 'info'}
VALID_MODES = {'interactive', 'info'}
FLIGHT_REF_RE = re.compile(r'^(?:[A-Z]{3}|[A-Z]{3}-[A-Z]{3}(?:@\d{4}-\d{2}-\d{2})?)$')

def _validate_offer_payload(payload: dict, creating: bool = True):
    title = (payload.get('title') or '').strip()
    if creating and not title:
        raise HTTPException(status_code=400, detail='title required')
    tag = payload.get('tag')
    if tag not in VALID_TAGS:
        raise HTTPException(status_code=400, detail='invalid tag')
    mode = payload.get('mode') or 'interactive'
    if mode not in VALID_MODES:
        raise HTTPException(status_code=400, detail='invalid mode')
    flight_ref = payload.get('flight_ref')
    if flight_ref:
        if not FLIGHT_REF_RE.match(flight_ref):
            raise HTTPException(status_code=400, detail='invalid flight_ref format')
    desc = payload.get('description')
    if desc and len(desc) > 1000:
        raise HTTPException(status_code=400, detail='description too long (max 1000)')
    return title, tag, mode, flight_ref, desc

""" Content (banners & offers) endpoints.

Offers повторяют логику banners: публичный список активных + admin CRUD.
"""

# Public endpoint (banners)
@router.get('/banners', response_model=List[dict])
def public_banners(db: Session = Depends(get_db)):
    cached = _cache_get('banners')
    if cached is not None:
        return cached
    items = db.query(Banner).filter(Banner.is_active == True).order_by(asc(Banner.position), asc(Banner.id)).all()
    data = [
        {
            'id': b.id,
            'title': b.title,
            'image_url': b.image_url,
            'link_url': b.link_url,
            'position': b.position,
        } for b in items
    ]
    _cache_set('banners', data)
    return data

@router.get('/offers', response_model=List[dict])
def public_offers(db: Session = Depends(get_db)):
    cached = _cache_get('offers')
    if cached is not None:
        return cached
    items = db.query(Offer).filter(Offer.is_active == True).order_by(asc(Offer.position), asc(Offer.id)).all()
    data = [
        {
            'id': o.id,
            'title': o.title,
            'subtitle': o.subtitle,
            'price_from': float(o.price_from) if o.price_from is not None else None,
            'flight_ref': o.flight_ref,
            'position': o.position,
            'tag': o.tag,
            'mode': o.mode,
            'description': o.description if o.mode == 'info' else None,
            'click_count': o.click_count,
        } for o in items
    ]
    _cache_set('offers', data)
    return data

# Click endpoint (increments click_count)
@router.post('/offers/{offer_id}/click', response_model=dict)
def click_offer(offer_id: int, db: Session = Depends(get_db)):
    o = db.query(Offer).filter(Offer.id == offer_id, Offer.is_active == True).first()
    if not o:
        raise HTTPException(status_code=404, detail='not found')
    o.click_count = (o.click_count or 0) + 1
    db.commit()
    _cache_invalidate('offers')
    return {'status': 'ok', 'click_count': o.click_count}

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
    _cache_invalidate('banners')
    return {'id': b.id}

@router.get('/admin/banners', dependencies=[Depends(require_roles('admin'))], response_model=List[dict])
def list_banners(db: Session = Depends(get_db)):
    items = db.query(Banner).order_by(asc(Banner.position), asc(Banner.id)).all()
    return [
        {
            'id': b.id,
            'title': b.title,
            'image_url': b.image_url,
            'link_url': b.link_url,
            'position': b.position,
            'is_active': b.is_active,
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
    _cache_invalidate('banners')
    return {'status': 'ok'}

@router.delete('/admin/banners/{banner_id}', dependencies=[Depends(require_roles('admin'))], response_model=dict)
def delete_banner(banner_id: int, db: Session = Depends(get_db)):
    b = db.query(Banner).filter(Banner.id == banner_id).first()
    if not b:
        raise HTTPException(status_code=404, detail='not found')
    db.delete(b)
    db.commit()
    _cache_invalidate('banners')
    return {'status': 'deleted'}

# Admin CRUD for Offers
@router.post('/admin/offers', dependencies=[Depends(require_roles('admin'))], response_model=dict)
def create_offer(payload: dict, db: Session = Depends(get_db)):
    title, tag, mode, flight_ref, desc = _validate_offer_payload(payload, creating=True)
    o = Offer(
        title=title,
        subtitle=payload.get('subtitle'),
        price_from=payload.get('price_from'),
        flight_ref=flight_ref,
        position=payload.get('position', 0),
        is_active=bool(payload.get('is_active', True)),
        tag=tag,
        mode=mode,
        description=desc if mode == 'info' else None,
    )
    db.add(o)
    db.commit()
    db.refresh(o)
    _cache_invalidate('offers')
    return {'id': o.id}

@router.get('/admin/offers', dependencies=[Depends(require_roles('admin'))], response_model=List[dict])
def list_offers(db: Session = Depends(get_db)):
    items = db.query(Offer).order_by(asc(Offer.position), asc(Offer.id)).all()
    return [
        {
            'id': o.id,
            'title': o.title,
            'subtitle': o.subtitle,
            'price_from': float(o.price_from) if o.price_from is not None else None,
            'flight_ref': o.flight_ref,
            'position': o.position,
            'is_active': o.is_active,
            'tag': o.tag,
            'mode': o.mode,
            'description': o.description,
            'click_count': o.click_count,
        } for o in items
    ]

@router.put('/admin/offers/{offer_id}', dependencies=[Depends(require_roles('admin'))], response_model=dict)
def update_offer(offer_id: int, payload: dict, db: Session = Depends(get_db)):
    o = db.query(Offer).filter(Offer.id == offer_id).first()
    if not o:
        raise HTTPException(status_code=404, detail='not found')
    if any(k in payload for k in ['title', 'tag', 'mode', 'flight_ref', 'description']):
        # merge existing state for validation
        merged = {
            'title': payload.get('title', o.title),
            'tag': payload.get('tag', o.tag),
            'mode': payload.get('mode', o.mode),
            'flight_ref': payload.get('flight_ref', o.flight_ref),
            'description': payload.get('description', o.description),
        }
        title, tag, mode, flight_ref, desc = _validate_offer_payload(merged, creating=False)
        o.title = title
        o.tag = tag
        o.mode = mode
        o.flight_ref = flight_ref
        o.description = desc if mode == 'info' else None
    for key in ['subtitle', 'price_from', 'position', 'is_active']:
        if key in payload:
            setattr(o, key, payload[key])
    db.commit()
    _cache_invalidate('offers')
    return {'status': 'ok'}

@router.delete('/admin/offers/{offer_id}', dependencies=[Depends(require_roles('admin'))], response_model=dict)
def delete_offer(offer_id: int, db: Session = Depends(get_db)):
    o = db.query(Offer).filter(Offer.id == offer_id).first()
    if not o:
        raise HTTPException(status_code=404, detail='not found')
    db.delete(o)
    db.commit()
    _cache_invalidate('offers')
    return {'status': 'deleted'}
