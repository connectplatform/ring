# Retired Ring Platform entity industry types

**Retired:** 2026-06-15  
**Reason:** These 26 manufacturing / deep-tech niche slugs were a mistaken clone of an old techno-industry seed set. They are **not** the Ring.ck.ua community taxonomy (that clone uses `localGovernment`, `startup`, etc.).  
**Replacement:** 26 professional networking categories per `AI-CONTEXT/concepts/entities/entity-management-system.json` (`technologySoftware`, `financialServices`, …).  
**Runtime:** `lib/entities/legacy-entity-type-map.ts` maps legacy `data->>'type'` values for display until data migration.

---

## Archived type registry (26)

| id | label | description | lucide icon |
|---|---|---|---|
| `3dPrinting` | 3D Printing | Additive manufacturing and 3D printing services | `Layers` |
| `aiMachineLearning` | AI & Machine Learning | Artificial intelligence and machine learning solutions | `Bot` |
| `biotechnology` | Biotechnology | Biological technology and life sciences | `Dna` |
| `blockchainDevelopment` | Blockchain Development | Blockchain and distributed ledger technologies | `Blocks` |
| `cleanEnergy` | Clean Energy | Renewable energy and sustainable technologies | `Leaf` |
| `cloudComputing` | Cloud Computing | Cloud infrastructure and computing services | `Cloud` |
| `cncMachining` | CNC Machining | Computer numerical control machining services | `Cog` |
| `compositeManufacturing` | Composite Manufacturing | Advanced composite materials and manufacturing | `Layers` |
| `cybersecurity` | Cybersecurity | Information security and cyber protection services | `Shield` |
| `droneTechnology` | Drone Technology | Unmanned aerial vehicles and drone services | `Plane` |
| `electronicManufacturing` | Electronic Manufacturing | Electronic components and device manufacturing | `Zap` |
| `industrialDesign` | Industrial Design | Product design and industrial design services | `Palette` |
| `iotDevelopment` | IoT Development | Internet of Things and connected device solutions | `Wifi` |
| `laserCutting` | Laser Cutting | Precision laser cutting and engraving services | `Scissors` |
| `manufacturing` | Manufacturing | General manufacturing and production services | `Factory` |
| `metalFabrication` | Metal Fabrication | Metal working and fabrication services | `Wrench` |
| `other` | Other | Other specialized services and technologies | `Package` |
| `plasticInjectionMolding` | Plastic Injection Molding | Plastic injection molding and polymer processing | `Package` |
| `precisionEngineering` | Precision Engineering | High-precision engineering and manufacturing | `Gauge` |
| `quantumComputing` | Quantum Computing | Quantum computing and quantum technologies | `Atom` |
| `robotics` | Robotics | Robotics and automation solutions | `Bot` |
| `semiconductorProduction` | Semiconductor Production | Semiconductor manufacturing and chip production | `Microchip` |
| `smartMaterials` | Smart Materials | Advanced and smart materials development | `Sparkles` |
| `softwareDevelopment` | Software Development | Software development and programming services | `Code` |
| `technologyCenter` | Technology Center | Technology incubators and innovation centers | `Building2` |
| `virtualReality` | Virtual Reality | Virtual and augmented reality technologies | `Cpu` |

### Color tokens (Tailwind)

| id | color | bgColor | textColor |
|---|---|---|---|
| 3dPrinting | purple | bg-purple-500 | text-purple-600 |
| aiMachineLearning | blue | bg-blue-500 | text-blue-600 |
| biotechnology | green | bg-green-500 | text-green-600 |
| blockchainDevelopment | orange | bg-orange-500 | text-orange-600 |
| cleanEnergy | emerald | bg-emerald-500 | text-emerald-600 |
| cloudComputing | sky | bg-sky-500 | text-sky-600 |
| cncMachining | gray | bg-gray-500 | text-gray-600 |
| compositeManufacturing | indigo | bg-indigo-500 | text-indigo-600 |
| cybersecurity | red | bg-red-500 | text-red-600 |
| droneTechnology | teal | bg-teal-500 | text-teal-600 |
| electronicManufacturing | yellow | bg-yellow-500 | text-yellow-600 |
| industrialDesign | pink | bg-pink-500 | text-pink-600 |
| iotDevelopment | cyan | bg-cyan-500 | text-cyan-600 |
| laserCutting | rose | bg-rose-500 | text-rose-600 |
| manufacturing | amber | bg-amber-500 | text-amber-600 |
| metalFabrication | slate | bg-slate-500 | text-slate-600 |
| other | neutral | bg-neutral-500 | text-neutral-600 |
| plasticInjectionMolding | lime | bg-lime-500 | text-lime-600 |
| precisionEngineering | violet | bg-violet-500 | text-violet-600 |
| quantumComputing | fuchsia | bg-fuchsia-500 | text-fuchsia-600 |
| robotics | blue | bg-blue-600 | text-blue-700 |
| semiconductorProduction | green | bg-green-600 | text-green-700 |
| smartMaterials | purple | bg-purple-600 | text-purple-700 |
| softwareDevelopment | blue | bg-blue-700 | text-blue-800 |
| technologyCenter | indigo | bg-indigo-600 | text-indigo-700 |
| virtualReality | pink | bg-pink-600 | text-pink-700 |

---

## Suggested migration → new professional categories

| legacy id | → new id |
|---|---|
| softwareDevelopment, aiMachineLearning, blockchainDevelopment, cloudComputing, cybersecurity, iotDevelopment, quantumComputing | `technologySoftware` |
| manufacturing, cncMachining, compositeManufacturing, electronicManufacturing, laserCutting, metalFabrication, plasticInjectionMolding, precisionEngineering, robotics, semiconductorProduction, smartMaterials, 3dPrinting | `manufacturingIndustry` |
| biotechnology | `healthcareMedical` |
| cleanEnergy | `energyUtilities` |
| droneTechnology | `aerospaceDefense` |
| industrialDesign | `professionalServices` |
| technologyCenter | `researchDevelopment` |
| virtualReality | `mediaEntertainment` |
| other | `other` |

---

## Locale keys retired (`modules.entities.types.*`)

All keys matching the legacy ids above (label + `*Desc` suffix) in `locales/{en,uk,ru}/modules/entities.json` were removed 2026-06-15.

## Files that referenced legacy ids (updated same day)

- `features/entities/types/index.ts`
- `components/entities/entity-type-icons.tsx`
- `components/entities/entities-filters-panel.tsx`
- `components/entities/advanced-filters.tsx`
- `components/wrappers/entity-form-wrapper.tsx`
- `scripts/add-mock-entities.js`
- `lib/entities/legacy-entity-type-map.ts` (runtime display fallback)
