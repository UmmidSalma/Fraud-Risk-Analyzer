import pandas as pd
import numpy as np
import joblib
import matplotlib.pyplot as plt

from sklearn.model_selection import train_test_split
from sklearn.decomposition import TruncatedSVD
from behavior_engineer import BehaviorFeatureEngineer

# -----------------------------
# Load data
# -----------------------------
df = pd.read_csv("fraud_dataset.csv")

if len(df) > 200000:
    df = df.sample(n=200000, random_state=42)

# -----------------------------
# Feature engineering
# -----------------------------
engineer = joblib.load("behavior_engineer.pkl")
df_fe = engineer.transform(df)

# -----------------------------
# Features
# -----------------------------
target = "isFraud"

categorical_cols = ["type"]

numeric_cols = [
    "step", "amount", "oldbalanceOrg", "newbalanceOrig",
    "oldbalanceDest", "newbalanceDest", "hour_of_day", "is_night_tx",
    "sender_avg_amount", "sender_tx_count_before", "receiver_tx_count_before",
    "receiver_account_age_steps", "amount_dev_from_avg", "time_deviation",
    "freq_anomaly", "is_new_beneficiary", "device_mismatch_flag",
    "location_mismatch_flag", "transaction_velocity_proxy",
    "balance_drain_ratio", "behavioral_deviation_score",
    "failed_attempts_count"
]

feature_cols = categorical_cols + numeric_cols

X = df_fe[feature_cols].copy()
y = df_fe[target].copy()

# -----------------------------
# Split
# -----------------------------
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

# -----------------------------
# Load trained unsupervised model
# -----------------------------
unsup_model = joblib.load("unsupervised_model.pkl")
unsup_pre = joblib.load("unsup_preprocessor.pkl")

X_unsup = unsup_pre.transform(X_test)

# Predictions and anomaly scores
preds = unsup_model.predict(X_unsup)   # -1 = anomaly, 1 = normal
anomaly_scores = -unsup_model.score_samples(X_unsup)

normal_count = int((preds == 1).sum())
anomaly_count = int((preds == -1).sum())

print("\nUnsupervised Analysis:")
print("Normal count:", normal_count)
print("Anomaly count:", anomaly_count)

# -----------------------------
# 1) Anomaly Score Distribution
# -----------------------------
fig, ax = plt.subplots(figsize=(7, 5))
ax.hist(anomaly_scores, bins=30)
ax.set_title("Anomaly Score Distribution")
ax.set_xlabel("Anomaly Score")
ax.set_ylabel("Frequency")
plt.tight_layout()
plt.savefig("unsup_anomaly_score_distribution.png", dpi=300)
plt.close(fig)

# -----------------------------
# 2) Normal vs Anomaly Count
# -----------------------------
fig, ax = plt.subplots(figsize=(6, 5))
ax.bar(["Normal", "Anomaly"], [normal_count, anomaly_count])
ax.set_title("Normal vs Anomaly Count")
ax.set_ylabel("Count")
plt.tight_layout()
plt.savefig("unsup_normal_vs_anomaly.png", dpi=300)
plt.close(fig)

# -----------------------------
# 3) Box Plot
# -----------------------------
fig, ax = plt.subplots(figsize=(6, 5))
ax.boxplot(anomaly_scores)
ax.set_title("Anomaly Score Box Plot")
plt.tight_layout()
plt.savefig("unsup_anomaly_boxplot.png", dpi=300)
plt.close(fig)



print("All unsupervised graphs saved successfully.")