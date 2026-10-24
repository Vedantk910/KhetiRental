# Glossary

Terms used in the website, its code and the showcase.

| Term | Meaning |
|---|---|
| **Renter** | A farmer who books a machine. |
| **Owner** | A person or Custom Hiring Centre that lists a machine. One account can be both. |
| **CHC** | Custom Hiring Centre: a scheme-funded machinery rental unit. |
| **Machine** | Anything rentable: tractor, rotavator, combine harvester, sprayer, seed drill, baler, trolley, thresher. |
| **Attachment** | An implement that comes with a machine, e.g. a tractor + rotavator. |
| **Job** | The work a renter needs: plough, rotavate, sow, spray, harvest, transport. Each job maps to machine categories. |
| **Price unit** | How an owner charges: per hour, per acre or per day. Prices are stored in integer paise and shown in whole rupees. |
| **Slot** | Morning (7 am–1 pm), Afternoon (1–7 pm) or Full day (7 am–7 pm). |
| **Booking code** | The human code for a booking, `KR-` plus 4 digits. |
| **Deposit** | Money held for damage cover and returned after the job: 15 % of rent, or a horsepower-tier floor, capped at 25 % of rent for jobs under 8 hours. |
| **Demo payment** | The simulated payment step. No real money moves (stored as `paid_demo` or `pay_later`). |
| **RC** | Registration Certificate of a vehicle. Owners upload a photo; an admin marks it "RC checked". |
| **HP tier** | Horsepower class: 35, 45, 55 or 75 HP 4WD. |
| **PIN code** | Indian postal code, used to place a farm when GPS isn't available. |
| **Sample** | Seeded demo data, labelled "Sample" in the UI. |
| **Take-rate** | The platform's share of the rent (12–15 %); only in the showcase model. |
| **Showcase** | `showcase/`: the engineering portfolio (Go services, contracts, analytics, PRD, ADRs, audit). Not on the website's request path. |
