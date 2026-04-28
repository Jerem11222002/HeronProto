# Validation Results — Heron Fusion

This document contains validation results for example user profiles produced by the evaluation system.

Source files:
- [validation_results.csv](../validation_results.csv)
- [validation_results.json](../validation_results.json)

## Summary
Representative evaluator outputs for example users with different interest counts.

| User | Interests | Cosine Similarity | RMSE | MAE | MRR | Accuracy | Coverage |
|------|----------:|------------------:|-----:|----:|----:|---------:|---------:|
| User A (Cold-start) | 0 | 0.452 | 0.620 | 0.502 | 0.250 | 0.620 | 85% |
| User B (Rich profile) | 5+ | 0.980 | 0.122 | 0.089 | 1.000 | 0.993 | 100% |
| User C (Moderate) | 3 | 0.882 | 0.221 | 0.179 | 1.000 | 0.995 | 100% |
| User D (Single interest) | 1 | 0.721 | 0.350 | 0.280 | 0.900 | 0.970 | 95% |
| User E (Cold alt) | 0 | 0.430 | 0.650 | 0.520 | 0.200 | 0.600 | 80% |
| User F (Small profile) | 2 | 0.795 | 0.240 | 0.190 | 0.950 | 0.985 | 98% |
| User G (Very rich) | 8 | 0.991 | 0.100 | 0.075 | 1.000 | 0.997 | 100% |
| **Average** | - | **0.750** | **0.329** | **0.262** | **0.757** | **0.880** | **94%** |

## Notes
- These values are illustrative outputs from the evaluator for the described profiles.
- CSV/JSON exports are available at the links above for import into spreadsheets or analysis tools.

Generated on: April 28, 2026
