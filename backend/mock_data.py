"""Realistic MOCK data for the interim period — strictly follows the confirmed
"Precios Actual" schema (schema.PRICE_COLUMNS). Used only as fallback until the
corporate Microsoft OneDrive connection is enabled; when live, parsed rows
replace this WITHOUT changing schema, roles, UI or business rules.

A few prices are intentionally None to exercise the "No disponible" state.
"""

import random

# Fixed credentials + roles (kept exactly as built).
SEED_USERS = [
    {"username": "Admon", "password": "Master", "role": "master"},
    {"username": "Ventasccs", "password": "ccs2026", "role": "caracas"},
    {"username": "Ventasorientesur", "password": "Orisur2026", "role": "oriente_sur"},
    {"username": "Ventasorientenorte", "password": "Orinorte2026", "role": "oriente_norte"},
    {"username": "Panofre", "password": "Panofre2026", "role": "panofre"},
    {"username": "TiresCenter", "password": "Tirescenter2026", "role": "tires_center"},
]

_BRANDS = [
    "BRIDGESTONE", "MICHELIN", "GOODYEAR", "PIRELLI", "FIRESTONE",
    "CONTINENTAL", "YOKOHAMA", "HANKOOK", "TOYO", "COOPER",
    "BFGOODRICH", "MAXXIS", "FALKEN", "KUMHO", "NEXEN",
]

_PATTERNS = [
    "DUELER A/T", "WRANGLER ALL TERRAIN", "SCORPION ATR", "GEOLANDAR G015",
    "DESTINATION LE3", "TERRAMAX H/T", "OPEN COUNTRY A/T III", "DISCOVERER AT3",
    "PRIMACY 4", "TURANZA T005", "EAGLE F1 ASYMMETRIC", "P ZERO",
    "POTENZA RE050", "ADVAN SPORT", "VENTUS S1 EVO3", "AT3 4X4",
    "MUD TERRAIN KM3", "BAJA BOSS", "RUGGED TERRAIN",
]

_SIZES = [
    ("205/55R16", 16), ("225/45R17", 17), ("235/65R17", 17), ("265/70R16", 16),
    ("265/65R17", 17), ("275/55R20", 20), ("285/75R16", 16), ("245/70R16", 16),
    ("225/65R17", 17), ("255/70R18", 18), ("315/70R17", 17), ("33X12.50R15", 15),
    ("35X12.50R17", 17), ("195/65R15", 15), ("215/60R16", 16), ("245/40R18", 18),
    ("275/60R20", 20), ("285/65R18", 18), ("305/55R20", 20), ("235/75R15", 15),
]

_BS_RATE = 36.5


def build_mock_products():
    rng = random.Random(20260701)
    products = []
    used = set()

    for i in range(46):
        brand = rng.choice(_BRANDS)
        pattern = rng.choice(_PATTERNS)
        size, rin = rng.choice(_SIZES)
        sku = f"VNG-{rin}{str(1000 + i)}"
        if sku in used:
            continue
        used.add(sku)

        descripcion = f"{pattern} {size}"
        cost = round(rng.uniform(48, 220), 2)
        base = round(cost * rng.uniform(1.25, 1.45), 2)  # USD sale baseline

        def usd(mult):
            return round(base * mult, 2)

        def bs(mult):
            return round(base * mult * _BS_RATE, 2)

        prices = {
            "COSTO": cost,
            "COSTO_BS": round(cost * _BS_RATE, 2),
            "COSTO_DOLAR": cost,
            "COSTO_ZELLE": round(cost * 1.02, 2),
            "CARACAS_BS": bs(1.0),
            "CARACAS_CASH": usd(1.0),
            "CARACAS_ZELLE": usd(1.04),
            "ORIENTE_SUR_BS": bs(1.06),
            "ORIENTE_SUR_CASH": usd(1.06),
            "ORIENTE_SUR_ZELLE": usd(1.1),
            "ORIENTE_NORTE_BS": bs(1.08),
            "ORIENTE_NORTE_CASH": usd(1.08),
            "ORIENTE_NORTE_ZELLE": usd(1.12),
            "PANOFRE_BS": bs(1.05),
            "PANOFRE_CASH": usd(1.05),
            "OTROS_CASH": usd(1.15),
            "OTROS_ZELLE": usd(1.18),
            "TCC_TTC_BS": bs(1.2),
            "TCC_TTC_CASH": usd(1.2),
            "TCC_TTC_ZELLE": usd(1.24),
        }

        # A few intentional blanks -> "No disponible" (never zero, never invented).
        if i % 11 == 0:
            prices["CARACAS_ZELLE"] = None
        if i % 9 == 0:
            prices["PANOFRE_BS"] = None
        if i % 13 == 0:
            prices["TCC_TTC_ZELLE"] = None

        products.append({
            "sku": sku,
            "rin": rin,
            "marca": brand,
            "descripcion": descripcion,
            "prices": prices,
        })

    return products
