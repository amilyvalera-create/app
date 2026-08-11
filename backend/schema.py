"""Approved workbook schema for worksheet "Precios Actual".

SINGLE SOURCE OF TRUTH for the column map, the role -> allowed columns
authorization matrix, and display labels. Mapping is strictly by workbook COLUMN
LETTER (confirmed production mapping) so unrelated workbook values never cross
into app fields.

Confirmed production mapping (worksheet "Precios Actual"):
  A=SKU  B=RIN  C=MARCA  D=DESCRIPCION
  E=COSTO  F=COSTO BS  G=COSTO $  H=COSTO ZELLE
  I,J,K   -> Ventasccs   (Caracas)
  L,M,N   -> Ventasorientesur (Oriente Sur)
  O,P,Q   -> Ventasorientenorte (Oriente Norte)
  R,S     -> Panofre
  AC,AD   -> OTROS (Cash, Zelle)  --> NEVER for TiresCenter
  AE,AF,AG-> TiresCenter (TCC/TTC Bs, Cash, Zelle_108)
"""

# letter -> internal key. Order defines display order for master.
PRICE_COLUMNS = [
    {"letter": "E", "key": "COSTO"},
    {"letter": "F", "key": "COSTO_BS"},
    {"letter": "G", "key": "COSTO_DOLAR"},
    {"letter": "H", "key": "COSTO_ZELLE"},
    {"letter": "I", "key": "CARACAS_BS"},
    {"letter": "J", "key": "CARACAS_CASH"},
    {"letter": "K", "key": "CARACAS_ZELLE"},
    {"letter": "L", "key": "ORIENTE_SUR_BS"},
    {"letter": "M", "key": "ORIENTE_SUR_CASH"},
    {"letter": "N", "key": "ORIENTE_SUR_ZELLE"},
    {"letter": "O", "key": "ORIENTE_NORTE_BS"},
    {"letter": "P", "key": "ORIENTE_NORTE_CASH"},
    {"letter": "Q", "key": "ORIENTE_NORTE_ZELLE"},
    {"letter": "R", "key": "PANOFRE_BS"},
    {"letter": "S", "key": "PANOFRE_CASH"},
    {"letter": "AC", "key": "OTROS_CASH"},
    {"letter": "AD", "key": "OTROS_ZELLE"},
    {"letter": "AE", "key": "TCC_TTC_BS"},
    {"letter": "AF", "key": "TCC_TTC_CASH"},
    {"letter": "AG", "key": "TCC_TTC_ZELLE"},
]

# Product identity columns (letter -> field).
IDENTITY_COLUMNS = {"A": "sku", "B": "rin", "C": "marca", "D": "descripcion"}

# Role -> authorized price column keys (server-enforced). Master gets everything.
ROLE_COLUMN_MAP = {
    "caracas": ["CARACAS_BS", "CARACAS_CASH", "CARACAS_ZELLE"],
    "oriente_sur": ["ORIENTE_SUR_BS", "ORIENTE_SUR_CASH", "ORIENTE_SUR_ZELLE"],
    "oriente_norte": ["ORIENTE_NORTE_BS", "ORIENTE_NORTE_CASH", "ORIENTE_NORTE_ZELLE"],
    "panofre": ["PANOFRE_BS", "PANOFRE_CASH"],
    # TiresCenter uses TCC/TTC columns ONLY. Never OTROS (AC/AD).
    "tires_center": ["TCC_TTC_BS", "TCC_TTC_CASH", "TCC_TTC_ZELLE"],
}

ROLE_LABELS = {
    "master": "Administrador",
    "caracas": "Ventas Caracas",
    "oriente_sur": "Ventas Oriente Sur",
    "oriente_norte": "Ventas Oriente Norte",
    "panofre": "Panofre",
    "tires_center": "Tires Center",
}

_COLUMN_LABELS = {
    "COSTO": "Costo",
    "COSTO_BS": "Costo Bs",
    "COSTO_DOLAR": "Costo $",
    "COSTO_ZELLE": "Costo Zelle",
    "CARACAS_BS": "Caracas Bs",
    "CARACAS_CASH": "Caracas Cash",
    "CARACAS_ZELLE": "Caracas Zelle",
    "ORIENTE_SUR_BS": "Oriente Sur Bs",
    "ORIENTE_SUR_CASH": "Oriente Sur Cash",
    "ORIENTE_SUR_ZELLE": "Oriente Sur Zelle",
    "ORIENTE_NORTE_BS": "Oriente Norte Bs",
    "ORIENTE_NORTE_CASH": "Oriente Norte Cash",
    "ORIENTE_NORTE_ZELLE": "Oriente Norte Zelle",
    "PANOFRE_BS": "Panofre Bs",
    "PANOFRE_CASH": "Panofre Cash",
    "OTROS_CASH": "Otros Cash",
    "OTROS_ZELLE": "Otros Zelle",
    "TCC_TTC_BS": "TCC/TTC Bs",
    "TCC_TTC_CASH": "TCC/TTC Cash",
    "TCC_TTC_ZELLE": "TCC/TTC Zelle",
}


def column_label(key: str) -> str:
    return _COLUMN_LABELS.get(key, key)


def column_currency(key: str) -> str:
    """Currency derived from the column naming convention: *_BS -> Bolivares, else USD."""
    if key.endswith("_BS"):
        return "Bs"
    return "$"


def col_letter_to_index(letter: str) -> int:
    """Excel column letter (e.g. 'A', 'AG') -> 0-based index."""
    letter = letter.strip().upper()
    idx = 0
    for ch in letter:
        idx = idx * 26 + (ord(ch) - ord("A") + 1)
    return idx - 1
