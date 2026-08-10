"""Realistic MOCK data for phase 1 — strictly follows the workbook schema.

Each product carries the identity fields (SKU, RIN, MARCA, DESCRIPCION) plus a
`prices` dict keyed by the exact schema keys from schema.PRICE_COLUMNS. When the
real OneDrive worksheet "202607" is connected, this generator is replaced by the
parsed rows WITHOUT changing the schema, roles, UI or business rules.

A few prices are intentionally left as None to exercise the polished
"No disponible" state.
"""

import random

from schema import PRICE_COLUMNS

# Fixed credentials + roles from the specification (initial controlled MVP).
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

# Common tire sizes with their RIN (rim diameter).
_SIZES = [
    ("205/55R16", 16), ("225/45R17", 17), ("235/65R17", 17), ("265/70R16", 16),
    ("265/65R17", 17), ("275/55R20", 20), ("285/75R16", 16), ("245/70R16", 16),
    ("225/65R17", 17), ("255/70R18", 18), ("315/70R17", 17), ("33X12.50R15", 15),
    ("35X12.50R17", 17), ("195/65R15", 15), ("215/60R16", 16), ("245/40R18", 18),
    ("275/60R20", 20), ("285/65R18", 18), ("305/55R20", 20), ("235/75R15", 15),
]


def _price(base: float, factor: float, decimals: bool = True) -> float:
    v = base * factor
    return round(v, 2) if decimals else round(v, 2)


def build_mock_products():
    rng = random.Random(20260701)  # deterministic seed for stable data
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
        # USD base cost per tire
        cost_a = round(rng.uniform(48, 220), 2)
        cost_b = round(cost_a * rng.uniform(1.02, 1.06), 2)
        costos = round(cost_a * rng.uniform(1.0, 1.03), 2)
        cost_zelle = round(cost_a * rng.uniform(1.0, 1.02), 2)

        # Sale prices in USD, and BS variants at an exchange rate.
        bs_rate = 36.5
        venta_ccs = round(cost_a * rng.uniform(1.25, 1.45), 2)
        prices = {
            "COSTO_A": cost_a,
            "COSTO_B": cost_b,
            "COSTOS": costos,
            "COSTO_ZELLE": cost_zelle,
            "VENTA_CARACAS": venta_ccs,
            "VENTA_CARACAS_BS_18": round(venta_ccs * bs_rate, 2),
            "VENTA_CARACAS_CASH_21": round(venta_ccs * 1.02, 2),
            "VENTA_CARACAS_ZELLE_24": round(venta_ccs * 1.05, 2),
            "VENTA_ORIENTE_SUR_Y_BOLIVAR_BS_28": round(venta_ccs * 1.08 * bs_rate, 2),
            "VENTA_ORIENTE_SUR_Y_BOLIVAR_CASH_31": round(venta_ccs * 1.08, 2),
            "VENTA_ORIENTE_SUR_Y_BOLIVAR_ZELLE_34": round(venta_ccs * 1.11, 2),
            "VENTA_ORIENTE_NORTE_MONAGAS_Y_CUMANA_CASH": round(venta_ccs * 1.1, 2),
            "VENTA_ORIENTE_NORTE_MONAGAS_Y_CUMANA_ZELLE_44": round(venta_ccs * 1.13, 2),
            "PANOFRE_BS_48": round(venta_ccs * 1.06 * bs_rate, 2),
            "PANOFRE_CASH_51": round(venta_ccs * 1.06, 2),
            "OTROS_CASH_95": round(venta_ccs * 1.15, 2),
            "OTROS_ZELLE_98": round(venta_ccs * 1.18, 2),
            "TCC_TTC_BS_102": round(venta_ccs * 1.2 * bs_rate, 2),
            "TCC_TTC_CASH_105": round(venta_ccs * 1.2, 2),
        }

        # Intentionally blank a few authorized-looking prices on some rows to
        # exercise the "No disponible" state (never zero, never invented).
        if i % 11 == 0:
            prices["VENTA_CARACAS_ZELLE_24"] = None
        if i % 9 == 0:
            prices["PANOFRE_BS_48"] = None
        if i % 13 == 0:
            prices["TCC_TTC_CASH_105"] = None

        products.append({
            "sku": sku,
            "rin": rin,
            "marca": brand,
            "descripcion": descripcion,
            "prices": prices,
        })

    return products
