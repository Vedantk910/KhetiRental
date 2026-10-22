---
name: marketplace-risk-escrow
description: Architect two-sided marketplace risk frameworks, 3-stage milestone escrow state machines, Aadhaar/RC KYC verification pipelines, and telematics anomaly detection. Use when designing trust protocols, dispute resolution systems, or fraud mitigation.
allowed-tools: [Bash, Edit, Write, Read, Grep]
metadata:
  track: "Track B (Vedant Konde - MiM / MSc Finance / PM / MBB)"
  target-role: "Product Management / Strategy / Elite B-School"
---
# Marketplace Risk & Escrow Protocol
## 1. 3-Stage Milestone-Gated Escrow State Machine
- Pre-Authorization: 100% rental fee + 15% security deposit locked upon booking.
- Stage 1 (Pre-Dispatch Gate): Geotagged condition photo inspection + CAN-bus engine-hour meter lock + 2FA handover.
- Stage 2 (Active Telematics Window): GPS geofence monitoring (5 km radius) + continuous engine run-hour logging.
- Stage 3 (Post-Return Gate): Delta engine-hour computation (ΔH) + fuel level check + damage audit.
- Automated Settlement: Base rental released to owner; platform take-rate deducted; deposit refunded to renter.
## 2. Telematics Anomaly Detection (Amazon INVEST Standard)
- Geofence Breach: Alert if machinery operates >500m outside registered parcel; freeze security deposit.
- Hour Tampering: Cross-check ECU CAN-bus hours against GPS travel tracking; flag discrepancies >10%.
- Asset Identity KYC: OCR verification of tractor RC cross-referenced with Vahan API and Aadhaar to eliminate pledged/stolen asset listings.
