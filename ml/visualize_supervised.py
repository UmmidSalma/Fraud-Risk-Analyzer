import pandas as pd
import numpy as np
import joblib
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.model_selection import train_test_split
from sklearn.metrics import confusion_matrix, roc_curve, auc
from behavior_engineer import BehaviorFeatureEngineer

# Style for better visuals
plt.style.use("ggplot")

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
# Load model
# -----------------------------
clf = joblib.load("fraud_model.pkl")
y_pred = clf.predict(X_test)

# -----------------------------
# 1) Confusion Matrix
# -----------------------------
# -----------------------------
# 1) Confusion Matrix
# -----------------------------
from matplotlib.colors import LogNorm

cm = confusion_matrix(y_test, y_pred)

fig, ax = plt.subplots(figsize=(7, 6))

# Added norm=LogNorm() to handle the extreme value differences
# Changed cbar=True so viewers can see the logarithmic scale
sns.heatmap(
    cm,
    annot=True,
    fmt="d",
    cmap="Blues",
    cbar=True, 
    square=True,
    linewidths=1,
    linecolor="lightgray", # Changed to lightgray for better cell boundary visibility
    ax=ax,
    norm=LogNorm(),        # <--- THIS IS THE FIX
    annot_kws={"size": 14, "weight": "bold"}
)

ax.set_title("Confusion Matrix", fontsize=16, fontweight="bold", pad=15)
ax.set_xlabel("Predicted Label", fontsize=12, fontweight="bold")
ax.set_ylabel("Actual Label", fontsize=12, fontweight="bold")
ax.set_xticklabels(["Not Fraud", "Fraud"], fontsize=11)
ax.set_yticklabels(["Not Fraud", "Fraud"], fontsize=11, rotation=0)

plt.tight_layout()
plt.savefig("cm_ppt.png", dpi=300, bbox_inches="tight")
plt.close()

# -----------------------------
# 2) ROC Curve
# -----------------------------
y_score = clf.predict_proba(X_test)[:, 1]
fpr, tpr, _ = roc_curve(y_test, y_score)
roc_auc = auc(fpr, tpr)

fig, ax = plt.subplots(figsize=(6, 5))

ax.plot(fpr, tpr, linewidth=2, label=f"AUC = {roc_auc:.4f}")
ax.plot([0, 1], [0, 1], linestyle="--", linewidth=2)

ax.set_title("ROC Curve", fontsize=14, fontweight="bold")
ax.set_xlabel("False Positive Rate")
ax.set_ylabel("True Positive Rate")
ax.grid(True, linestyle="--", alpha=0.6)
ax.legend()

plt.tight_layout()
plt.savefig("roc_ppt.png", dpi=300)
plt.close()

# -----------------------------
# 3) Feature Importance
# -----------------------------
feature_names = clf.named_steps["preprocessor"].get_feature_names_out()
importances = clf.named_steps["model"].feature_importances_

indices = np.argsort(importances)[-15:]

fig, ax = plt.subplots(figsize=(10, 7))

ax.barh(range(len(indices)), importances[indices])
ax.set_yticks(range(len(indices)))
ax.set_yticklabels(feature_names[indices])

ax.set_title("Top Features Influencing Fraud Detection",
             fontsize=14, fontweight="bold")

ax.set_xlabel("Importance Score")

plt.tight_layout()
plt.savefig("feature_ppt.png", dpi=300)
plt.close()

print("✅ All PPT graphs generated successfully!")