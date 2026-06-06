# ml/train.py

import pandas as pd
import numpy as np
import joblib
from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.impute import SimpleImputer
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score

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
target = "isFraud"

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

# If any engineered column is completely empty, set it to 0
for col in numeric_cols:
    if col not in df_fe.columns:
        df_fe[col] = 0
    elif df_fe[col].isna().all():
        df_fe[col] = 0

# Fill remaining missing numeric values with 0
for col in numeric_cols:
    df_fe[col] = pd.to_numeric(df_fe[col], errors="coerce").fillna(0)

# Make sure categorical feature exists
if "type" not in df_fe.columns:
    df_fe["type"] = "UNKNOWN"

# -----------------------------
# 5. Balance the dataset
# -----------------------------
fraud_df = df_fe[df_fe[target] == 1]
legit_df = df_fe[df_fe[target] == 0]

sample_size = min(len(fraud_df) * 3, len(legit_df))
legit_sample = legit_df.sample(n=sample_size, random_state=42)

train_df = pd.concat([fraud_df, legit_sample]).sample(frac=1, random_state=42)

X = train_df[feature_cols].copy()
y = train_df[target].copy()

# -----------------------------
# 6. Split
# -----------------------------
X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42,
    stratify=y
)

# -----------------------------
# 7. Preprocessing
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

# -----------------------------
# 8. Model
# -----------------------------
model = RandomForestClassifier(
    n_estimators=250,
    max_depth=18,
    min_samples_split=2,
    min_samples_leaf=1,
    class_weight="balanced_subsample",
    random_state=42,
    n_jobs=-1
)

clf = Pipeline(steps=[
    ("preprocessor", preprocessor),
    ("model", model)
])

# -----------------------------
# 9. Train
# -----------------------------
clf.fit(X_train, y_train)

# -----------------------------
# 10. Evaluate
# -----------------------------
y_pred = clf.predict(X_test)
print("\nClassification Report:\n")
print(classification_report(y_test, y_pred))

try:
    y_prob = clf.predict_proba(X_test)[:, 1]
    print("ROC-AUC:", roc_auc_score(y_test, y_prob))
except Exception as e:
    print("ROC-AUC not available:", e)

print("\nConfusion Matrix:\n")
print(confusion_matrix(y_test, y_pred))

# -----------------------------
# 11. Save model
# -----------------------------
joblib.dump(clf, "fraud_model.pkl")
print("\nSaved as fraud_model.pkl")