# ml/app.py

from fastapi import FastAPI
from pydantic import BaseModel
import joblib
import pandas as pd
import numpy as np

from behavior_engineer import BehaviorFeatureEngineer
from feature_config import MODEL_FEATURES

app = FastAPI(title="Hybrid Fraud Risk API")

# Load artifacts
sup_model = joblib.load("fraud_model.pkl")
unsup_model = joblib.load("unsupervised_model.pkl")
unsup_preprocessor = joblib.load("unsup_preprocessor.pkl")
engineer = joblib.load("behavior_engineer.pkl")


class TransactionInput(BaseModel):
    step: int = 0
    type: str
    nameOrig: str = "UNKNOWN_SENDER"
    nameDest: str = "UNKNOWN_RECEIVER"
    amount: float
    oldbalanceOrg: float
    newbalanceOrig: float
    oldbalanceDest: float
    newbalanceDest: float

    # optional PDF-style live fields
    device_id: str = "UNKNOWN_DEVICE"
    location: str = "UNKNOWN_LOCATION"
    city: str = "UNKNOWN_LOCATION"
    device_mismatch_flag: int = 0
    location_mismatch_flag: int = 0
    failed_attempts_count: int = 0


@app.get("/")
def home():
    return {"message": "Hybrid Fraud API running"}


@app.post("/predict")
def predict(txn: TransactionInput):
    raw = pd.DataFrame([txn.model_dump()])

    # same feature engineering used in training
    feat_df = engineer.transform(raw)

    # supervised prediction
    sup_input = feat_df[MODEL_FEATURES].copy()
    fraud_prob = float(sup_model.predict_proba(sup_input)[0][1])

    # unsupervised prediction
    unsup_input = feat_df[MODEL_FEATURES].copy()
    X_unsup = unsup_preprocessor.transform(unsup_input)

    anomaly_flag = int(unsup_model.predict(X_unsup)[0])   # -1 = anomaly, 1 = normal
    anomaly_raw = float(-unsup_model.score_samples(X_unsup)[0])
    is_anomaly = anomaly_flag == -1

    # PDF-style risk score (0-100)
    anomaly_component = max(0.0, min(35.0, anomaly_raw * 50.0))
    behavior_component = float(feat_df["behavioral_deviation_score"].iloc[0]) * 0.20

    extra_penalty = 0.0
    extra_penalty += 15.0 if int(txn.device_mismatch_flag) else 0.0
    extra_penalty += 10.0 if int(txn.location_mismatch_flag) else 0.0
    extra_penalty += min(15.0, float(txn.failed_attempts_count) * 5.0)

    risk_score = (
        fraud_prob * 65.0 +
        anomaly_component +
        behavior_component +
        extra_penalty
    )
    risk_score = round(min(100.0, max(0.0, risk_score)), 2)

    if risk_score <= 30:
        risk_level = "Safe"
        decision = "COMPLETED"
    elif risk_score <= 70:
        risk_level = "Moderate"
        decision = "PAUSED_OTP"
    else:
        risk_level = "High"
        decision = "BLOCKED"

    return {
        "fraud_probability": round(fraud_prob, 4),
        "anomaly_score": round(anomaly_raw, 4),
        "behavioral_deviation_score": round(float(feat_df["behavioral_deviation_score"].iloc[0]), 2),
        "risk_score": risk_score,
        "risk_level": risk_level,
        "is_anomaly": is_anomaly,
        "decision": decision
    }
# ML module added by <your name>