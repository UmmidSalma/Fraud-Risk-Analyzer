# ml/train_unsupervised.py

import pandas as pd
import numpy as np
import joblib
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline

from behavior_engineer import BehaviorFeatureEngineer

# -----------------------------
# 1. Load data
# -----------------------------
df = pd.read_csv("fraud_dataset.csv")

# Faster training: use a sample if dataset is huge
if len(df) > 200_000:
    df = df.sample(n=200_000, random_state=42)

# -----------------------------
# 2. Feature engineering
# -----------------------------
engineer = BehaviorFeatureEngineer().fit(df)
df_fe = engineer.transform(df)

# Save engineer for app.py
joblib.dump(engineer, "behavior_engineer.pkl")

# -----------------------------
# 3. Feature lists
# -----------------------------
categorical_cols = ["type"]

numeric_cols = [
    "step",
    "amount",
    "oldbalanceOrg",
    "newbalanceOrig",
    "oldbalanceDest",
    "newbalanceDest",
    "hour_of_day",
    "is_night_tx",
    "sender_avg_amount",
    "sender_tx_count_before",
    "receiver_tx_count_before",
    "receiver_account_age_steps",
    "amount_dev_from_avg",
    "time_deviation",
    "freq_anomaly",
    "is_new_beneficiary",
    "device_mismatch_flag",
    "location_mismatch_flag",
    "transaction_velocity_proxy",
    "balance_drain_ratio",
    "behavioral_deviation_score",
    "failed_attempts_count",
]

feature_cols = categorical_cols + numeric_cols

# -----------------------------
# 4. Clean numeric issues
# -----------------------------
df_fe = df_fe.replace([np.inf, -np.inf], np.nan)

# Ensure all required columns exist
for col in categorical_cols:
    if col not in df_fe.columns:
        df_fe[col] = "UNKNOWN"

for col in numeric_cols:
    if col not in df_fe.columns:
        df_fe[col] = 0
    elif df_fe[col].isna().all():
        df_fe[col] = 0

# Fill missing numeric values with 0
for col in numeric_cols:
    df_fe[col] = pd.to_numeric(df_fe[col], errors="coerce").fillna(0)

# -----------------------------
# 5. Select features
# -----------------------------
X = df_fe[feature_cols].copy()

# -----------------------------
# 6. Preprocessing
# -----------------------------
numeric_transformer = Pipeline(steps=[
    ("imputer", SimpleImputer(strategy="median")),
    ("scaler", StandardScaler())
])

categorical_transformer = Pipeline(steps=[
    ("imputer", SimpleImputer(strategy="most_frequent")),
    ("onehot", OneHotEncoder(handle_unknown="ignore"))
])

preprocessor = ColumnTransformer(
    transformers=[
        ("num", numeric_transformer, numeric_cols),
        ("cat", categorical_transformer, categorical_cols),
    ]
)

X_processed = preprocessor.fit_transform(X)

# -----------------------------
# 7. Unsupervised model
# -----------------------------
model = IsolationForest(
    n_estimators=150,
    contamination=0.02,
    random_state=42,
    n_jobs=-1
)

model.fit(X_processed)

# -----------------------------
# 8. Save
# -----------------------------
joblib.dump(preprocessor, "unsup_preprocessor.pkl")
joblib.dump(model, "unsupervised_model.pkl")

print("Unsupervised model saved successfully.")
print("Saved files:")
print("- unsup_preprocessor.pkl")
print("- unsupervised_model.pkl")