# Australian settlements in the 2021 Census

`places.json` contains 17,143 geographic records. Each row in `places` is an array of six values in this order.

| Field | Meaning |
| --- | --- |
| ID | U followed by the six-digit ABS Urban Centre and Locality code, or S followed by the five-digit ABS Suburb and Locality code |
| Name | ABS area name including disambiguating suffixes |
| State | State or territory abbreviation, with OT for Other Territories |
| Longitude | Degrees east, WGS84 |
| Latitude | Degrees north, WGS84 |
| Population | Published 2021 Census count of usual residents, all persons, General Community Profile G01, column `Tot_P_P` |

## Coverage

| Jurisdiction | Urban Centres and Localities | Suburbs and Localities |
| --- | ---: | ---: |
| New South Wales | 535 | 4,542 |
| Victoria | 344 | 2,944 |
| Queensland | 411 | 3,233 |
| South Australia | 171 | 1,696 |
| Western Australia | 176 | 1,699 |
| Tasmania | 94 | 776 |
| Northern Territory | 70 | 303 |
| Australian Capital Territory | 3 | 136 |
| Other Territories | 5 | 5 |
| **Total** | **1,809** | **15,334** |

UCLs identify concentrations of settlement. The file includes cross-border UCLs as separate state parts, following the ABS release. It excludes the nine statewide rural remainders and records without geographic boundaries. SALs approximate named suburbs and localities, with complete coverage of the spatial ABS release, including published remainder areas such as ACT district remainders. A UCL and a SAL of the same name describe different footprints. Adding their populations would double-count residents. [ABS urban geography](https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs/edition-3-july-2021-june-2026/significant-urban-areas-urban-centres-and-localities-section-state/urban-centres-and-localities) · [ABS suburb geography](https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs/edition-3-july-2021-june-2026/non-abs-structures/suburbs-and-localities)

All 17,143 records matched a published population. The 686 SALs with a published zero retain that value. The ABS applies small random adjustments for confidentiality. Industry, population growth and present-day population estimates are outside the scope of this file.

## Preparation

Run `python scripts/australia/places.py` with NumPy, pyshp 2.x, Shapely 2.x and pyproj installed. The script reads the national G01 tables from the 2021 SAL and UCL General Community Profile DataPacks. It joins each table to the corresponding full-resolution ASGS Edition 3 GDA94 shapefile by ABS code. [Census DataPacks](https://www.abs.gov.au/census/find-census-data/datapacks) · [Digital boundary files](https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs/edition-3-july-2021-june-2026/access-and-downloads/digital-boundary-files)

For each area the script projects its boundary into Australian Albers (EPSG:3577), takes the largest polygon by area and calculates its centroid. If the centroid lies outside the polygon, it uses an interior representative point. It transforms the point to WGS84 and verifies that the rounded coordinates still fall within the source polygon. These points locate statistical areas. The urban centre of a large city or settlement centre of an extensive rural locality can be some distance from its polygon centroid.

## Attribution

Based on Australian Bureau of Statistics data. ABS data used with permission from the Australian Bureau of Statistics. Source files accessed 28 November 2026. ABS SAL boundaries approximate May 2021 Geoscape localities. This project derived the representative coordinates. [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/)
